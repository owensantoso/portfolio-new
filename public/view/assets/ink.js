(() => {
  "use strict";

  const Contract = globalThis.AmbientSharedViewContract;
  const Anchor = globalThis.AmbientSharedViewAnchor;
  const Overlay = globalThis.AmbientSharedViewOverlay;

  const LASER_LIFETIME_MS = 1000;
  const REGION = "ink";
  const EMIT_INTERVAL_MS = 100;

  function now() {
    return Date.now();
  }

  // One ink surface per document. Strokes are stored as anchored points and
  // resolved every frame, so they follow the content they were drawn on through
  // scrolling and ordinary re-layout. See SPEC-0015.
  function create({
    hostDocument = globalThis.document,
    index = null,
    viewport = null,
    laserLifetimeMs = LASER_LIFETIME_MS
  } = {}) {
    const layer = Overlay?.acquire(hostDocument);
    if (!layer) return null;
    const region = layer.region(REGION);
    const canvas = hostDocument.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    region.appendChild(canvas);
    const drawingContext = canvas.getContext ? canvas.getContext("2d") : null;

    const strokes = new Map();
    let frameHandle = null;
    let localStroke = null;
    let pendingPoints = [];
    let lastEmitAt = 0;
    let emit = () => {};
    let sequence = 0;

    function viewportOf() {
      if (viewport) return typeof viewport === "function" ? viewport() : viewport;
      const view = hostDocument.defaultView;
      return view ? { width: view.innerWidth, height: view.innerHeight } : null;
    }

    function resizeCanvas() {
      const view = hostDocument.defaultView;
      const ratio = Math.min(3, Math.max(1, view?.devicePixelRatio || 1));
      const rect = region.getBoundingClientRect ? region.getBoundingClientRect() : null;
      const width = Math.max(1, Math.round((rect?.width || view?.innerWidth || 1) * ratio));
      const height = Math.max(1, Math.round((rect?.height || view?.innerHeight || 1) * ratio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      return ratio;
    }

    function resolvePoint(entry) {
      // Pinned points hold their element, because after a children operation the
      // same path can address an unrelated node. Laser points live for about a
      // second, so plain resolution is correct and much cheaper.
      if (entry.hold) return entry.hold.current();
      return Anchor.resolve(index, entry.point, viewportOf());
    }

    function draw() {
      frameHandle = null;
      if (!drawingContext) return;
      const ratio = resizeCanvas();
      drawingContext.setTransform(1, 0, 0, 1, 0, 0);
      drawingContext.clearRect(0, 0, canvas.width, canvas.height);
      drawingContext.scale(ratio, ratio);
      drawingContext.lineCap = "round";
      drawingContext.lineJoin = "round";

      const currentTime = now();
      const reducedMotion = Boolean(layer.reducedMotion);

      for (const [strokeId, stroke] of strokes) {
        if (stroke.mode === "laser") {
          // The trail dissolves from the tail, so a laser stroke needs no
          // clearing interface and leaves no retained state.
          while (stroke.points.length && currentTime - stroke.points[0].at > laserLifetimeMs) {
            stroke.points.shift();
          }
          if (!stroke.points.length) {
            strokes.delete(strokeId);
            continue;
          }
        }

        const color = Contract.INK_COLORS[stroke.color] || Contract.INK_COLORS[0];
        let previous = null;
        for (const entry of stroke.points) {
          const resolved = resolvePoint(entry);
          if (resolved.orphaned) {
            // A gap, not a straight line across the missing region.
            previous = null;
            entry.orphaned = true;
            continue;
          }
          if (previous) {
            const age = currentTime - entry.at;
            const alpha = stroke.mode === "laser" && !reducedMotion
              ? Math.max(0, 1 - age / laserLifetimeMs)
              : stroke.orphanedAt
                ? Math.max(0, 1 - (currentTime - stroke.orphanedAt) / 400)
                : 1;
            drawingContext.globalAlpha = alpha;
            drawingContext.strokeStyle = color;
            drawingContext.lineWidth = stroke.width;
            drawingContext.beginPath();
            drawingContext.moveTo(previous.x, previous.y);
            drawingContext.lineTo(resolved.x, resolved.y);
            drawingContext.stroke();
          }
          previous = resolved;
        }

        // A pinned stroke whose anchors have all detached fades out and is
        // removed, rather than being left at coordinates that no longer mean
        // anything.
        if (stroke.mode === "pinned" && stroke.points.length && stroke.points.every((entry) => entry.orphaned)) {
          stroke.orphanedAt = stroke.orphanedAt || currentTime;
          if (currentTime - stroke.orphanedAt > 400) strokes.delete(strokeId);
        }
      }

      drawingContext.globalAlpha = 1;
      if (strokes.size) schedule();
    }

    function schedule() {
      if (frameHandle !== null) return;
      const view = hostDocument.defaultView;
      frameHandle = view?.requestAnimationFrame ? view.requestAnimationFrame(draw) : setTimeout(draw, 16);
    }

    function ensureStroke(frame) {
      const existing = strokes.get(frame.strokeId);
      if (existing) return existing;
      const created = {
        sender: frame.sender,
        mode: frame.mode,
        color: frame.color,
        width: frame.width,
        points: [],
        done: false,
        orphanedAt: null
      };
      strokes.set(frame.strokeId, created);
      return created;
    }

    function addPoints(stroke, points, timestamp) {
      for (const point of points) {
        if (stroke.points.length >= Contract.MAX_INK_STROKE_POINTS) break;
        const entry = { point, at: timestamp, orphaned: false };
        if (stroke.mode === "pinned" && point.a) entry.hold = Anchor.hold(index, point, viewportOf());
        stroke.points.push(entry);
      }
    }

    // Remote frames. Ordering is not assumed: the peer lane is unreliable by
    // design, so a frame that arrives behind its stroke's latest sequence is
    // dropped rather than appended out of order.
    function applyFrame(frame) {
      if (!Contract.validateInk(frame)) return false;
      const stroke = ensureStroke(frame);
      if (Number.isInteger(stroke.lastSequence) && frame.sequence <= stroke.lastSequence) return false;
      stroke.lastSequence = frame.sequence;
      addPoints(stroke, frame.points, now());
      if (frame.done) stroke.done = true;
      schedule();
      return true;
    }

    function beginLocal({ mode = "laser", color = 0, width = 3, sender = "host", identity = null } = {}) {
      const strokeId = `${sender}-${sequence += 1}-${now().toString(36)}`;
      localStroke = { strokeId, mode, color, width, sender, identity, frameSequence: 0 };
      pendingPoints = [];
      // Start the interval at the stroke's beginning so the first emit carries a
      // batch. A stroke shorter than one interval still delivers, through the
      // flush that ending it forces.
      lastEmitAt = now();
      const stroke = ensureStroke({ strokeId, sender, mode, color, width });
      return { strokeId, stroke };
    }

    function extendLocal(point) {
      if (!localStroke || !Anchor.validatePoint(point)) return false;
      const stroke = strokes.get(localStroke.strokeId);
      if (!stroke) return false;
      addPoints(stroke, [point], now());
      pendingPoints.push(point);
      schedule();
      flush(false);
      return true;
    }

    // Points are batched at the presence rate rather than emitted per pointer
    // event, which is the difference between a presence-sized stream and a
    // flood.
    function flush(done) {
      if (!localStroke) return null;
      const timestamp = now();
      if (!done && timestamp - lastEmitAt < EMIT_INTERVAL_MS) return null;
      if (!pendingPoints.length && !done) return null;
      lastEmitAt = timestamp;
      let finalFrame = null;
      do {
        const drainsStroke = pendingPoints.length <= Contract.MAX_INK_POINTS_PER_FRAME;
        finalFrame = {
          type: "shared-view-ink",
          version: 1,
          sender: localStroke.sender,
          strokeId: localStroke.strokeId,
          mode: localStroke.mode,
          color: localStroke.color,
          width: localStroke.width,
          points: pendingPoints.splice(0, Contract.MAX_INK_POINTS_PER_FRAME),
          done: Boolean(done && drainsStroke),
          capturedAt: timestamp,
          ...(localStroke.identity || {})
        };
        emit(finalFrame);
        // A normal timed flush remains one bounded packet. Ending a stroke must
        // drain every accepted sample before its final done frame.
      } while (done && pendingPoints.length);
      return finalFrame;
    }

    function endLocal() {
      const frame = flush(true);
      localStroke = null;
      pendingPoints = [];
      return frame;
    }

    function clearOwn(sender) {
      let removed = 0;
      for (const [strokeId, stroke] of strokes) {
        if (stroke.sender === sender && stroke.mode === "pinned") {
          strokes.delete(strokeId);
          removed += 1;
        }
      }
      schedule();
      return removed;
    }

    // Revocation removes ink immediately on both sides rather than freezing it.
    function clearAll() {
      strokes.clear();
      localStroke = null;
      pendingPoints = [];
      schedule();
    }

    function destroy() {
      clearAll();
      canvas.remove();
      layer.release(REGION);
    }

    return Object.freeze({
      applyFrame,
      beginLocal,
      extendLocal,
      endLocal,
      clearOwn,
      clearAll,
      destroy,
      draw,
      canvas,
      layer,
      get strokeCount() {
        return strokes.size;
      },
      strokeIds() {
        return [...strokes.keys()];
      },
      onEmit(handler) {
        emit = typeof handler === "function" ? handler : () => {};
      }
    });
  }

  globalThis.AmbientSharedViewInk = Object.freeze({ LASER_LIFETIME_MS, REGION, create });
})();
