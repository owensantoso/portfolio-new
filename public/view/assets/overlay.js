(() => {
  "use strict";

  const HOST_ID = "ambient-shared-view-overlay";
  const STATE_KEY = "__ambientSharedViewOverlay";

  // One overlay per document, shared by every Place visual: remote cursors, ink,
  // avatars, and chat bubbles. Features acquire a named region rather than
  // creating their own layer, so stacking, pointer transparency, and teardown
  // have exactly one owner. See SPEC-0013.
  //
  // The layer performs no host mutation during ordinary scroll. It relies on
  // native fixed positioning and the CSS small viewport, which is the same
  // decision the Safari Viewport Avatar probe reached after a physically
  // observed scroll-judder defect. Do not add scroll or resize handlers that
  // write layout here.
  const HOST_STYLES = Object.freeze([
    ["position", "fixed"],
    ["top", "0"],
    ["left", "0"],
    ["width", "100%"],
    // The stable room is the CSS small viewport: collapsing browser UI reveals
    // page below the room instead of moving its floor.
    ["height", "100svh"],
    ["margin", "0"],
    ["padding", "0"],
    ["border", "0"],
    ["pointer-events", "none"],
    ["z-index", "2147483646"],
    ["contain", "layout style size"],
    ["color-scheme", "light dark"]
  ]);

  const REGION_STYLES = Object.freeze([
    ["position", "absolute"],
    ["inset", "0"],
    ["pointer-events", "none"]
  ]);

  function setStyles(element, styles) {
    for (const [property, value] of styles) element.style.setProperty(property, value);
  }

  function prefersReducedMotion(view) {
    return Boolean(view?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  }

  function createLayer(hostDocument) {
    const host = hostDocument.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("aria-hidden", "true");
    setStyles(host, HOST_STYLES);

    const surface = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    (hostDocument.body || hostDocument.documentElement).appendChild(host);

    const regions = new Map();

    function region(name, { interactive = false } = {}) {
      const key = String(name);
      const existing = regions.get(key);
      if (existing) {
        if (interactive) existing.dataset.interactive = "true";
        return existing;
      }
      const created = hostDocument.createElement("div");
      created.className = "region";
      created.dataset.region = key;
      setStyles(created, REGION_STYLES);
      if (key === "ink") created.style.setProperty("z-index", "1");
      if (key === "avatars") created.style.setProperty("z-index", "2");
      if (interactive) {
        created.dataset.interactive = "true";
        created.style.setProperty("pointer-events", "auto");
      }
      surface.appendChild(created);
      regions.set(key, created);
      return created;
    }

    // Pointer transparency is the default and the safe state. A feature that
    // needs input (the ink composer, the draw affordance) opts in for as long as
    // it is engaged and must hand it back.
    function setInteractive(name, interactive) {
      const target = regions.get(String(name));
      if (!target) return false;
      if (interactive) {
        target.dataset.interactive = "true";
        target.style.setProperty("pointer-events", "auto");
      } else {
        delete target.dataset.interactive;
        target.style.setProperty("pointer-events", "none");
      }
      return true;
    }

    function release(name) {
      const key = String(name);
      const target = regions.get(key);
      if (!target) return false;
      target.remove();
      regions.delete(key);
      return true;
    }

    // One teardown removes every feature's visuals and the layer itself. Partial
    // teardown is a defect: a leftover region outlives the grant that allowed it.
    function destroy() {
      for (const target of regions.values()) target.remove();
      regions.clear();
      host.remove();
      if (hostDocument[STATE_KEY] === layer) delete hostDocument[STATE_KEY];
    }

    const layer = Object.freeze({
      host,
      surface,
      region,
      setInteractive,
      release,
      destroy,
      get regionCount() {
        return regions.size;
      },
      get reducedMotion() {
        return prefersReducedMotion(hostDocument.defaultView);
      }
    });

    return layer;
  }

  function acquire(hostDocument = globalThis.document) {
    if (!hostDocument) return null;
    const existing = hostDocument[STATE_KEY];
    // A layer whose host was removed by page script is stale; replace it rather
    // than handing back a detached node.
    if (existing && existing.host?.isConnected !== false) return existing;
    const layer = createLayer(hostDocument);
    hostDocument[STATE_KEY] = layer;
    return layer;
  }

  function current(hostDocument = globalThis.document) {
    return hostDocument?.[STATE_KEY] || null;
  }

  globalThis.AmbientSharedViewOverlay = Object.freeze({ HOST_ID, acquire, current });
})();
