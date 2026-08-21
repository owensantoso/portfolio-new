"use strict";

const Session = globalThis.AmbientSharedViewSession;
const Transport = globalThis.AmbientSharedViewTransport;
const Anchor = globalThis.AmbientSharedViewAnchor;
const Ink = globalThis.AmbientSharedViewInk;
const Avatar = globalThis.AmbientSharedViewAvatar;
const renderer = globalThis.AmbientSharedViewRenderer.create(document);
const updateTimes = [];
const joinPanel = document.querySelector("#joinPanel");
const displayNameInput = document.querySelector("#displayName");
const joinButton = document.querySelector("#joinButton");
const pairingPanel = document.querySelector("#pairingPanel");
const pairingCode = document.querySelector("#pairingCode");
const confirmPairingButton = document.querySelector("#confirmPairingButton");
const modePanel = document.querySelector("#modePanel");
const modeLabel = document.querySelector("#modeLabel");
const modeDescription = document.querySelector("#modeDescription");
const grantCountdown = document.querySelector("#grantCountdown");
const presenceShareButton = document.querySelector("#presenceShareButton");
const inkShareButton = document.querySelector("#inkShareButton");
const avatarShareButton = document.querySelector("#avatarShareButton");
const chatLayer = document.querySelector("#chatLayer");
const chatBubbles = document.querySelector("#chatBubbles");
const chatLauncher = document.querySelector("#chatLauncher");
const chatComposer = document.querySelector("#chatComposer");
const chatInput = document.querySelector("#chatInput");
const viewerShell = document.querySelector(".viewer-shell");
const viewerStage = document.querySelector("#viewerStage");
const projectionLabel = document.querySelector("#projectionLabel");
const projectionChrome = document.querySelector(".projection-chrome");
const mediaSurface = document.querySelector("#mediaSurface");
const mediaVideo = document.querySelector("#mediaVideo");
const mediaStatus = document.querySelector("#mediaStatus");
const pipButton = document.querySelector("#pipButton");
const stateDot = document.querySelector("#stateDot");
const stateLabel = document.querySelector("#stateLabel");
const sourceLabel = document.querySelector("#sourceLabel");
const diagState = document.querySelector("#diagState");
const diagnostics = document.querySelector("#diagnostics");
const debugButton = document.querySelector("#debugButton");
const viewportSurface = document.querySelector("#viewportSurface");

let socket = null;
let interactiveGuest = null;
let interactiveCapabilities = new Set();
let exploreEnabled = false;
let presenceCapabilityAvailable = false;
let localViewport = { scrollX: 0, scrollY: 0 };
let localCursor = { x: 0, y: 0, visible: false };
let presenceTimer = null;
let inkSurface = null;
let guestInkEnabled = false;
let guestInkPointerId = null;
let avatarSurface = null;
let guestAvatarEnabled = false;
let grantExpiry = 0;
let countdownTimer = null;
let hostDisplayName = "Owen";
let guestDisplayName = "Guest";
let chatOpenScrollPosition = null;
let mobileKeyboardWasVisible = false;
let keyboardFitRecoveryTimer = null;
let keyboardFitRecoveryVersion = 0;
let mediaRoom = null;
let mediaTrack = null;
const MAX_CHAT_HISTORY = 100;
const legacyUsage = { sentBytes: 0, receivedBytes: 0, sentMessages: 0, receivedMessages: 0 };

function isPageTextEntry(target) {
  return Boolean(target && (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  ));
}

function openAvatarChatOnEnter(event) {
  if (
    !guestAvatarEnabled || event.key !== "Enter" || event.repeat || event.isComposing ||
    event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.defaultPrevented ||
    chatLayer.hidden || chatLauncher.disabled || !chatComposer.hidden ||
    isPageTextEntry(event.target)
  ) return;
  event.preventDefault();
  event.stopPropagation();
  setChatComposerOpen(true);
}

window.addEventListener("keydown", openAvatarChatOnEnter, true);

const liveMirrorIndex = Object.freeze({
  elementForId: (id) => renderer.nodeById.get(id) || null,
  elementForPath: (path) => Anchor.createDomMirrorIndex(viewportSurface.firstChild, renderer.nodeById).elementForPath(path),
  pathForElement: (element) => Anchor.createDomMirrorIndex(viewportSurface.firstChild, renderer.nodeById).pathForElement(element),
  idForElement: (element) => {
    for (const [id, candidate] of renderer.nodeById) if (candidate === element) return id;
    return null;
  }
});

function ensureAvatarSurface() {
  if (avatarSurface || !Avatar) return avatarSurface;
  avatarSurface = Avatar.create({
    hostDocument: document,
    index: liveMirrorIndex,
    role: "guest",
    viewport: () => {
      const rect = renderer.viewportFrame.getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    }
  });
  avatarSurface?.setNames({ local: guestDisplayName, remote: hostDisplayName });
  avatarSurface?.onEmit((frame) => {
    interactiveGuest?.publishAvatar(frame).catch((error) => {
      setState("error", "Avatar position was not sent", error.message || String(error));
    });
  });
  return avatarSurface;
}

function setGuestAvatarEnabled(enabled) {
  guestAvatarEnabled = Boolean(enabled && interactiveCapabilities.has("avatar.publish"));
  if (guestAvatarEnabled) ensureAvatarSurface()?.start();
  else {
    avatarSurface?.destroy();
    avatarSurface = null;
  }
  avatarShareButton.textContent = guestAvatarEnabled ? "Stop avatar" : "Play as avatar";
  avatarShareButton.setAttribute("aria-pressed", String(guestAvatarEnabled));
}

function ensureInkSurface() {
  if (inkSurface || !Ink) return inkSurface;
  inkSurface = Ink.create({
    hostDocument: document,
    index: liveMirrorIndex,
    viewport: () => {
      const rect = renderer.viewportFrame.getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    }
  });
  inkSurface?.onEmit((frame) => {
    interactiveGuest?.publishInk(frame).catch((error) => {
      setState("error", "Ink was not sent", error.message || String(error));
    });
  });
  return inkSurface;
}

function setGuestInkEnabled(enabled) {
  guestInkEnabled = Boolean(enabled && interactiveCapabilities.has("ink.publish"));
  if (!guestInkEnabled) guestInkPointerId = null;
  if (!guestInkEnabled) inkSurface?.clearOwn("guest");
  inkShareButton.textContent = guestInkEnabled ? "Stop drawing" : "Draw laser";
  inkShareButton.setAttribute("aria-pressed", String(guestInkEnabled));
}

function guestInkPoint(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (viewportSurface.contains(element)) {
    return Anchor.fromPointer(liveMirrorIndex, element, event.clientX, event.clientY, {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollY: localViewport.scrollY
    });
  }
  const rect = renderer.viewportFrame.getBoundingClientRect();
  return Anchor.freePoint(
    (event.clientX - rect.left) / Math.max(1, rect.width),
    (event.clientY - rect.top) / Math.max(1, rect.height),
    localViewport.scrollY
  );
}

function handleGuestInkPointerDown(event) {
  if (!guestInkEnabled || event.button !== 0) return;
  const point = guestInkPoint(event);
  const surface = ensureInkSurface();
  if (!point || !surface) return;
  guestInkPointerId = event.pointerId;
  surface.beginLocal({ mode: "laser", color: 0, width: 3, sender: "guest" });
  surface.extendLocal(point);
  try { renderer.viewportFrame.setPointerCapture(event.pointerId); } catch (_error) {}
  event.preventDefault();
  event.stopPropagation();
}

function handleGuestInkPointerMove(event) {
  if (!guestInkEnabled || event.pointerId !== guestInkPointerId) return;
  const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
  for (const sample of samples.length ? samples : [event]) {
    const point = guestInkPoint(sample);
    if (point) inkSurface?.extendLocal(point);
  }
  event.preventDefault();
  event.stopPropagation();
}

function handleGuestInkPointerEnd(event) {
  if (event.pointerId !== guestInkPointerId) return;
  guestInkPointerId = null;
  inkSurface?.endLocal();
  event.preventDefault();
  event.stopPropagation();
}

function encodedBytes(value) {
  return new TextEncoder().encode(String(value)).byteLength;
}

function legacySend(message) {
  const encoded = JSON.stringify(message);
  legacyUsage.sentBytes += encodedBytes(encoded);
  legacyUsage.sentMessages += 1;
  socket.send(encoded);
  renderer.renderUsage(legacyUsage);
}

function webSocketUrl() {
  if (location.hostname === "owensantoso.com" || location.hostname === "www.owensantoso.com") {
    return "wss://ssh.owensantoso.com/shared-view/relay";
  }
  const url = new URL("/relay", location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.hash = "";
  return url.href;
}

function payloadSize(envelope) {
  return new TextEncoder().encode(JSON.stringify(envelope)).byteLength;
}

function updateRate() {
  const now = Date.now();
  updateTimes.push(now);
  while (updateTimes.length && updateTimes[0] < now - 1000) updateTimes.shift();
  return updateTimes.length;
}

function setState(state, title, message) {
  diagState.textContent = state;
  stateLabel.textContent = title;
  sourceLabel.textContent = message;
}

function setProjectionConnectionState(state) {
  viewerStage.dataset.connectionState = state;
  const labels = {
    live: `Live shared view from ${hostDisplayName}`,
    paused: `Paused shared view from ${hostDisplayName}; the last frame is frozen`,
    waiting: `Waiting for ${hostDisplayName}'s shared view`,
    ended: `Ended shared view from ${hostDisplayName}`
  };
  projectionChrome.setAttribute("aria-label", labels[state] || labels.waiting);
}

function setMediaState(state, label) {
  mediaSurface.dataset.state = state;
  viewerStage.dataset.mediaState = state;
  mediaStatus.lastChild.textContent = ` ${label}`;
  pipButton.disabled = state !== "live";
}

function isScreenShareTrack(track, publication) {
  if (String(track?.kind || "").toLowerCase() !== "video") return false;
  return String(publication?.source || track?.source || "").toLowerCase().includes("screen");
}

function attachMediaTrack(track, publication) {
  if (!isScreenShareTrack(track, publication)) return;
  if (mediaTrack && mediaTrack !== track) mediaTrack.detach(mediaVideo);
  mediaTrack = track;
  track.attach(mediaVideo);
  mediaSurface.hidden = false;
  setMediaState("live", "Full Pixels live");
  mediaVideo.play().catch(() => {});
}

function detachMediaTrack(track = mediaTrack, ended = false) {
  if (track) track.detach(mediaVideo);
  if (track === mediaTrack) mediaTrack = null;
  if (!mediaSurface.hidden) setMediaState(ended ? "ended" : "paused", ended ? "Full Pixels ended" : "Full Pixels paused");
}

async function startMediaLane() {
  if (mediaRoom || !interactiveGuest?.status().mediaAvailable) return;
  const LiveKit = globalThis.LivekitClient;
  if (!LiveKit?.Room || !LiveKit?.RoomEvent) return;
  const access = await interactiveGuest.requestMediaAccess();
  const room = new LiveKit.Room({ adaptiveStream: true, dynacast: true });
  mediaRoom = room;
  room.on(LiveKit.RoomEvent.TrackSubscribed, attachMediaTrack);
  room.on(LiveKit.RoomEvent.TrackUnsubscribed, (track) => {
    if (track === mediaTrack) detachMediaTrack(track);
  });
  room.on(LiveKit.RoomEvent.TrackMuted, (publication) => {
    if (publication?.track === mediaTrack) setMediaState("paused", "Full Pixels paused");
  });
  room.on(LiveKit.RoomEvent.TrackUnmuted, (publication) => {
    if (publication?.track === mediaTrack) setMediaState("live", "Full Pixels live");
  });
  room.on(LiveKit.RoomEvent.Disconnected, () => {
    detachMediaTrack(mediaTrack, true);
    mediaRoom = null;
  });
  try {
    await room.connect(access.url, access.token, { autoSubscribe: true });
  } catch (error) {
    mediaRoom = null;
    room.disconnect();
    throw error;
  }
}

function endMediaLane() {
  detachMediaTrack(mediaTrack, true);
  mediaRoom?.disconnect();
  mediaRoom = null;
}

async function togglePictureInPicture() {
  if (document.pictureInPictureElement === mediaVideo) {
    await document.exitPictureInPicture();
    return;
  }
  if (typeof mediaVideo.requestPictureInPicture === "function") {
    await mediaVideo.requestPictureInPicture();
    return;
  }
  if (typeof mediaVideo.webkitSetPresentationMode === "function") {
    mediaVideo.webkitSetPresentationMode("picture-in-picture");
    return;
  }
  throw new Error("Picture in Picture is unavailable in this browser.");
}

function appendChat(chat, displayName) {
  const bubble = document.createElement("div");
  const messageSide = chat.sender === "guest" ? "local" : "remote";
  bubble.className = `chat-bubble ${messageSide}`;
  const message = document.createElement("span");
  message.textContent = chat.text;
  if (messageSide === "remote") {
    const author = document.createElement("strong");
    author.textContent = displayName;
    bubble.append(author);
  }
  bubble.append(message);
  chatBubbles.appendChild(bubble);
  chatLayer.dataset.hasHistory = "true";
  while (chatBubbles.children.length > MAX_CHAT_HISTORY) chatBubbles.firstElementChild?.remove();
  chatBubbles.scrollTop = chatBubbles.scrollHeight;
}

function scheduleKeyboardFitRecovery() {
  const version = ++keyboardFitRecoveryVersion;
  clearTimeout(keyboardFitRecoveryTimer);
  let recovered = false;
  const recover = () => {
    if (recovered || version !== keyboardFitRecoveryVersion) return;
    recovered = true;
    clearTimeout(keyboardFitRecoveryTimer);
    viewerShell.removeEventListener("transitionend", handleTransitionEnd);
    const frame = renderer.viewportFrame;
    const canvas = frame.querySelector(".viewport-canvas");
    const previousWidth = frame.style.width;
    const previousHeight = frame.style.height;
    const previousTransform = canvas?.style.transform || "";
    delete frame.dataset.animateFit;
    renderer.updateScale();
    const targetWidth = frame.style.width;
    const targetHeight = frame.style.height;
    const targetTransform = canvas?.style.transform || "";
    frame.style.width = previousWidth;
    frame.style.height = previousHeight;
    if (canvas) canvas.style.transform = previousTransform;
    void frame.offsetWidth;
    frame.dataset.animateFit = "true";
    requestAnimationFrame(() => {
      if (version !== keyboardFitRecoveryVersion) return;
      frame.style.width = targetWidth;
      frame.style.height = targetHeight;
      if (canvas) canvas.style.transform = targetTransform;
    });
  };
  const handleTransitionEnd = (event) => {
    if (event.target === viewerShell && event.propertyName === "width") recover();
  };
  viewerShell.addEventListener("transitionend", handleTransitionEnd);
  keyboardFitRecoveryTimer = setTimeout(() => {
    recover();
  }, 320);
}

function fitViewerAroundKeyboard() {
  const visualViewport = window.visualViewport;
  const mobileChatOpen = window.innerWidth <= 720 && !chatComposer.hidden;
  const keyboardVisible = Boolean(
    visualViewport &&
    mobileChatOpen &&
    window.innerHeight - visualViewport.height > 80
  );
  if (!mobileChatOpen) {
    const wasKeyboardFit = viewerStage.dataset.keyboardFit === "true";
    mobileKeyboardWasVisible = false;
    delete renderer.viewportFrame.dataset.fitHeight;
    viewerStage.dataset.keyboardFit = "false";
    delete chatLayer.dataset.layout;
    renderer.updateScale();
    if (wasKeyboardFit) scheduleKeyboardFitRecovery();
    return;
  }
  viewerStage.dataset.keyboardFit = "true";
  chatLayer.dataset.layout = "sidecar";
  if (!keyboardVisible) {
    if (mobileKeyboardWasVisible) {
      mobileKeyboardWasVisible = false;
      setChatComposerOpen(false);
      return;
    }
    delete renderer.viewportFrame.dataset.fitHeight;
    renderer.updateScale();
    return;
  }
  mobileKeyboardWasVisible = true;
  keyboardFitRecoveryVersion += 1;
  clearTimeout(keyboardFitRecoveryTimer);
  const shellRect = viewerShell.getBoundingClientRect();
  const shellStyle = getComputedStyle(viewerShell);
  const verticalPadding = parseFloat(shellStyle.paddingTop) + parseFloat(shellStyle.paddingBottom)
    + parseFloat(shellStyle.borderTopWidth) + parseFloat(shellStyle.borderBottomWidth);
  const phoneChrome = viewerShell.querySelector(".projection-chrome");
  const fixedPhoneChrome = phoneChrome && getComputedStyle(phoneChrome).position !== "absolute" ? phoneChrome.offsetHeight : 0;
  const homeIndicator = viewerShell.querySelector(".phone-home-indicator");
  const fixedPhoneFooter = homeIndicator && getComputedStyle(homeIndicator).display !== "none"
    && getComputedStyle(homeIndicator).position !== "absolute"
    ? homeIndicator.offsetHeight + 12
    : 0;
  const shellTopInsideVisibleArea = Math.max(0, shellRect.top - visualViewport.offsetTop);
  const availableHeight = Math.max(
    120,
    visualViewport.height - shellTopInsideVisibleArea - verticalPadding - fixedPhoneChrome - fixedPhoneFooter - 10
  );
  renderer.viewportFrame.dataset.animateFit = "true";
  renderer.viewportFrame.dataset.fitHeight = String(Math.floor(availableHeight));
  renderer.updateScale();
}

function isPhoneLikeViewport(metrics) {
  return Boolean(metrics && metrics.height > metrics.width * 1.25 && metrics.width <= 600);
}

function updateProjectionPresentation() {
  const phoneLike = isPhoneLikeViewport(renderer.getViewportMetrics());
  viewerStage.dataset.device = phoneLike ? "phone" : "screen";
  projectionLabel.textContent = hostDisplayName;
  setProjectionConnectionState(viewerStage.dataset.connectionState || "waiting");
}

function setChatComposerOpen(open) {
  if (open && window.innerWidth <= 720) chatOpenScrollPosition = { x: window.scrollX, y: window.scrollY };
  chatComposer.hidden = !open;
  chatLayer.dataset.open = String(open);
  chatLauncher.setAttribute("aria-expanded", String(open));
  chatLauncher.setAttribute("aria-label", open ? "Close chat" : "Open chat");
  if (open) {
    if (window.innerWidth <= 720) {
      viewerStage.dataset.keyboardFit = "true";
      chatLayer.dataset.layout = "sidecar";
      renderer.updateScale();
    }
    chatInput.focus({ preventScroll: true });
    const restorePosition = chatOpenScrollPosition;
    if (restorePosition) {
      requestAnimationFrame(() => {
        window.scrollTo(restorePosition.x, restorePosition.y);
        fitViewerAroundKeyboard();
      });
    }
  } else {
    chatInput.blur();
    chatOpenScrollPosition = null;
    delete chatLayer.dataset.layout;
  }
  fitViewerAroundKeyboard();
}

function setChatEnabled(enabled) {
  chatLayer.hidden = !enabled;
  chatLauncher.disabled = !enabled;
  delete chatLayer.dataset.disconnected;
  if (!enabled) {
    setChatComposerOpen(false);
    chatBubbles.replaceChildren();
    chatLayer.dataset.hasHistory = "false";
  }
}

function updateCountdown() {
  if (!grantExpiry) {
    grantCountdown.textContent = "";
    return;
  }
  const remaining = Math.max(0, grantExpiry - Date.now());
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  grantCountdown.textContent = `${minutes}:${String(seconds).padStart(2, "0")} remaining`;
}

function renderPresenceMode() {
  renderer.setExploreMode(exploreEnabled);
  presenceShareButton.hidden = !presenceCapabilityAvailable;
  presenceShareButton.disabled = false;
  presenceShareButton.textContent = exploreEnabled ? "Stop sharing pointer" : "Share pointer & viewport";
  inkShareButton.hidden = !interactiveCapabilities.has("ink.publish");
  inkShareButton.disabled = false;
  inkShareButton.textContent = guestInkEnabled ? "Stop drawing" : "Draw laser";
  avatarShareButton.hidden = !interactiveCapabilities.has("avatar.publish");
  avatarShareButton.disabled = false;
  avatarShareButton.textContent = guestAvatarEnabled ? "Stop avatar" : "Play as avatar";
  modeLabel.textContent = exploreEnabled
    ? "Explore + Point"
    : (presenceCapabilityAvailable ? "Pointing available" : "Presenter-follow");
  modeDescription.textContent = exploreEnabled
    ? "Your scrolling stays in this inert copy; your viewport and pointer are visible to the host."
    : (presenceCapabilityAvailable
      ? "The host allowed pointing. Nothing is published until you start sharing."
      : "Following the host. Your page remains inert.");
}

function applyGrant(event) {
  const inkWasAvailable = interactiveCapabilities.has("ink.publish");
  const avatarWasAvailable = interactiveCapabilities.has("avatar.publish");
  interactiveCapabilities = new Set(event.capabilities);
  hostDisplayName = String(event.grant?.hostDisplayName || "Owen").trim().slice(0, 40) || "Owen";
  avatarSurface?.setNames({ local: guestDisplayName, remote: hostDisplayName });
  updateProjectionPresentation();
  grantExpiry = event.grant.expiresAt;
  clearInterval(countdownTimer);
  countdownTimer = setInterval(updateCountdown, 1000);
  updateCountdown();
  presenceCapabilityAvailable = interactiveCapabilities.has("presence.publish");
  if (!presenceCapabilityAvailable) exploreEnabled = false;
  if (!interactiveCapabilities.has("ink.publish")) {
    setGuestInkEnabled(false);
    if (inkWasAvailable) inkSurface?.clearAll();
  }
  if (!interactiveCapabilities.has("avatar.publish")) setGuestAvatarEnabled(false);
  else if (!avatarWasAvailable) setGuestAvatarEnabled(true);
  modePanel.hidden = false;
  renderPresenceMode();
  setChatEnabled(interactiveCapabilities.has("chat.send"));
  pairingPanel.hidden = true;
  setState("ready", "Paired with the host", presenceCapabilityAvailable
    ? "The host offered pointing; choose whether to share."
    : "Waiting for the host's live view.");
  startMediaLane().catch(() => {
    if (!mediaSurface.hidden) setMediaState("ended", "Full Pixels unavailable");
  });
}

function clampLocalViewport() {
  const metrics = renderer.getViewportMetrics();
  if (!metrics) return;
  localViewport.scrollX = Math.max(0, Math.min(localViewport.scrollX, Math.max(0, metrics.documentWidth - metrics.width)));
  localViewport.scrollY = Math.max(0, Math.min(localViewport.scrollY, Math.max(0, metrics.documentHeight - metrics.height)));
}

function renderLocalPresence() {
  renderer.renderLocalPresence({ viewport: { ...localViewport }, cursor: { ...localCursor } });
}

function scheduleGuestPresence() {
  if (!exploreEnabled || !interactiveGuest || presenceTimer) return;
  presenceTimer = setTimeout(async () => {
    presenceTimer = null;
    try {
      await interactiveGuest.publishPresence({
        sharing: true,
        viewport: { ...localViewport },
        cursor: { ...localCursor }
      });
    } catch (_error) {
      // A revoked grant is reflected by the next grant/status event.
    }
  }, 100);
}

function handleInteractiveEvent(event) {
  if (event.type === "usage") {
    renderer.renderUsage(event.usage);
    return;
  }
  if (event.type === "status" && ["disconnected", "ended"].includes(event.state)) {
    clearInterval(countdownTimer);
    grantCountdown.textContent = "Ended";
    setChatComposerOpen(false);
    chatLayer.dataset.disconnected = "true";
    chatLauncher.disabled = true;
    setProjectionConnectionState("ended");
    endMediaLane();
    setGuestInkEnabled(false);
    inkSurface?.clearAll();
    setGuestAvatarEnabled(false);
    renderer.showEnded(event.state === "disconnected"
      ? "Connection lost. This is the last received frame and it is no longer live."
      : "The host ended this Shared View. The last inert frame remains visible.");
    return;
  }
  if (event.type === "pairing") {
    joinPanel.hidden = true;
    pairingPanel.hidden = !event.verificationRequired;
    pairingCode.textContent = event.sas;
    confirmPairingButton.disabled = false;
    setState(
      "pairing",
      event.verificationRequired ? "Compare the pairing code" : "Host approved your name",
      event.verificationRequired
        ? "The host sees the same three number groups."
        : "Securing the encrypted session without a manual code check."
    );
    return;
  }
  if (event.type === "pairing-confirmed" && event.role === "host") {
    setState("pairing", "Host confirmed the code", "Waiting for both confirmations and a view grant.");
    return;
  }
  if (event.type === "grant") {
    applyGrant(event);
    return;
  }
  if (event.type === "snapshot") {
    renderer.renderSnapshot(event.snapshot, { updatesPerSecond: updateRate() });
    setProjectionConnectionState("live");
    updateProjectionPresentation();
    clampLocalViewport();
    if (exploreEnabled) renderLocalPresence();
    return;
  }
  if (event.type === "patch") {
    if (!renderer.renderPatch(event.patch, { updatesPerSecond: updateRate() })) {
      renderer.showEnded("The incremental update did not match this viewer's checkpoint.");
      interactiveGuest?.leave();
      return;
    }
    setProjectionConnectionState("live");
    clampLocalViewport();
    if (exploreEnabled) renderLocalPresence();
    return;
  }
  if (event.type === "host-presence") {
    renderer.renderPresence(event.presence);
    return;
  }
  if (event.type === "ink") {
    ensureInkSurface()?.applyFrame(event.frame);
    return;
  }
  if (event.type === "avatar") {
    const surface = ensureAvatarSurface();
    surface?.setNames({ local: guestDisplayName, remote: event.displayName || hostDisplayName });
    surface?.applyFrame(event.frame);
    return;
  }
  if (event.type === "chat") {
    appendChat(event.chat, event.chat.sender === "guest" ? "You" : event.displayName || hostDisplayName);
    avatarSurface?.showChat(event.chat.sender, event.chat.text);
    return;
  }
  if (event.type === "host-paused") {
    clearInterval(countdownTimer);
    grantCountdown.textContent = "Reconnecting…";
    setChatComposerOpen(false);
    chatLayer.dataset.disconnected = "paused";
    chatLauncher.disabled = true;
    setGuestInkEnabled(false);
    inkShareButton.disabled = true;
    setGuestAvatarEnabled(false);
    avatarShareButton.disabled = true;
    stateDot.className = "state-dot paused";
    setProjectionConnectionState("paused");
    setState("paused", "Host temporarily paused", "Safari interrupted the host connection. The last frame remains visible while it reconnects.");
    return;
  }
  if (event.type === "host-resumed") {
    clearInterval(countdownTimer);
    countdownTimer = setInterval(updateCountdown, 1000);
    updateCountdown();
    delete chatLayer.dataset.disconnected;
    chatLauncher.disabled = !interactiveCapabilities.has("chat.send");
    renderPresenceMode();
    stateDot.className = "state-dot";
    setProjectionConnectionState("waiting");
    setState("ready", "Host reconnected", "Waiting for the host's refreshed view.");
    return;
  }
  if (event.type === "removed") {
    clearInterval(countdownTimer);
    grantCountdown.textContent = "Ended";
    setChatEnabled(false);
    setGuestInkEnabled(false);
    inkSurface?.clearAll();
    endMediaLane();
    renderer.showEnded(`The host removed this guest (${event.reason || "removed"}).`);
    return;
  }
  if (event.type === "error") {
    setState("error", "The interactive room reported an error", event.code || "relay-error");
  }
}

async function startInteractiveJoin() {
  guestDisplayName = String(displayNameInput.value || "Guest").trim().slice(0, 40) || "Guest";
  joinButton.disabled = true;
  displayNameInput.disabled = true;
  setState("requesting", "Requesting access", "No page state is available until the host approves.");
  try {
    interactiveGuest = await Transport.createInteractiveGuest({
      inviteUrl: location.href,
      relayUrl: webSocketUrl(),
      displayName: displayNameInput.value,
      onEvent: handleInteractiveEvent
    });
    await interactiveGuest.connect();
    renderer.stopButton.disabled = false;
    setState("waiting", "Waiting for host approval", "The invitation alone does not grant view access.");
  } catch (error) {
    joinButton.disabled = false;
    displayNameInput.disabled = false;
    setState("error", "Could not request access", error.message || String(error));
  }
}

async function startLegacy() {
  let invitation;
  try {
    invitation = await Session.parseInvitation(location.href);
  } catch (error) {
    renderer.showEnded(error.message || "This invitation is invalid.");
    return;
  }

  socket = new WebSocket(webSocketUrl());
  renderer.stopButton.disabled = false;
  socket.addEventListener("open", () => {
    legacySend({ type: "room-view", version: 0, roomId: invitation.roomId });
    renderer.showStatus("connected", "Connected to the encrypted relay; waiting for a frame.");
  });
  socket.addEventListener("message", async (event) => {
    legacyUsage.receivedBytes += encodedBytes(event.data);
    legacyUsage.receivedMessages += 1;
    renderer.renderUsage(legacyUsage);
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch (_error) {
      renderer.showEnded("The relay sent an invalid message.");
      socket.close();
      return;
    }
    if (message.type === "room-status") {
      renderer.showStatus(message.state, `${message.viewers} linked viewer${message.viewers === 1 ? "" : "s"}.`);
      return;
    }
    if (message.type === "room-frame") {
      try {
        const snapshot = await Session.decryptSnapshot({ envelope: message.envelope, roomId: invitation.roomId, key: invitation.key });
        renderer.renderSnapshot(snapshot, { payloadBytes: payloadSize(message.envelope), updatesPerSecond: updateRate() });
        updateProjectionPresentation();
      } catch (_error) {
        renderer.showEnded("This frame failed authenticated decryption or validation.");
        socket.close();
      }
      return;
    }
    if (message.type === "room-patch") {
      try {
        const patch = await Session.decryptPatch({ envelope: message.envelope, roomId: invitation.roomId, key: invitation.key });
        const rendered = renderer.renderPatch(patch, { payloadBytes: payloadSize(message.envelope), updatesPerSecond: updateRate() });
        if (!rendered) throw new Error("patch-base-mismatch");
      } catch (_error) {
        renderer.showEnded("This incremental update failed authenticated validation or did not match the current checkpoint.");
        socket.close();
      }
      return;
    }
    if (message.type === "room-presence") {
      try {
        const presence = await Session.decryptPresence({ envelope: message.envelope, roomId: invitation.roomId, key: invitation.key });
        renderer.renderPresence(presence);
      } catch (_error) {
        renderer.showEnded("This presence update failed authenticated decryption or validation.");
        socket.close();
      }
      return;
    }
    if (message.type === "room-ended") {
      renderer.showEnded(`Reason: ${message.reason || "stopped"}. The last inert frame remains visible.`);
      socket.close();
      return;
    }
    if (message.type === "room-error") {
      renderer.showEnded(`The room is unavailable (${message.code || "relay-error"}).`);
      socket.close();
    }
  });
  socket.addEventListener("close", () => {
    if (diagState.textContent !== "ended") renderer.showEnded("The linked viewer disconnected.");
  });
  socket.addEventListener("error", () => renderer.showEnded("The encrypted relay connection failed."));
}

joinButton.addEventListener("click", startInteractiveJoin);
displayNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") startInteractiveJoin();
});
confirmPairingButton.addEventListener("click", async () => {
  confirmPairingButton.disabled = true;
  try {
    await interactiveGuest.confirmPairing();
    setState("pairing", "You confirmed the code", "Waiting for the host to confirm and grant view access.");
  } catch (error) {
    confirmPairingButton.disabled = false;
    setState("error", "Could not confirm pairing", error.message || String(error));
  }
});

presenceShareButton.addEventListener("click", async () => {
  if (!interactiveGuest || !presenceCapabilityAvailable) return;
  presenceShareButton.disabled = true;
  if (exploreEnabled) {
    clearTimeout(presenceTimer);
    presenceTimer = null;
    try {
      await interactiveGuest.publishPresence({
        sharing: false,
        viewport: { ...localViewport },
        cursor: { ...localCursor, visible: false }
      });
    } catch (_error) {
      // Host revocation is reflected by the next grant.
    }
    exploreEnabled = false;
    localCursor = { ...localCursor, visible: false };
    renderPresenceMode();
    setState("ready", "Paired with the host", "Your pointer and viewport are not being shared.");
    return;
  }
  exploreEnabled = true;
  localCursor = { ...localCursor, visible: false };
  renderPresenceMode();
  renderLocalPresence();
  try {
    await interactiveGuest.publishPresence({
      sharing: true,
      viewport: { ...localViewport },
      cursor: { ...localCursor }
    });
    setState("ready", "Sharing pointer and viewport", "Move or scroll inside the inert page to point for the host.");
  } catch (error) {
    exploreEnabled = false;
    renderPresenceMode();
    setState("error", "Could not start pointing", error.message || String(error));
  }
});

inkShareButton.addEventListener("click", () => {
  setGuestInkEnabled(!guestInkEnabled);
  setState("ready", guestInkEnabled ? "Drawing laser ink" : "Paired with the host", guestInkEnabled
    ? "Drag over the inert page to point with a short-lived anchored trail."
    : "Laser drawing is off.");
});

avatarShareButton.addEventListener("click", () => {
  setGuestAvatarEnabled(!guestAvatarEnabled);
  setState("ready", guestAvatarEnabled ? "Playing as your avatar" : "Paired with the host", guestAvatarEnabled
    ? "Use A/D or the arrow keys to move; W, Up, or Space jumps."
    : "Avatar movement is off.");
});

renderer.viewportFrame.addEventListener("pointerdown", handleGuestInkPointerDown);
renderer.viewportFrame.addEventListener("pointermove", handleGuestInkPointerMove);
renderer.viewportFrame.addEventListener("pointerup", handleGuestInkPointerEnd);
renderer.viewportFrame.addEventListener("pointercancel", handleGuestInkPointerEnd);

renderer.viewportFrame.addEventListener("wheel", (event) => {
  if (!exploreEnabled) return;
  event.preventDefault();
  localViewport.scrollX += Number(event.deltaX) || 0;
  localViewport.scrollY += Number(event.deltaY) || 0;
  clampLocalViewport();
  renderLocalPresence();
  scheduleGuestPresence();
}, { passive: false });
renderer.viewportFrame.addEventListener("pointermove", (event) => {
  if (!exploreEnabled) return;
  const rect = renderer.viewportFrame.getBoundingClientRect();
  const scale = renderer.getViewportMetrics()?.scale || 1;
  localCursor = {
    x: Math.max(0, (event.clientX - rect.left) / scale),
    y: Math.max(0, (event.clientY - rect.top) / scale),
    visible: true
  };
  renderLocalPresence();
  scheduleGuestPresence();
});
renderer.viewportFrame.addEventListener("pointerleave", () => {
  if (!exploreEnabled) return;
  localCursor = { ...localCursor, visible: false };
  renderLocalPresence();
  scheduleGuestPresence();
});

chatLauncher.addEventListener("click", () => {
  setChatComposerOpen(chatComposer.hidden);
});
chatComposer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) {
    setChatComposerOpen(false);
    return;
  }
  if (!interactiveGuest) return;
  chatInput.value = "";
  try { await interactiveGuest.sendChat(text); } catch (error) {
    setState("error", "Message was not sent", error.message || String(error));
  }
  chatInput.focus({ preventScroll: true });
});

mediaVideo.addEventListener("loadedmetadata", () => {
  if (mediaVideo.videoWidth > 0 && mediaVideo.videoHeight > 0) {
    mediaSurface.style.setProperty("--media-aspect", `${mediaVideo.videoWidth} / ${mediaVideo.videoHeight}`);
  }
});
mediaVideo.addEventListener("enterpictureinpicture", () => { pipButton.textContent = "Return to page"; });
mediaVideo.addEventListener("leavepictureinpicture", () => { pipButton.textContent = "Picture in Picture"; });
pipButton.addEventListener("click", () => {
  togglePictureInPicture().catch((error) => setState("error", "Picture in Picture did not start", error.message || String(error)));
});

debugButton.addEventListener("click", () => {
  diagnostics.hidden = !diagnostics.hidden;
  debugButton.textContent = diagnostics.hidden ? "Show data use" : "Hide data use";
  debugButton.setAttribute("aria-expanded", String(!diagnostics.hidden));
});

renderer.stopButton.addEventListener("click", () => {
  endMediaLane();
  setGuestInkEnabled(false);
  inkSurface?.destroy();
  inkSurface = null;
  setGuestAvatarEnabled(false);
  if (interactiveGuest) interactiveGuest.leave();
  else socket?.close();
  renderer.showEnded(interactiveGuest
    ? "You left this paired Shared View. The host was not stopped."
    : "You left this Shared View. The publisher was not stopped.");
});
window.addEventListener("resize", () => {
  fitViewerAroundKeyboard();
  if (exploreEnabled) renderLocalPresence();
});
window.visualViewport?.addEventListener("resize", () => {
  fitViewerAroundKeyboard();
});
window.visualViewport?.addEventListener("scroll", () => {
  fitViewerAroundKeyboard();
});
window.addEventListener("pagehide", () => {
  inkSurface?.destroy();
  inkSurface = null;
  avatarSurface?.destroy();
  avatarSurface = null;
}, { once: true });

const interactiveParameters = new URLSearchParams(location.hash.replace(/^#/u, ""));
if (interactiveParameters.get("v") === String(Session.INTERACTIVE_VERSION)) {
  joinPanel.hidden = false;
  setState("invited", "Interactive invitation", "Ask to join; the host must approve you before any page state is sent.");
} else {
  startLegacy();
}
