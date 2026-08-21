(() => {
  "use strict";

  const Contract = globalThis.AmbientSharedViewContract;

  function create(receiverDocument = document) {
    const stateDot = receiverDocument.querySelector("#stateDot");
    const stateLabel = receiverDocument.querySelector("#stateLabel");
    const sourceLabel = receiverDocument.querySelector("#sourceLabel");
    const stopButton = receiverDocument.querySelector("#stopButton");
    const emptyState = receiverDocument.querySelector("#emptyState");
    const viewportFrame = receiverDocument.querySelector("#viewportFrame");
    const viewportCanvas = receiverDocument.querySelector("#viewportCanvas");
    const viewportSurface = receiverDocument.querySelector("#viewportSurface");
    const remoteCursor = receiverDocument.querySelector("#remoteCursor");
    const diagnostics = {
      state: receiverDocument.querySelector("#diagState"),
      sequence: receiverDocument.querySelector("#diagSequence"),
      payload: receiverDocument.querySelector("#diagPayload"),
      upload: receiverDocument.querySelector("#diagUpload"),
      download: receiverDocument.querySelector("#diagDownload"),
      rate: receiverDocument.querySelector("#diagRate"),
      latency: receiverDocument.querySelector("#diagLatency"),
      nodes: receiverDocument.querySelector("#diagNodes"),
      viewport: receiverDocument.querySelector("#diagViewport"),
      display: receiverDocument.querySelector("#diagDisplay")
    };

    let currentSnapshot = null;
    let currentPresence = null;
    let exploreMode = false;
    let localPresence = null;
    let currentScale = 1;
    const loadedRemoteFonts = new Set();

    function formatBytes(bytes) {
      if (!Number.isFinite(bytes)) return "—";
      if (bytes < 1024) return `${bytes} B`;
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    function applySafeStyles(element, styles) {
      const safeStyles = Contract.sanitizeStyleMap(styles);
      for (const [property, value] of Object.entries(safeStyles)) {
        element.style.setProperty(property, value);
      }
    }

    // Scroll offsets cannot be applied before the node is in the document, so
    // they are collected during the build and applied after mounting.
    let pendingScroll = [];
    const nodeById = new Map();
    const failedAssetNodeIds = new Set();
    let onAssetFailure = () => {};

    function buildNode(node, assets = {}) {
      const built = buildNodeInner(node, assets);
      if (Number.isInteger(node?.i) && built) nodeById.set(node.i, built);
      return built;
    }

    function buildNodeInner(node, assets = {}) {
      if (node.type === "text") return receiverDocument.createTextNode(node.text);
      if (node.type === "placeholder") {
        const asset = node.assetId ? assets[node.assetId] : null;
        const imageSource = asset?.dataUrl || Contract.normalizeRemoteAssetUrl(node.remoteUrl);
        if (imageSource) {
          const image = receiverDocument.createElement("img");
          image.className = "shared-view-visual-asset";
          image.alt = node.label;
          image.draggable = false;
          image.decoding = "async";
          image.referrerPolicy = "no-referrer";
          image.src = imageSource;
          applySafeStyles(image, node.styles);
          image.style.width = `${Math.max(1, Number(node.width) || asset?.width || 1)}px`;
          image.style.height = `${Math.max(1, Number(node.height) || asset?.height || 1)}px`;
          image.style.objectFit = "contain";
          if (!asset) {
            image.addEventListener("error", () => {
              image.classList.add("shared-view-visual-asset-failed");
              // A referenced image the guest cannot fetch: session-gated,
              // blocked, or gone. Report it so the host can send the bytes.
              if (Number.isInteger(node.i)) {
                failedAssetNodeIds.add(node.i);
                onAssetFailure(node.i);
              }
            }, { once: true });
          }
          return image;
        }
        const placeholder = receiverDocument.createElement("div");
        placeholder.className = "shared-view-placeholder";
        placeholder.textContent = node.label;
        applySafeStyles(placeholder, node.styles);
        placeholder.style.width = `${Math.max(48, Number(node.width) || 120)}px`;
        placeholder.style.height = `${Math.max(32, Number(node.height) || 72)}px`;
        return placeholder;
      }

      const element = receiverDocument.createElement(Contract.normalizeTag(node.tag));
      applySafeStyles(element, node.styles);
      const attributes = node.attributes || {};
      if (attributes.ariaLabel) element.setAttribute("aria-label", attributes.ariaLabel);
      if (attributes.title) element.title = attributes.title;
      if (attributes.backgroundImageUrl) element.style.backgroundImage = `url(${JSON.stringify(attributes.backgroundImageUrl)})`;
      if (element instanceof HTMLInputElement) {
        element.type = ["checkbox", "radio"].includes(attributes.inputType) ? attributes.inputType : "text";
        element.value = String(attributes.value || "");
        element.checked = Boolean(attributes.checked);
        element.placeholder = String(attributes.placeholder || "");
        element.disabled = true;
      } else if (element instanceof HTMLTextAreaElement) {
        element.value = String(attributes.value || "");
        element.placeholder = String(attributes.placeholder || "");
        element.disabled = true;
      } else if (element instanceof HTMLSelectElement) {
        element.disabled = true;
      } else if (element instanceof HTMLButtonElement) {
        element.disabled = true;
      }
      if (Number.isFinite(attributes.scrollTop) || Number.isFinite(attributes.scrollLeft)) {
        pendingScroll.push([element, Number(attributes.scrollTop) || 0, Number(attributes.scrollLeft) || 0]);
      }
      for (const child of node.children || []) element.appendChild(buildNode(child, assets));
      if (element instanceof HTMLSelectElement && Number.isInteger(attributes.selectedIndex)) {
        element.selectedIndex = attributes.selectedIndex;
      }
      if (element instanceof HTMLOptionElement) element.selected = Boolean(attributes.selected);
      return element;
    }

    function loadRemoteFonts(fonts = []) {
      const FontFaceConstructor = receiverDocument.defaultView?.FontFace;
      if (!FontFaceConstructor || !receiverDocument.fonts) return;
      for (const font of fonts) {
        const source = font.dataUrl || font.url;
        const key = `${font.family}\n${font.weight}\n${font.style}\n${source}`;
        if (loadedRemoteFonts.has(key)) continue;
        loadedRemoteFonts.add(key);
        const face = new FontFaceConstructor(font.family, `url(${JSON.stringify(source)})`, {
          weight: font.weight,
          style: font.style
        });
        receiverDocument.fonts.add(face);
        face.load().catch(() => loadedRemoteFonts.delete(key));
      }
    }

    function updateScale() {
      if (!currentSnapshot) return;
      const width = Math.max(1, currentSnapshot.viewport.width);
      const height = Math.max(1, currentSnapshot.viewport.height);
      viewportFrame.style.width = `${width}px`;
      viewportFrame.style.aspectRatio = `${width} / ${height}`;
      const fitHeight = Number(viewportFrame.dataset.fitHeight);
      const scale = Math.min(
        1,
        viewportFrame.clientWidth / width,
        Number.isFinite(fitHeight) && fitHeight > 0 ? fitHeight / height : 1
      );
      currentScale = scale;
      viewportFrame.style.width = `${Math.round(width * scale)}px`;
      viewportCanvas.style.width = `${width}px`;
      viewportCanvas.style.height = `${height}px`;
      viewportCanvas.style.transform = `scale(${scale})`;
      viewportFrame.style.height = `${Math.round(height * scale)}px`;
    }

    function renderUsage(usage = {}) {
      if (diagnostics.upload) diagnostics.upload.textContent = formatBytes(usage.sentBytes || 0);
      if (diagnostics.download) diagnostics.download.textContent = formatBytes(usage.receivedBytes || 0);
    }

    function applyViewport(viewport) {
      const viewportWidth = Math.max(1, Number(currentSnapshot?.viewport.width) || 1);
      const viewportHeight = Math.max(1, Number(currentSnapshot?.viewport.height) || 1);
      const documentWidth = Math.max(viewportWidth, Number(currentSnapshot?.viewport.documentWidth) || viewportWidth);
      const documentHeight = Math.max(viewportHeight, Number(currentSnapshot?.viewport.documentHeight) || viewportHeight);
      const maximumScrollX = Math.max(0, documentWidth - viewportWidth);
      const maximumScrollY = Math.max(0, documentHeight - viewportHeight);
      const reportedScrollX = Math.max(0, Number(viewport.scrollX) || 0);
      const scrollX = maximumScrollX <= 2 ? 0 : Math.min(reportedScrollX, maximumScrollX);
      const scrollY = Math.min(Math.max(0, Number(viewport.scrollY) || 0), maximumScrollY);
      viewportSurface.style.transform = `translate3d(${-scrollX}px, ${-scrollY}px, 0)`;
    }

    function applyRemoteCursor(presence, visibleViewport) {
      if (!presence?.cursor.visible || !visibleViewport || !currentSnapshot) {
        remoteCursor.hidden = true;
        return;
      }
      const x = presence.viewport.scrollX + presence.cursor.x - visibleViewport.scrollX;
      const y = presence.viewport.scrollY + presence.cursor.y - visibleViewport.scrollY;
      remoteCursor.hidden = x < 0 || y < 0 || x > currentSnapshot.viewport.width || y > currentSnapshot.viewport.height;
      remoteCursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    function applyPresence(presence) {
      applyViewport(presence.viewport);
      applyRemoteCursor(presence, presence.viewport);
    }

    function renderPresence(presence) {
      if (!Contract.validatePresence(presence)) return false;
      currentPresence = presence;
      if (!currentSnapshot || currentSnapshot.sessionId !== presence.sessionId) return true;
      if (exploreMode) {
        const visibleViewport = localPresence?.viewport || {
          scrollX: currentSnapshot.viewport.scrollX,
          scrollY: currentSnapshot.viewport.scrollY
        };
        applyRemoteCursor(presence, visibleViewport);
      } else {
        applyPresence(presence);
      }
      return true;
    }

    function renderLocalPresence(presence) {
      if (
        !presence ||
        !presence.viewport ||
        !Number.isFinite(presence.viewport.scrollX) ||
        !Number.isFinite(presence.viewport.scrollY) ||
        !presence.cursor ||
        !Number.isFinite(presence.cursor.x) ||
        !Number.isFinite(presence.cursor.y) ||
        typeof presence.cursor.visible !== "boolean"
      ) {
        return false;
      }
      localPresence = presence;
      if (exploreMode && currentSnapshot) {
        applyViewport(presence.viewport);
        applyRemoteCursor(
          currentPresence?.sessionId === currentSnapshot.sessionId ? currentPresence : null,
          presence.viewport
        );
      }
      return true;
    }

    function setExploreMode(enabled) {
      exploreMode = Boolean(enabled);
      if (!currentSnapshot) return;
      if (exploreMode) {
        const fallback = {
          viewport: { scrollX: currentSnapshot.viewport.scrollX, scrollY: currentSnapshot.viewport.scrollY },
          cursor: { x: 0, y: 0, visible: false }
        };
        const visiblePresence = localPresence || fallback;
        applyViewport(visiblePresence.viewport);
        applyRemoteCursor(
          currentPresence?.sessionId === currentSnapshot.sessionId ? currentPresence : null,
          visiblePresence.viewport
        );
      } else {
        const fallback = {
          viewport: { scrollX: currentSnapshot.viewport.scrollX, scrollY: currentSnapshot.viewport.scrollY },
          cursor: { x: 0, y: 0, visible: false }
        };
        applyPresence(currentPresence && currentPresence.sessionId === currentSnapshot.sessionId ? currentPresence : fallback);
      }
    }

    function getViewportMetrics() {
      if (!currentSnapshot) return null;
      return Object.freeze({
        width: currentSnapshot.viewport.width,
        height: currentSnapshot.viewport.height,
        documentWidth: currentSnapshot.viewport.documentWidth || currentSnapshot.viewport.width,
        documentHeight: currentSnapshot.viewport.documentHeight || currentSnapshot.viewport.height,
        scale: currentScale
      });
    }

    function renderSnapshot(snapshot, relayDiagnostics = {}) {
      if (!Contract.validateSnapshot(snapshot)) {
        showEnded("Receiver rejected an invalid snapshot.");
        return false;
      }
      currentSnapshot = snapshot;
      loadRemoteFonts(snapshot.fonts || []);
      pendingScroll = [];
      nodeById.clear();
      const renderedRoot = buildNode(snapshot.root, snapshot.assets || {});
      renderedRoot.style.minHeight = `${Math.max(snapshot.viewport.height, snapshot.viewport.documentHeight || 0)}px`;
      viewportSurface.replaceChildren(renderedRoot);
      for (const [element, top, left] of pendingScroll) {
        if (top) element.scrollTop = top;
        if (left) element.scrollLeft = left;
      }
      pendingScroll = [];
      viewportSurface.style.width = `${snapshot.viewport.width}px`;
      viewportSurface.style.minHeight = `${snapshot.viewport.documentHeight}px`;
      const snapshotPresence = {
        viewport: { scrollX: snapshot.viewport.scrollX, scrollY: snapshot.viewport.scrollY },
        cursor: { x: 0, y: 0, visible: false }
      };
      if (exploreMode) {
        const visiblePresence = localPresence || snapshotPresence;
        applyViewport(visiblePresence.viewport);
        applyRemoteCursor(
          currentPresence?.sessionId === snapshot.sessionId ? currentPresence : null,
          visiblePresence.viewport
        );
      }
      else applyPresence(currentPresence && currentPresence.sessionId === snapshot.sessionId ? currentPresence : snapshotPresence);
      emptyState.hidden = true;
      viewportFrame.hidden = false;
      stateDot.className = "state-dot live";
      stateLabel.textContent = "Live, inert representation";
      sourceLabel.textContent = `${snapshot.source.title} · ${snapshot.source.origin}${snapshot.source.path}`;
      stopButton.disabled = false;

      diagnostics.state.textContent = "sharing";
      diagnostics.sequence.textContent = String(snapshot.sequence);
      diagnostics.payload.textContent = formatBytes(relayDiagnostics.payloadBytes);
      diagnostics.rate.textContent = Number.isFinite(relayDiagnostics.updatesPerSecond)
        ? String(relayDiagnostics.updatesPerSecond)
        : "—";
      diagnostics.latency.textContent = `${Math.max(0, Date.now() - snapshot.capturedAt)} ms`;
      diagnostics.nodes.textContent = snapshot.diagnostics.truncated
        ? `${snapshot.diagnostics.nodeCount}+`
        : String(snapshot.diagnostics.nodeCount);
      if (diagnostics.viewport) {
        diagnostics.viewport.textContent = `${Math.round(snapshot.viewport.width)}×${Math.round(snapshot.viewport.height)} CSS px`;
      }
      if (diagnostics.display) {
        diagnostics.display.textContent = snapshot.display
          ? `${Math.round(snapshot.display.screenWidth)}×${Math.round(snapshot.display.screenHeight)} @${Number(snapshot.display.pixelRatio).toFixed(1)}×`
          : "Unavailable";
      }
      updateScale();
      return true;
    }

    function renderPatch(patch, relayDiagnostics = {}) {
      if (!currentSnapshot) return false;
      const nextSnapshot = Contract.applySnapshotPatch(currentSnapshot, patch);
      if (!nextSnapshot) return false;
      return renderSnapshot(nextSnapshot, relayDiagnostics);
    }

    function showStatus(state, message = "Waiting for the first shared frame.") {
      diagnostics.state.textContent = state;
      if (state === "sharing" || state === "active") {
        stateLabel.textContent = "Connected; waiting for live state";
        sourceLabel.textContent = message;
      }
    }

    function showEnded(message) {
      stateDot.className = "state-dot ended";
      stateLabel.textContent = "Sharing ended";
      sourceLabel.textContent = message;
      stopButton.disabled = true;
      diagnostics.state.textContent = "ended";
    }

    return Object.freeze({
      renderSnapshot,
      renderPatch,
      renderPresence,
      renderLocalPresence,
      renderUsage,
      setExploreMode,
      getViewportMetrics,
      showEnded,
      showStatus,
      stopButton,
      viewportFrame,
      updateScale,
      failedAssetNodeIds,
      onAssetFailure(handler) {
        onAssetFailure = typeof handler === "function" ? handler : () => {};
      },
      // Node identity for anchoring. Rebuilt on every render from the ids the
      // snapshot carries, so it cannot drift from what the host sent.
      nodeById
    });
  }

  globalThis.AmbientSharedViewRenderer = Object.freeze({ create });
})();
