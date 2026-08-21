(() => {
  "use strict";

  const Physics = globalThis.AvatarPlatformerKit;
  const Anchor = globalThis.AmbientSharedViewAnchor;
  const Overlay = globalThis.AmbientSharedViewOverlay;

  const REGION = "avatars";
  const FRAME_VERSION = 1;
  const EMIT_INTERVAL_MS = 100;
  const PLATFORM_SELECTOR = [
    "main", "article", "section", "aside", "nav", "header", "footer",
    "figure", "blockquote", "pre", "table", "form", "fieldset", "details",
    "summary", "button", "a", "input", "select", "textarea", "img", "video",
    "canvas", "svg", "h1", "h2", "h3", "h4", "h5", "h6", "p", "li",
    "[role]", "[data-avatar-platform]"
  ].join(",");
  const MAX_PLATFORM_CANDIDATES = 2000;
  const WORLD_WIDTH = 1280;
  const AVATAR_WIDTH = 34;
  const AVATAR_HEIGHT = 44;
  const NAMEPLATE_FLOOR_RESERVE = 20;
  const REMOTE_INTERPOLATION_MS = 90;
  const CHAT_BUBBLE_LIFETIME_MS = 6000;
  const editableTags = new Set(["INPUT", "TEXTAREA", "SELECT"]);
  const avatarParts = new WeakMap();

  function finite(value) {
    return Number.isFinite(value);
  }

  function boundedString(value, maximum = 120) {
    return typeof value === "string" && value.length > 0 && value.length <= maximum;
  }

  function validateFrame(frame) {
    if (!frame || frame.type !== "shared-view-avatar" || frame.version !== FRAME_VERSION) return false;
    if (!boundedString(frame.sender, 12) || !["host", "guest"].includes(frame.sender)) return false;
    if (!Number.isInteger(frame.sequence) || frame.sequence < 1) return false;
    if (!((Number.isInteger(frame.sourceEpoch) && frame.sourceEpoch >= 0) || boundedString(frame.sourceEpoch))) return false;
    if (!finite(frame.capturedAt) || !Anchor?.validatePoint(frame.at)) return false;
    if (![frame.x, frame.y, frame.vx, frame.vy].every(finite)) return false;
    if (frame.viewport !== undefined && !(
      frame.viewport &&
      finite(frame.viewport.width) && frame.viewport.width > 0 && frame.viewport.width <= 100_000 &&
      finite(frame.viewport.height) && frame.viewport.height > 0 && frame.viewport.height <= 100_000
    )) return false;
    if (!["grounded", "airborne", "wallslide"].includes(frame.state)) return false;
    if (![frame.facing].every((value) => value === -1 || value === 1)) return false;
    if (!frame.input || !finite(frame.input.direction) || frame.input.direction < -1 || frame.input.direction > 1) return false;
    if (![frame.input.jump, frame.input.drop].every((value) => typeof value === "boolean")) return false;
    return true;
  }

  function setStyles(element, entries) {
    for (const [property, value] of entries) element.style.setProperty(property, value);
  }

  function createPart(hostDocument, className, styles) {
    const part = hostDocument.createElement("span");
    part.className = className;
    setStyles(part, [["position", "absolute"], ...styles]);
    return part;
  }

  function createAvatarElement(hostDocument, role) {
    const avatar = hostDocument.createElement("div");
    avatar.dataset.avatarRole = role;
    avatar.setAttribute("aria-hidden", "true");
    const accent = role === "host" ? "#55d8e6" : "#ffb44d";
    setStyles(avatar, [
      ["position", "absolute"], ["left", "0"], ["top", "0"],
      ["width", `${AVATAR_WIDTH}px`], ["height", `${AVATAR_HEIGHT}px`],
      ["transform-origin", "0 0"], ["will-change", "transform"],
      ["pointer-events", "none"]
    ]);

    const sprite = createPart(hostDocument, "sprite", [
      ["inset", "0"], ["transform-origin", "50% 100%"],
      ["filter", "drop-shadow(3px 4px 1px rgba(36,33,29,.22))"]
    ]);

    const head = createPart(hostDocument, "head", [
      ["top", "1px"], ["left", "7px"], ["width", "20px"], ["height", "18px"],
      ["border", "2px solid #24211d"], ["border-radius", "2px"], ["background", "#f8f1e4"],
      ["box-shadow", "3px 3px 0 rgba(78,119,108,.22)"]
    ]);
    head.append(
      createPart(hostDocument, "eye-left", [["top", "6px"], ["left", "3px"], ["width", "3px"], ["height", "3px"], ["background", "#24211d"]]),
      createPart(hostDocument, "eye-right", [["top", "6px"], ["right", "3px"], ["width", "3px"], ["height", "3px"], ["background", "#24211d"]])
    );
    const body = createPart(hostDocument, "body", [
      ["top", "19px"], ["left", "12px"], ["width", "10px"], ["height", "14px"],
      ["border", "2px solid #24211d"], ["background", accent]
    ]);
    const limb = (name, left, top, height) => createPart(hostDocument, name, [
      ["top", `${top}px`], ["left", `${left}px`], ["width", "5px"], ["height", `${height}px`],
      ["border", "1px solid #24211d"], ["background", "#35312c"], ["transform-origin", "50% 2px"]
    ]);
    const armLeft = limb("arm-left", 7, 21, 14);
    const armRight = limb("arm-right", 22, 21, 14);
    const legLeft = limb("leg-left", 10, 32, 12);
    const legRight = limb("leg-right", 19, 32, 12);
    sprite.append(head, body, armLeft, armRight, legLeft, legRight);
    const name = createPart(hostDocument, "name", [
      ["top", `${AVATAR_HEIGHT + 4}px`], ["left", "50%"],
      ["max-width", "116px"], ["padding", "1px 4px"],
      ["overflow", "hidden"], ["border-radius", "3px"],
      ["background", "rgba(35, 33, 30, .82)"], ["color", "#fffaf0"],
      ["font", "600 9px/13px -apple-system, BlinkMacSystemFont, sans-serif"],
      ["letter-spacing", ".02em"], ["text-overflow", "ellipsis"],
      ["text-shadow", "0 1px 0 rgba(0,0,0,.35)"], ["white-space", "nowrap"],
      ["transform", "translateX(-50%)"]
    ]);
    name.textContent = role === "host" ? "Owen" : "Guest";

    const bubble = createPart(hostDocument, "speech-bubble", [
      ["left", "50%"], ["bottom", `${AVATAR_HEIGHT + 7}px`],
      ["min-width", "40px"], ["max-width", "150px"], ["padding", "5px 7px"],
      ["border", "1.5px solid #607082"], ["border-radius", "7px"],
      ["background", "rgba(255,255,255,.96)"], ["color", "#24211d"],
      ["font", "500 10px/13px -apple-system, BlinkMacSystemFont, sans-serif"],
      ["overflow-wrap", "anywhere"], ["text-align", "center"],
      ["transform", "translateX(-50%)"],
      ["box-shadow", "0 2px 0 rgba(36,33,29,.18)"]
    ]);
    bubble.hidden = true;
    const bubbleText = createPart(hostDocument, "speech-text", [["position", "relative"]]);
    const bubbleTail = createPart(hostDocument, "speech-tail", [
      ["left", "50%"], ["bottom", "-5px"], ["width", "8px"], ["height", "8px"],
      ["border-right", "1.5px solid #607082"], ["border-bottom", "1.5px solid #607082"],
      ["background", "rgba(255,255,255,.96)"], ["transform", "translateX(-50%) rotate(45deg)"]
    ]);
    bubble.append(bubbleText, bubbleTail);

    avatar.append(sprite, name, bubble);
    avatarParts.set(avatar, { sprite, armLeft, armRight, legLeft, legRight, name, bubble, bubbleText });
    return avatar;
  }

  function viewportOf(hostDocument, supplied) {
    const value = typeof supplied === "function" ? supplied() : supplied;
    if (value && finite(value.width) && finite(value.height)) return value;
    const view = hostDocument.defaultView;
    return { x: 0, y: 0, width: Math.max(1, view?.innerWidth || 1), height: Math.max(1, view?.innerHeight || 1) };
  }

  function worldForViewport(viewport) {
    const scale = Math.max(0.001, viewport.width / WORLD_WIDTH);
    return {
      width: WORLD_WIDTH,
      height: viewport.height / scale,
      scale
    };
  }

  function platformId(index, element) {
    const nodeId = index?.idForElement?.(element);
    if (Number.isInteger(nodeId)) return `node:${nodeId}`;
    const path = index?.pathForElement?.(element);
    return Array.isArray(path) ? `path:${path.join(".")}` : null;
  }

  function scanPlatforms(hostDocument, index, viewport) {
    const world = worldForViewport(viewport);
    const candidates = Array.from(hostDocument.querySelectorAll?.(PLATFORM_SELECTOR) || []).slice(0, MAX_PLATFORM_CANDIDATES);
    const platforms = [];
    const elementByPlatformId = new Map();
    const viewportLeft = viewport.x || 0;
    const viewportTop = viewport.y || 0;
    const viewportRight = viewportLeft + viewport.width;
    const viewportBottom = viewportTop + viewport.height;
    for (const element of candidates) {
      if (element.closest?.(`#${Overlay?.HOST_ID}`)) continue;
      const rect = element.getBoundingClientRect?.();
      if (!rect || rect.width < 24 || rect.height < 8 || rect.right <= viewportLeft || rect.left >= viewportRight || rect.top < viewportTop || rect.top >= viewportBottom) continue;
      const style = hostDocument.defaultView?.getComputedStyle?.(element);
      if (style && (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0.02)) continue;
      const id = platformId(index, element);
      if (!id) continue;
      platforms.push({
        id,
        minX: Math.max(0, (rect.left - viewportLeft) / world.scale),
        maxX: Math.min(world.width, (rect.right - viewportLeft) / world.scale),
        y: world.height - ((rect.top - viewportTop) / world.scale)
      });
      elementByPlatformId.set(id, element);
    }
    return { platforms, elementByPlatformId };
  }

  function movementState(state) {
    if (state.wallSliding) return "wallslide";
    return state.grounded ? "grounded" : "airborne";
  }

  function pointForState(state, platformElements, index, viewport, world) {
    if (state.grounded && platformElements.has(state.supportSurfaceId)) {
      const element = platformElements.get(state.supportSurfaceId);
      const rect = element.getBoundingClientRect();
      const footCenterX = (state.x + state.width / 2) * world.scale + (viewport.x || 0);
      const point = Anchor.fromElement(index, element, footCenterX, rect.top);
      if (point) return point;
    }
    return Anchor.freePoint(
      (state.x + state.width / 2) / Math.max(1, world.width),
      (world.height - state.y) / Math.max(1, world.height)
    );
  }

  function positionFromFrame(frame, index, viewport) {
    const world = worldForViewport(viewport);
    const resolved = Anchor.resolve(index, frame.at, viewport);
    if (resolved.orphaned) {
      // A participant must not disappear merely because one semantic node was
      // replaced between checkpoints. The sender's bounded viewport provides
      // a visible free-position fallback until a later frame resolves again.
      if (!frame.viewport) return null;
      return {
        x: (frame.x / frame.viewport.width) * world.width,
        y: (frame.y / frame.viewport.height) * world.height,
        orphaned: true
      };
    }
    return {
      x: ((resolved.x - (viewport.x || 0)) / world.scale) - AVATAR_WIDTH / 2,
      y: world.height - ((resolved.y - (viewport.y || 0)) / world.scale),
      orphaned: false
    };
  }

  function poseAvatar(element, state, reducedMotion, timestamp) {
    const parts = avatarParts.get(element);
    if (!parts) return;
    parts.sprite.style.setProperty("transform", `scaleX(${state.facing < 0 ? -1 : 1})`);
    const airborne = state.state !== "grounded";
    const moving = !airborne && !reducedMotion && Math.abs(state.vx) > 20;
    const alternate = moving && Math.floor(timestamp / 90) % 2 === 1;
    parts.armLeft.style.setProperty("transform", airborne
      ? "rotate(132deg)"
      : moving ? `rotate(${alternate ? -24 : 24}deg)` : "rotate(9deg)");
    parts.armRight.style.setProperty("transform", airborne
      ? "rotate(-132deg)"
      : moving ? `rotate(${alternate ? 24 : -24}deg)` : "rotate(-12deg)");
    parts.legLeft.style.setProperty("transform", airborne
      ? "rotate(22deg) translateY(-2px)"
      : moving ? `rotate(${alternate ? 24 : -24}deg)` : "none");
    parts.legRight.style.setProperty("transform", airborne
      ? "rotate(-22deg) translateY(-2px)"
      : moving ? `rotate(${alternate ? -24 : 24}deg)` : "none");
  }

  function renderAvatar(element, state, viewport, reducedMotion, { remote = false, timestamp = 0 } = {}) {
    const world = worldForViewport(viewport);
    const x = (viewport.x || 0) + Math.max(0, Math.min(world.width - AVATAR_WIDTH, state.x)) * world.scale;
    const top = (viewport.y || 0) + Math.max(-AVATAR_HEIGHT, world.height - state.y - AVATAR_HEIGHT) * world.scale;
    element.dataset.facing = state.facing < 0 ? "left" : "right";
    element.dataset.movement = state.state;
    element.style.setProperty("transition", !reducedMotion && remote ? `transform ${REMOTE_INTERPOLATION_MS}ms linear` : "none");
    // Safari can rasterize a transform-scaled subtree at its 34x44 logical
    // size and then enlarge the cached layer, which makes the sprite and text
    // visibly soft on wide/Retina windows. CSS zoom lays the subtree out at
    // its final display size so edges and type are rasterized crisply.
    element.style.setProperty("zoom", String(world.scale));
    element.style.setProperty("transform", `translate3d(${x / world.scale}px, ${top / world.scale}px, 0)`);
    poseAvatar(element, state, reducedMotion, timestamp);
  }

  function create({ hostDocument = globalThis.document, index = null, viewport = null, role = "host" } = {}) {
    if (!Physics || !Anchor || !Overlay || !hostDocument) return null;
    const layer = Overlay.acquire(hostDocument);
    const region = layer.region(REGION);
    const localElement = createAvatarElement(hostDocument, role);
    localElement.hidden = true;
    const remoteRole = role === "host" ? "guest" : "host";
    const remoteElement = createAvatarElement(hostDocument, remoteRole);
    remoteElement.hidden = true;
    region.append(localElement, remoteElement);

    let localState = Physics.createAvatarState({
      x: role === "host" ? 40 : 96,
      y: NAMEPLATE_FLOOR_RESERVE
    });
    let remoteState = null;
    let running = false;
    let animationHandle = null;
    let previousTime = 0;
    let accumulator = 0;
    let lastEmitAt = 0;
    let sequence = 0;
    let emit = () => {};
    let lastApplyResult = "none";
    let latestPlatforms = { platforms: [], elementByPlatformId: new Map() };
    let platformScanDueAt = 0;
    const heldKeys = new Set();
    let jumpPressed = false;
    let dropPressed = false;
    let facing = 1;
    const bubbleTimers = new Map();

    function setNames({ local, remote } = {}) {
      const localName = avatarParts.get(localElement)?.name;
      const remoteName = avatarParts.get(remoteElement)?.name;
      const nextLocal = String(local || "").trim();
      const nextRemote = String(remote || "").trim();
      if (localName && boundedString(nextLocal, 40)) localName.textContent = nextLocal;
      if (remoteName && boundedString(nextRemote, 40)) remoteName.textContent = nextRemote;
    }

    function showChat(sender, text) {
      const message = String(text || "").trim();
      if (!boundedString(message, 500)) return false;
      const element = sender === role ? localElement : sender === remoteRole ? remoteElement : null;
      const parts = element && avatarParts.get(element);
      if (!parts) return false;
      parts.bubbleText.textContent = message;
      parts.bubble.hidden = false;
      clearTimeout(bubbleTimers.get(element));
      bubbleTimers.set(element, setTimeout(() => {
        parts.bubble.hidden = true;
        bubbleTimers.delete(element);
      }, CHAT_BUBBLE_LIFETIME_MS));
      return true;
    }

    function isEditableTarget(target) {
      return Boolean(target && (editableTags.has(target.tagName) || target.isContentEditable));
    }

    function onKeyDown(event) {
      if (!running || isEditableTarget(event.target)) return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS", "Space"].includes(event.code)) return;
      if (!event.repeat && ["ArrowUp", "KeyW", "Space"].includes(event.code)) jumpPressed = true;
      if (!event.repeat && ["ArrowDown", "KeyS"].includes(event.code)) dropPressed = true;
      heldKeys.add(event.code);
      event.preventDefault();
      event.stopPropagation();
    }

    function onKeyUp(event) {
      heldKeys.delete(event.code);
    }

    function input() {
      const left = heldKeys.has("ArrowLeft") || heldKeys.has("KeyA");
      const right = heldKeys.has("ArrowRight") || heldKeys.has("KeyD");
      const direction = left === right ? 0 : left ? -1 : 1;
      if (direction) facing = direction;
      const value = {
        direction,
        jumpPressed,
        jumpHeld: heldKeys.has("ArrowUp") || heldKeys.has("KeyW") || heldKeys.has("Space"),
        dropPressed,
        downHeld: heldKeys.has("ArrowDown") || heldKeys.has("KeyS")
      };
      jumpPressed = false;
      dropPressed = false;
      return value;
    }

    function refreshPlatforms(currentTime, currentViewport) {
      if (currentTime < platformScanDueAt) return;
      platformScanDueAt = currentTime + 250;
      latestPlatforms = scanPlatforms(hostDocument, index, currentViewport);
    }

    function makeFrame(currentTime, currentViewport, currentInput) {
      const world = worldForViewport(currentViewport);
      return {
        type: "shared-view-avatar",
        version: FRAME_VERSION,
        sender: role,
        sequence: ++sequence,
        sourceEpoch: 0,
        capturedAt: Date.now(),
        at: pointForState(localState, latestPlatforms.elementByPlatformId, index, currentViewport, world),
        viewport: { width: world.width, height: world.height },
        x: localState.x,
        y: localState.y,
        vx: localState.vx,
        vy: localState.vy,
        facing,
        input: {
          direction: currentInput.direction,
          jump: currentInput.jumpHeld || currentInput.jumpPressed,
          drop: currentInput.downHeld || currentInput.dropPressed
        },
        state: movementState(localState)
      };
    }

    function tick(timestamp) {
      if (!running) return;
      const currentViewport = viewportOf(hostDocument, viewport);
      const world = worldForViewport(currentViewport);
      refreshPlatforms(timestamp, currentViewport);
      const elapsed = previousTime ? Math.min(100, timestamp - previousTime) : 0;
      previousTime = timestamp;
      accumulator += elapsed / 1000;
      const currentInput = input();
      while (accumulator >= Physics.FIXED_DT) {
        ({ state: localState } = Physics.stepAvatar(localState, {
          input: currentInput,
          world: {
            bounds: { minX: 0, maxX: world.width, floorY: NAMEPLATE_FLOOR_RESERVE },
            platforms: latestPlatforms.platforms,
            walls: []
          }
        }));
        accumulator -= Physics.FIXED_DT;
      }
      renderAvatar(localElement, { ...localState, state: movementState(localState), facing }, currentViewport, layer.reducedMotion, { timestamp });
      if (remoteState) renderAvatar(remoteElement, remoteState, currentViewport, layer.reducedMotion, { remote: true, timestamp });
      if (timestamp - lastEmitAt >= EMIT_INTERVAL_MS) {
        lastEmitAt = timestamp;
        emit(makeFrame(timestamp, currentViewport, currentInput));
      }
      animationHandle = hostDocument.defaultView?.requestAnimationFrame?.(tick) ?? setTimeout(() => tick(Date.now()), 16);
    }

    function start() {
      if (running) return;
      running = true;
      localElement.hidden = false;
      hostDocument.defaultView?.addEventListener?.("keydown", onKeyDown, true);
      hostDocument.defaultView?.addEventListener?.("keyup", onKeyUp, true);
      animationHandle = hostDocument.defaultView?.requestAnimationFrame?.(tick) ?? setTimeout(() => tick(Date.now()), 16);
    }

    function stop() {
      if (!running) return;
      running = false;
      hostDocument.defaultView?.removeEventListener?.("keydown", onKeyDown, true);
      hostDocument.defaultView?.removeEventListener?.("keyup", onKeyUp, true);
      if (hostDocument.defaultView?.cancelAnimationFrame && typeof animationHandle === "number") {
        hostDocument.defaultView.cancelAnimationFrame(animationHandle);
      } else {
        clearTimeout(animationHandle);
      }
      animationHandle = null;
      heldKeys.clear();
      localElement.hidden = true;
    }

    function applyFrame(frame) {
      if (!validateFrame(frame)) {
        lastApplyResult = "invalid-frame";
        return false;
      }
      if (frame.sender !== remoteRole) {
        lastApplyResult = "wrong-sender";
        return false;
      }
      if (remoteState && frame.sequence <= remoteState.sequence) {
        lastApplyResult = "stale-sequence";
        return false;
      }
      const currentViewport = viewportOf(hostDocument, viewport);
      const position = positionFromFrame(frame, index, currentViewport);
      if (!position) {
        remoteElement.hidden = true;
        remoteState = null;
        lastApplyResult = "unresolved-position";
        return false;
      }
      remoteState = { ...frame, ...position };
      remoteElement.hidden = false;
      renderAvatar(remoteElement, remoteState, currentViewport, layer.reducedMotion, { remote: true, timestamp: hostDocument.defaultView?.performance?.now?.() || Date.now() });
      lastApplyResult = "applied";
      return true;
    }

    function clearRemote() {
      remoteState = null;
      remoteElement.hidden = true;
    }

    function destroy() {
      stop();
      clearRemote();
      for (const timer of bubbleTimers.values()) clearTimeout(timer);
      bubbleTimers.clear();
      localElement.remove();
      remoteElement.remove();
      layer.release(REGION);
    }

    return Object.freeze({
      applyFrame,
      clearRemote,
      destroy,
      localElement,
      remoteElement,
      setNames,
      showChat,
      start,
      stop,
      onEmit(handler) { emit = typeof handler === "function" ? handler : () => {}; },
      get diagnostics() { return { running, lastApplyResult }; },
      get localState() { return { ...localState }; },
      get remoteState() { return remoteState ? { ...remoteState } : null; }
    });
  }

  globalThis.AmbientSharedViewAvatar = Object.freeze({
    AVATAR_HEIGHT,
    AVATAR_WIDTH,
    CHAT_BUBBLE_LIFETIME_MS,
    EMIT_INTERVAL_MS,
    FRAME_VERSION,
    NAMEPLATE_FLOOR_RESERVE,
    REGION,
    WORLD_WIDTH,
    create,
    positionFromFrame,
    runtimeStatus: () => ({
      physics: Boolean(Physics),
      anchor: Boolean(Anchor),
      overlay: Boolean(Overlay)
    }),
    scanPlatforms,
    worldForViewport,
    validateFrame
  });
})();
