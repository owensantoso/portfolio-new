"use strict";

const Session = globalThis.AmbientSharedViewSession;
const Transport = globalThis.AmbientSharedViewTransport;
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
const chatLayer = document.querySelector("#chatLayer");
const chatBubbles = document.querySelector("#chatBubbles");
const chatLauncher = document.querySelector("#chatLauncher");
const chatComposer = document.querySelector("#chatComposer");
const chatInput = document.querySelector("#chatInput");
const viewerShell = document.querySelector(".viewer-shell");
const viewerStage = document.querySelector("#viewerStage");
const projectionLabel = document.querySelector("#projectionLabel");
const stateLabel = document.querySelector("#stateLabel");
const sourceLabel = document.querySelector("#sourceLabel");
const diagState = document.querySelector("#diagState");
const diagnostics = document.querySelector("#diagnostics");
const debugButton = document.querySelector("#debugButton");

let socket = null;
let interactiveGuest = null;
let interactiveCapabilities = new Set();
let exploreEnabled = false;
let presenceCapabilityAvailable = false;
let localViewport = { scrollX: 0, scrollY: 0 };
let localCursor = { x: 0, y: 0, visible: false };
let presenceTimer = null;
let grantExpiry = 0;
let countdownTimer = null;
let hostDisplayName = "Owen";
let chatOpenScrollPosition = null;
const MAX_CHAT_HISTORY = 100;
const legacyUsage = { sentBytes: 0, receivedBytes: 0, sentMessages: 0, receivedMessages: 0 };

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

function appendChat(chat, displayName) {
  const bubble = document.createElement("div");
  const messageSide = chat.sender === "guest" ? "local" : "remote";
  bubble.className = `chat-bubble ${messageSide}`;
  bubble.dataset.preview = "true";
  const message = document.createElement("span");
  message.textContent = chat.text;
  if (messageSide === "remote") {
    const author = document.createElement("strong");
    author.textContent = displayName;
    bubble.append(author);
  }
  bubble.append(message);
  chatBubbles.appendChild(bubble);
  while (chatBubbles.children.length > MAX_CHAT_HISTORY) chatBubbles.firstElementChild?.remove();
  chatBubbles.scrollTop = chatBubbles.scrollHeight;
  setTimeout(() => {
    if (!chatComposer.hidden) {
      bubble.dataset.preview = "false";
      return;
    }
    bubble.dataset.leaving = "true";
    setTimeout(() => {
      bubble.dataset.preview = "false";
      delete bubble.dataset.leaving;
    }, 180);
  }, 6_000);
}

function fitViewerAroundKeyboard() {
  const visualViewport = window.visualViewport;
  const keyboardVisible = Boolean(
    visualViewport &&
    window.innerWidth <= 720 &&
    !chatComposer.hidden &&
    window.innerHeight - visualViewport.height > 80
  );
  if (!keyboardVisible) {
    delete renderer.viewportFrame.dataset.fitHeight;
    viewerStage.dataset.keyboardFit = "false";
    chatLayer.dataset.layout = "overlay";
    renderer.updateScale();
    return;
  }
  viewerStage.dataset.keyboardFit = "true";
  chatLayer.dataset.layout = "sidecar";
  const shellRect = viewerShell.getBoundingClientRect();
  const shellStyle = getComputedStyle(viewerShell);
  const verticalPadding = parseFloat(shellStyle.paddingTop) + parseFloat(shellStyle.paddingBottom)
    + parseFloat(shellStyle.borderTopWidth) + parseFloat(shellStyle.borderBottomWidth);
  const fixedPhoneChrome = viewerShell.querySelector(".projection-chrome")?.offsetHeight || 0;
  const homeIndicator = viewerShell.querySelector(".phone-home-indicator");
  const fixedPhoneFooter = homeIndicator && getComputedStyle(homeIndicator).display !== "none"
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
}

function positionMobileChat() {
  if (window.innerWidth > 720 || chatComposer.hidden) return;
  if (chatLayer.dataset.layout === "sidecar") {
    chatLayer.style.removeProperty("--chat-visual-top");
    chatLayer.style.removeProperty("--chat-visual-right");
    chatLayer.style.removeProperty("--chat-visual-width");
    return;
  }
  const visualViewport = window.visualViewport;
  const visualTop = Math.max(8, (visualViewport?.offsetTop || 0) + 10);
  const visualRight = Math.max(
    10,
    window.innerWidth - ((visualViewport?.offsetLeft || 0) + (visualViewport?.width || window.innerWidth)) + 10
  );
  const visualWidth = Math.max(220, visualViewport?.width || window.innerWidth);
  chatLayer.style.setProperty("--chat-visual-top", `${visualTop}px`);
  chatLayer.style.setProperty("--chat-visual-right", `${visualRight}px`);
  chatLayer.style.setProperty("--chat-visual-width", `${visualWidth}px`);
}

function setChatComposerOpen(open) {
  if (open && window.innerWidth <= 720) chatOpenScrollPosition = { x: window.scrollX, y: window.scrollY };
  chatComposer.hidden = !open;
  chatLayer.dataset.open = String(open);
  chatLauncher.setAttribute("aria-expanded", String(open));
  chatLauncher.setAttribute("aria-label", open ? "Close chat" : "Open chat");
  if (open) {
    positionMobileChat();
    chatInput.focus({ preventScroll: true });
    const restorePosition = chatOpenScrollPosition;
    if (restorePosition) {
      requestAnimationFrame(() => {
        window.scrollTo(restorePosition.x, restorePosition.y);
        positionMobileChat();
        fitViewerAroundKeyboard();
      });
    }
  } else {
    chatInput.blur();
    chatOpenScrollPosition = null;
    chatLayer.dataset.layout = "overlay";
    chatLayer.style.removeProperty("--chat-visual-top");
    chatLayer.style.removeProperty("--chat-visual-right");
    chatLayer.style.removeProperty("--chat-visual-width");
  }
  fitViewerAroundKeyboard();
  positionMobileChat();
}

function setChatEnabled(enabled) {
  chatLayer.hidden = !enabled;
  if (!enabled) {
    setChatComposerOpen(false);
    chatBubbles.replaceChildren();
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
  interactiveCapabilities = new Set(event.capabilities);
  hostDisplayName = String(event.grant?.hostDisplayName || "Owen").trim().slice(0, 40) || "Owen";
  updateProjectionPresentation();
  grantExpiry = event.grant.expiresAt;
  clearInterval(countdownTimer);
  countdownTimer = setInterval(updateCountdown, 1000);
  updateCountdown();
  presenceCapabilityAvailable = interactiveCapabilities.has("presence.publish");
  if (!presenceCapabilityAvailable) exploreEnabled = false;
  modePanel.hidden = false;
  renderPresenceMode();
  setChatEnabled(interactiveCapabilities.has("chat.send"));
  pairingPanel.hidden = true;
  setState("ready", "Paired with the host", presenceCapabilityAvailable
    ? "The host offered pointing; choose whether to share."
    : "Waiting for the host's live view.");
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
    clampLocalViewport();
    if (exploreEnabled) renderLocalPresence();
    return;
  }
  if (event.type === "host-presence") {
    renderer.renderPresence(event.presence);
    return;
  }
  if (event.type === "chat") {
    appendChat(event.chat, event.chat.sender === "guest" ? "You" : event.displayName || hostDisplayName);
    return;
  }
  if (event.type === "host-paused") {
    setState("paused", "Host temporarily paused", "Safari interrupted the host connection. The last frame remains visible while it reconnects.");
    return;
  }
  if (event.type === "host-resumed") {
    setState("ready", "Host reconnected", "Waiting for the host's refreshed view.");
    return;
  }
  if (event.type === "removed") {
    clearInterval(countdownTimer);
    setChatEnabled(false);
    renderer.showEnded(`The host removed this guest (${event.reason || "removed"}).`);
    return;
  }
  if (event.type === "error") {
    setState("error", "The interactive room reported an error", event.code || "relay-error");
  }
}

async function startInteractiveJoin() {
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

debugButton.addEventListener("click", () => {
  diagnostics.hidden = !diagnostics.hidden;
  debugButton.textContent = diagnostics.hidden ? "Show data use" : "Hide data use";
  debugButton.setAttribute("aria-expanded", String(!diagnostics.hidden));
});

renderer.stopButton.addEventListener("click", () => {
  if (interactiveGuest) interactiveGuest.leave();
  else socket?.close();
  renderer.showEnded(interactiveGuest
    ? "You left this paired Shared View. The host was not stopped."
    : "You left this Shared View. The publisher was not stopped.");
});
window.addEventListener("resize", () => {
  fitViewerAroundKeyboard();
  positionMobileChat();
  if (exploreEnabled) renderLocalPresence();
});
window.visualViewport?.addEventListener("resize", () => {
  fitViewerAroundKeyboard();
  positionMobileChat();
});
window.visualViewport?.addEventListener("scroll", () => {
  fitViewerAroundKeyboard();
  positionMobileChat();
});

const interactiveParameters = new URLSearchParams(location.hash.replace(/^#/u, ""));
if (interactiveParameters.get("v") === "1") {
  joinPanel.hidden = false;
  setState("invited", "Interactive invitation", "Ask to join; the host must approve you before any page state is sent.");
} else {
  startLegacy();
}
