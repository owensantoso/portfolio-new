(() => {
  "use strict";

  const Contract = globalThis.AmbientSharedViewContract;

  const MAX_PATH_DEPTH = 35;
  const MAX_PATH_INDEX = 1500;
  const FRACTION_PRECISION = 4;

  const ORPHAN_UNRESOLVED = "unresolved";
  const ORPHAN_TAG_MISMATCH = "tag-mismatch";
  const ORPHAN_DETACHED = "detached";
  const ORPHAN_NO_VIEWPORT = "no-viewport";

  function validatePath(path) {
    if (Contract?.validatePatchPath) return Contract.validatePatchPath(path);
    return (
      Array.isArray(path) &&
      path.length <= MAX_PATH_DEPTH &&
      path.every((index) => Number.isInteger(index) && index >= 0 && index < MAX_PATH_INDEX)
    );
  }

  function isFraction(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
  }

  function quantize(value) {
    return Number(value.toFixed(FRACTION_PRECISION));
  }

  function clampFraction(value) {
    if (!Number.isFinite(value)) return 0;
    return quantize(Math.min(1, Math.max(0, value)));
  }

  function validateAnchoredPoint(point) {
    const anchor = point?.a;
    if (!anchor || typeof anchor !== "object") return false;
    // A node id is the preferred addressing form. It is assigned once per
    // element and survives sibling insertion, subtree replacement, and any
    // number of checkpoints, which a child-index path does not. The path form
    // remains valid for senders that have no id available.
    if (anchor.n !== undefined) {
      if (!Number.isInteger(anchor.n) || anchor.n < 1 || anchor.n > 5_000_000) return false;
    } else if (!validatePath(anchor.path)) {
      return false;
    }
    if (!isFraction(anchor.u) || !isFraction(anchor.v)) return false;
    if (anchor.t !== undefined && (typeof anchor.t !== "string" || anchor.t.length > 32)) return false;
    return true;
  }

  function validateFreePoint(point) {
    const free = point?.f;
    if (!free || typeof free !== "object") return false;
    if (!isFraction(free.vx) || !isFraction(free.vy)) return false;
    if (free.scrollY !== undefined && !Number.isFinite(free.scrollY)) return false;
    return true;
  }

  // A Point is anchored or free, never both, never neither. Malformed points are
  // rejected rather than coerced, per SPEC-0013.
  function validatePoint(point) {
    if (!point || typeof point !== "object") return false;
    const anchored = "a" in point;
    const free = "f" in point;
    if (anchored === free) return false;
    return anchored ? validateAnchoredPoint(point) : validateFreePoint(point);
  }

  function anchoredPoint(path, u, v, tag) {
    const anchor = { path: path.slice(), u: clampFraction(u), v: clampFraction(v) };
    if (tag) anchor.t = String(tag).slice(0, 32);
    return { a: anchor };
  }

  function identifiedPoint(id, u, v, tag) {
    const anchor = { n: id, u: clampFraction(u), v: clampFraction(v) };
    if (tag) anchor.t = String(tag).slice(0, 32);
    return { a: anchor };
  }

  function freePoint(vx, vy, scrollY) {
    const free = { vx: clampFraction(vx), vy: clampFraction(vy) };
    if (Number.isFinite(scrollY)) free.scrollY = Math.round(scrollY);
    return { f: free };
  }

  function elementTag(element) {
    const tag = element?.tagName;
    return typeof tag === "string" ? tag.toLowerCase() : null;
  }

  // Receiver backend. renderer.js appends exactly one node per render-tree node,
  // in order, so a render-tree path is a childNodes walk.
  function createDomMirrorIndex(rootNode, nodeById = null) {
    function elementForPath(path) {
      let node = rootNode;
      for (const index of path) {
        const children = node?.childNodes;
        if (!children || index >= children.length) return null;
        node = children[index];
      }
      return node || null;
    }

    function pathForElement(element) {
      const path = [];
      let node = element;
      while (node && node !== rootNode) {
        const parent = node.parentNode;
        if (!parent) return null;
        const index = Array.prototype.indexOf.call(parent.childNodes, node);
        if (index < 0) return null;
        path.unshift(index);
        node = parent;
      }
      if (node !== rootNode) return null;
      if (!validatePath(path)) return null;
      return path;
    }

    function elementForId(id) {
      return nodeById?.get(id) || null;
    }

    return Object.freeze({ elementForPath, pathForElement, elementForId, root: rootNode });
  }

  // Host backend. Capture omits and normalizes nodes, so render-tree index i is
  // not source child i. The table is built during capture and stays local.
  function createCaptureIndex(capturePaths) {
    const pathToElement = capturePaths?.pathToElement || new Map();
    const elementToPath = capturePaths?.elementToPath || null;
    const idToElement = capturePaths?.idToElement || null;
    const elementToId = capturePaths?.elementToId || null;

    function elementForPath(path) {
      const element = pathToElement.get(path.join(".")) || null;
      if (!element) return null;
      if (element.isConnected === false) return null;
      return element;
    }

    function pathForElement(element) {
      if (!elementToPath) return null;
      let node = element;
      // An anchor may be requested for a node that capture skipped, such as a
      // text node or an invisible wrapper. Walk up to the nearest captured
      // ancestor rather than failing, because "inside this element" is still a
      // useful anchor.
      while (node) {
        const path = elementToPath.get(node);
        if (path && validatePath(path)) return path.slice();
        node = node.parentElement || null;
      }
      return null;
    }

    function elementForId(id) {
      const element = idToElement?.get(id) || null;
      if (!element || element.isConnected === false) return null;
      return element;
    }

    function idForElement(element) {
      let node = element;
      while (node) {
        const id = elementToId?.get(node);
        if (Number.isInteger(id)) return id;
        node = node.parentElement || null;
      }
      return null;
    }

    return Object.freeze({ elementForPath, pathForElement, elementForId, idForElement, root: null });
  }

  function rectOf(element) {
    if (typeof element?.getBoundingClientRect !== "function") return null;
    const rect = element.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null;
    return rect;
  }

  function fromElement(index, element, clientX, clientY) {
    const rect = rectOf(element);
    if (!rect) return null;
    const width = rect.width || 1;
    const height = rect.height || 1;
    const u = (clientX - rect.left) / width;
    const v = (clientY - rect.top) / height;
    // Prefer identity over position whenever the sender has it.
    const id = index?.idForElement ? index.idForElement(element) : null;
    if (Number.isInteger(id)) return identifiedPoint(id, u, v, elementTag(element));
    const path = index?.pathForElement ? index.pathForElement(element) : null;
    if (!path) return null;
    return anchoredPoint(path, u, v, elementTag(element));
  }

  function fromViewport(clientX, clientY, viewport) {
    const width = Math.max(1, viewport?.width || 0);
    const height = Math.max(1, viewport?.height || 0);
    return freePoint(clientX / width, clientY / height, viewport?.scrollY);
  }

  // Prefer an anchor, fall back to a free point. Callers that must not fall back
  // (source control) should use fromElement directly and handle null.
  function fromPointer(index, element, clientX, clientY, viewport) {
    return fromElement(index, element, clientX, clientY) || fromViewport(clientX, clientY, viewport);
  }

  function orphan(reason) {
    return { orphaned: true, reason, element: null, x: 0, y: 0 };
  }

  function resolve(index, point, viewport) {
    if (!validatePoint(point)) return orphan(ORPHAN_UNRESOLVED);

    if (point.f) {
      const width = Math.max(1, viewport?.width || 0);
      const height = Math.max(1, viewport?.height || 0);
      if (!viewport) return orphan(ORPHAN_NO_VIEWPORT);
      return {
        orphaned: false,
        reason: null,
        element: null,
        x: (Number(viewport.x) || 0) + point.f.vx * width,
        y: (Number(viewport.y) || 0) + point.f.vy * height
      };
    }

    const element = Number.isInteger(point.a.n)
      ? (index?.elementForId ? index.elementForId(point.a.n) : null)
      : (index?.elementForPath ? index.elementForPath(point.a.path) : null);
    if (!element) return orphan(ORPHAN_UNRESOLVED);
    if (point.a.t && elementTag(element) && elementTag(element) !== point.a.t) return orphan(ORPHAN_TAG_MISMATCH);
    const rect = rectOf(element);
    if (!rect) return orphan(ORPHAN_DETACHED);
    return {
      orphaned: false,
      reason: null,
      element,
      x: rect.left + point.a.u * (rect.width || 0),
      y: rect.top + point.a.v * (rect.height || 0)
    };
  }

  // Long-lived consumers (pinned ink) resolve once and hold the node reference.
  // Re-resolving a stored path after a children operation is not reliable, so a
  // detached hold orphans instead of re-resolving. See SPEC-0013.
  function hold(index, point, viewport) {
    const resolved = resolve(index, point, viewport);
    if (resolved.orphaned) return { orphaned: true, reason: resolved.reason, current: () => orphan(resolved.reason) };
    const element = resolved.element;
    const offset = point.a ? { u: point.a.u, v: point.a.v } : null;
    return {
      orphaned: false,
      reason: null,
      element,
      current() {
        if (!element) return resolve(index, point, viewport);
        if (element.isConnected === false) return orphan(ORPHAN_DETACHED);
        const rect = rectOf(element);
        if (!rect) return orphan(ORPHAN_DETACHED);
        return {
          orphaned: false,
          reason: null,
          element,
          x: rect.left + (offset ? offset.u : 0) * (rect.width || 0),
          y: rect.top + (offset ? offset.v : 0) * (rect.height || 0)
        };
      }
    };
  }

  globalThis.AmbientSharedViewAnchor = Object.freeze({
    MAX_PATH_DEPTH,
    MAX_PATH_INDEX,
    ORPHAN_UNRESOLVED,
    ORPHAN_TAG_MISMATCH,
    ORPHAN_DETACHED,
    ORPHAN_NO_VIEWPORT,
    anchoredPoint,
    identifiedPoint,
    createCaptureIndex,
    createDomMirrorIndex,
    freePoint,
    fromElement,
    fromPointer,
    fromViewport,
    hold,
    resolve,
    validatePoint
  });
})();
