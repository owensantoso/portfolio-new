(() => {
  "use strict";

  const Session = globalThis.AmbientSharedViewSession;
  const Contract = globalThis.AmbientSharedViewContract;

  function createPublisher({ relayUrl, roomId, key, WebSocketImpl = globalThis.WebSocket, onStatus = () => {}, connectTimeoutMs = 8000 }) {
    const parsedRelayUrl = new URL(relayUrl);
    if (!/^wss?:$/u.test(parsedRelayUrl.protocol)) throw new Error("Shared View relay URLs must use WebSocket.");
    if (!Session.validateRoomId(roomId)) throw new Error("Cannot publish an invalid Shared View room.");
    if (typeof WebSocketImpl !== "function") throw new Error("A WebSocket implementation is required.");

    let socket = null;
    let connectPromise = null;
    let resolveConnect = null;
    let rejectConnect = null;
    let state = "idle";
    let viewers = 0;
    let publishQueue = Promise.resolve();
    let connectTimer = null;
    let sentBytes = 0;
    let receivedBytes = 0;
    let sentMessages = 0;
    let receivedMessages = 0;

    function usage() {
      return Object.freeze({ sentBytes, receivedBytes, sentMessages, receivedMessages });
    }

    function sendMessage(message) {
      if (!socket || socket.readyState !== 1) throw new Error("The Shared View publisher is not connected.");
      const encoded = JSON.stringify(message);
      sentBytes += new TextEncoder().encode(encoded).byteLength;
      sentMessages += 1;
      socket.send(encoded);
    }

    function clearConnectTimer() {
      clearTimeout(connectTimer);
      connectTimer = null;
    }

    function report(nextState = state, details = {}) {
      state = nextState;
      if (Number.isInteger(details.viewers)) viewers = details.viewers;
      const status = Object.freeze({ state, viewers, usage: usage(), ...details });
      onStatus(status);
      return status;
    }

    function connect() {
      if (connectPromise) return connectPromise;
      if (state === "ended") return Promise.reject(new Error("This Shared View publisher has ended."));
      report("connecting");
      connectPromise = new Promise((resolve, reject) => {
        resolveConnect = resolve;
        rejectConnect = reject;
      });
      connectTimer = setTimeout(() => {
        const error = new Error("The Shared View relay connection timed out.");
        report("error", { code: "connection-timeout" });
        rejectConnect?.(error);
        resolveConnect = null;
        rejectConnect = null;
        socket?.close();
      }, Math.max(1, Number(connectTimeoutMs) || 8000));
      socket = new WebSocketImpl(parsedRelayUrl.href);
      socket.addEventListener("open", () => {
        sendMessage({ type: "room-publish", version: 0, roomId });
      });
      socket.addEventListener("message", (event) => {
        receivedBytes += new TextEncoder().encode(String(event.data)).byteLength;
        receivedMessages += 1;
        let message;
        try {
          message = JSON.parse(String(event.data));
        } catch (_error) {
          report("error", { code: "invalid-relay-message" });
          rejectConnect?.(new Error("The relay sent an invalid message."));
          rejectConnect = null;
          return;
        }
        if (message.type === "room-status" && message.roomId === roomId) {
          report(message.state === "active" ? "active" : message.state, { viewers: Number(message.viewers) || 0 });
          if (state === "active" && resolveConnect) {
            clearConnectTimer();
            resolveConnect(status());
            resolveConnect = null;
            rejectConnect = null;
          }
          return;
        }
        if (message.type === "room-error") {
          const error = new Error(`Shared View relay error: ${message.code || "unknown"}`);
          report("error", { code: message.code || "relay-error" });
          clearConnectTimer();
          rejectConnect?.(error);
          resolveConnect = null;
          rejectConnect = null;
          return;
        }
        if (message.type === "room-ended") {
          report("ended", { reason: message.reason || "stopped" });
          socket?.close();
        }
      });
      socket.addEventListener("error", () => {
        const error = new Error("The Shared View relay connection failed.");
        report("error", { code: "connection-failed" });
        clearConnectTimer();
        rejectConnect?.(error);
        resolveConnect = null;
        rejectConnect = null;
      });
      socket.addEventListener("close", () => {
        if (state === "ended" || state === "error") return;
        clearConnectTimer();
        const error = new Error("The Shared View relay disconnected.");
        report("disconnected");
        rejectConnect?.(error);
        resolveConnect = null;
        rejectConnect = null;
      });
      return connectPromise;
    }

    function publishEncrypted(value, encrypt, messageType) {
      publishQueue = publishQueue.then(async () => {
        await connect();
        if (!socket || socket.readyState !== 1 || state !== "active") {
          throw new Error("The Shared View publisher is not active.");
        }
        const envelope = await encrypt(value);
        sendMessage({ type: messageType, version: 0, roomId, envelope });
        return envelope;
      });
      return publishQueue;
    }

    function publish(snapshot) {
      return publishEncrypted(
        snapshot,
        (value) => Session.encryptSnapshot({ snapshot: value, roomId, key }),
        "room-frame"
      );
    }

    function publishPresence(presence) {
      return publishEncrypted(
        presence,
        (value) => Session.encryptPresence({ presence: value, roomId, key }),
        "room-presence"
      );
    }

    function publishPatch(patch) {
      return publishEncrypted(
        patch,
        (value) => Session.encryptPatch({ patch: value, roomId, key }),
        "room-patch"
      );
    }

    function end(reason = "stopped") {
      if (state === "ended") return;
      clearConnectTimer();
      if (socket?.readyState === 1) {
        sendMessage({ type: "room-end", version: 0, roomId, reason: String(reason).slice(0, 80) });
        socket.close();
      }
      report("ended", { reason });
    }

    function status() {
      return Object.freeze({ state, viewers, usage: usage() });
    }

    return Object.freeze({ connect, end, publish, publishPatch, publishPresence, status, usage });
  }

  function validateInteractiveRelayUrl(relayUrl, WebSocketImpl) {
    const parsedRelayUrl = new URL(relayUrl);
    if (!/^wss?:$/u.test(parsedRelayUrl.protocol)) throw new Error("Shared View relay URLs must use WebSocket.");
    if (typeof WebSocketImpl !== "function") throw new Error("A WebSocket implementation is required.");
    return parsedRelayUrl;
  }

  function createInteractiveSocketState({ parsedRelayUrl, WebSocketImpl, onEvent }) {
    let socket = null;
    let state = "idle";
    let sentBytes = 0;
    let receivedBytes = 0;
    let sentMessages = 0;
    let receivedMessages = 0;

    function emit(event) {
      try { onEvent(Object.freeze(event)); } catch (_error) {}
    }

    function setState(nextState, details = {}) {
      state = nextState;
      emit({ type: "status", state, ...details });
    }

    function usage() {
      return Object.freeze({ sentBytes, receivedBytes, sentMessages, receivedMessages });
    }

    function emitUsage() {
      emit({ type: "usage", usage: usage() });
    }

    function send(message) {
      if (!socket || socket.readyState !== 1) throw new Error("The interactive Shared View socket is not connected.");
      const encoded = JSON.stringify(message);
      sentBytes += new TextEncoder().encode(encoded).byteLength;
      sentMessages += 1;
      socket.send(encoded);
      emitUsage();
    }

    function recordReceived(data) {
      receivedBytes += new TextEncoder().encode(String(data)).byteLength;
      receivedMessages += 1;
      emitUsage();
    }

    function install(nextSocket) {
      socket = nextSocket;
    }

    function close() {
      try { socket?.close(); } catch (_error) {}
    }

    return {
      close,
      emit,
      get socket() { return socket; },
      get state() { return state; },
      install,
      parsedRelayUrl,
      recordReceived,
      send,
      setState,
      usage,
      WebSocketImpl
    };
  }

  async function createInteractiveHost({
    relayUrl,
    viewerBaseUrl,
    sessionId,
    sourceEpoch,
    verificationRequired = true,
    chatEnabledByDefault = false,
    WebSocketImpl = globalThis.WebSocket,
    onEvent = () => {},
    grantLifetimeMs = 15 * 60 * 1000
  }) {
    if (typeof sessionId !== "string" || !sessionId || typeof sourceEpoch !== "string" || !sourceEpoch) {
      throw new Error("The interactive host session context is invalid.");
    }
    const parsedRelayUrl = validateInteractiveRelayUrl(relayUrl, WebSocketImpl);
    const invitation = await Session.createInteractiveInvitation({ viewerBaseUrl, verificationRequired });
    const socketState = createInteractiveSocketState({ parsedRelayUrl, WebSocketImpl, onEvent });
    let connectPromise = null;
    const pendingParticipants = new Map();
    const participants = new Map();
    let announcedPendingId = null;
    let activeParticipantId = null;
    const capabilities = new Set(["view.receive", ...(chatEnabledByDefault ? ["chat.send"] : [])]);

    function readyParticipants() {
      return [...participants.values()].filter((participant) => participant.state === "ready" && participant.currentGrant);
    }

    function pairingParticipant() {
      return [...participants.values()].find((participant) => participant.state === "pairing") || null;
    }

    function activeParticipant() {
      return participants.get(activeParticipantId) || pairingParticipant() || readyParticipants().at(-1) || null;
    }

    function pendingParticipant() {
      return pendingParticipants.get(announcedPendingId) || pendingParticipants.values().next().value || null;
    }

    function status() {
      const pending = pendingParticipant();
      const active = activeParticipant();
      const ready = readyParticipants();
      return Object.freeze({
        state: socketState.state,
        roomId: invitation.roomId,
        participantId: pending?.participantId || active?.participantId || null,
        displayName: pending?.displayName || active?.displayName || null,
        participantCount: ready.length,
        pendingCount: pendingParticipants.size,
        participants: [...participants.values()].map((participant) => ({
          participantId: participant.participantId,
          displayName: participant.displayName,
          state: participant.state,
          capabilities: participant.currentGrant ? [...participant.currentGrant.capabilities] : []
        })),
        verificationRequired: invitation.verificationRequired,
        usage: socketState.usage(),
        capabilities: ready.length ? [...capabilities] : []
      });
    }

    function sendRoomMessage(type, details = {}) {
      socketState.send({ type, version: 1, roomId: invitation.roomId, ...details });
    }

    function acceptInboundSequence(participant, kind, sequence) {
      const last = participant.lastInboundSequence.get(kind) || 0;
      if (!Number.isInteger(sequence) || sequence <= last) return false;
      participant.lastInboundSequence.set(kind, sequence);
      return true;
    }

    function currentGrantAllows(participant, capability, payload = null) {
      return Contract.capabilityGrantAllows(participant?.currentGrant, capability, payload);
    }

    function sendEncrypted(participant, kind, payload) {
      participant.sendQueue = participant.sendQueue.catch(() => {}).then(async () => {
        if (!participant.secrets) throw new Error("The interactive participant is not paired.");
        const envelope = await Session.encryptInteractive({
          payload,
          roomId: invitation.roomId,
          participantId: participant.participantId,
          kind,
          key: participant.secrets.sendKey
        });
        sendRoomMessage("interactive-envelope", { participantId: participant.participantId, envelope });
        return envelope;
      });
      return participant.sendQueue;
    }

    function refreshAggregateState() {
      const ready = readyParticipants();
      const pairing = pairingParticipant();
      if (ready.length) socketState.setState("ready", { participantCount: ready.length });
      else if (pairing) socketState.setState("pairing", { participantId: pairing.participantId });
      else if (announcedPendingId) socketState.setState("pending", { participantId: announcedPendingId });
      else if (!["connecting", "disconnected", "ended"].includes(socketState.state)) socketState.setState("waiting");
    }

    function announceNextPending() {
      if (announcedPendingId || pairingParticipant()) {
        refreshAggregateState();
        return;
      }
      const pending = pendingParticipants.values().next().value;
      if (!pending) {
        refreshAggregateState();
        return;
      }
      announcedPendingId = pending.participantId;
      activeParticipantId = pending.participantId;
      refreshAggregateState();
      socketState.emit({ type: "admission-request", ...pending });
    }

    function scheduleGrantExpiry(participant, grant) {
      clearTimeout(participant.grantTimer);
      participant.grantTimer = setTimeout(() => {
        if (participant.currentGrant?.grantId === grant.grantId) {
          removeGuest("grant-expired", participant.participantId).catch(() => end("grant-expired"));
        }
      }, Math.max(1, grant.expiresAt - Date.now()));
    }

    async function issueGrant(participant) {
      if (!participant?.secrets || !participant.hostConfirmed || !participant.guestConfirmed) {
        throw new Error("Pairing must be confirmed before granting capabilities.");
      }
      const issuedAt = Date.now();
      const grant = {
        type: "shared-view-capability-grant",
        version: 1,
        sessionId,
        participantId: participant.participantId,
        sequence: ++participant.grantSequence,
        issuedAt,
        expiresAt: issuedAt + Math.min(30 * 60 * 1000, Math.max(1000, grantLifetimeMs)),
        sourceEpoch,
        grantId: Session.randomParticipantId(),
        capabilities: Contract.INTERACTIVE_CAPABILITIES.filter((capability) => capabilities.has(capability))
      };
      await sendEncrypted(participant, "grant", grant);
      participant.currentGrant = grant;
      participant.state = "ready";
      scheduleGrantExpiry(participant, grant);
      refreshAggregateState();
      socketState.emit({ type: "grant", participantId: participant.participantId, grant, capabilities: [...grant.capabilities] });
      return grant;
    }

    async function maybeBecomeReady(participant) {
      if (!participant.hostConfirmed || !participant.guestConfirmed || participant.currentGrant) return;
      await issueGrant(participant);
      activeParticipantId = participant.participantId;
      socketState.emit({ type: "ready", participantId: participant.participantId, displayName: participant.displayName });
      announceNextPending();
    }

    async function handleInteractiveEnvelope(message) {
      const participant = participants.get(message.participantId);
      if (!participant?.secrets) return;
      const { kind, sequence } = message.envelope || {};
      if (!["guest-confirm", "guest-presence", "guest-chat"].includes(kind)) return;
      if (!acceptInboundSequence(participant, kind, sequence)) {
        socketState.emit({ type: "denied", participantId: participant.participantId, code: "replay", kind });
        return;
      }
      const payload = await Session.decryptInteractive({
        envelope: message.envelope,
        roomId: invitation.roomId,
        participantId: participant.participantId,
        expectedKind: kind,
        key: participant.secrets.receiveKey
      });
      if (kind === "guest-confirm") {
        if (payload.sessionId !== sessionId) throw new Error("The guest confirmed the wrong session.");
        participant.guestConfirmed = true;
        socketState.emit({ type: "pairing-confirmed", participantId: participant.participantId, role: "guest" });
        await maybeBecomeReady(participant);
        return;
      }
      if (kind === "guest-presence") {
        const presence = Contract.decodeGuestPresence(payload, participant.currentGrant);
        if (!presence || !currentGrantAllows(participant, "presence.publish", presence)) {
          socketState.emit({ type: "denied", participantId: participant.participantId, code: "capability-denied", kind });
          return;
        }
        socketState.emit({ type: "guest-presence", participantId: participant.participantId, presence, displayName: participant.displayName });
        return;
      }
      if (!currentGrantAllows(participant, "chat.send", payload)) {
        socketState.emit({ type: "denied", participantId: participant.participantId, code: "capability-denied", kind });
        return;
      }
      socketState.emit({ type: "chat", participantId: participant.participantId, chat: payload, displayName: participant.displayName });
    }

    async function handleMessage(event, resolveConnect, rejectConnect) {
      socketState.recordReceived(event.data);
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch (_error) {
        throw new Error("The relay sent invalid interactive JSON.");
      }
      if (message.type === "interactive-status" && message.roomId === invitation.roomId) {
        if (["idle", "connecting"].includes(socketState.state)) {
          socketState.setState("waiting");
          resolveConnect?.(status());
        }
        return;
      }
      if (message.type === "interactive-join" && message.roomId === invitation.roomId) {
        if (pendingParticipants.has(message.participantId) || participants.has(message.participantId)) return;
        pendingParticipants.set(message.participantId, {
          participantId: message.participantId,
          guestPublicKey: message.guestPublicKey,
          displayName: String(message.displayName || "Guest").slice(0, 40)
        });
        announceNextPending();
        return;
      }
      if (message.type === "interactive-left" && message.roomId === invitation.roomId) {
        const pending = pendingParticipants.get(message.participantId);
        const participant = participants.get(message.participantId);
        if (participant) clearTimeout(participant.grantTimer);
        pendingParticipants.delete(message.participantId);
        participants.delete(message.participantId);
        if (announcedPendingId === message.participantId) announcedPendingId = null;
        if (activeParticipantId === message.participantId) activeParticipantId = readyParticipants().at(-1)?.participantId || null;
        socketState.emit({
          type: "participant-left",
          participantId: message.participantId,
          displayName: participant?.displayName || pending?.displayName || "Guest"
        });
        announceNextPending();
        return;
      }
      if (message.type === "interactive-envelope") {
        await handleInteractiveEnvelope(message);
        return;
      }
      if (message.type === "room-ended") {
        for (const participant of participants.values()) clearTimeout(participant.grantTimer);
        socketState.setState("ended", { reason: message.reason || "stopped" });
        socketState.close();
        return;
      }
      if (message.type === "room-error") {
        const error = new Error(`Interactive relay error: ${message.code || "unknown"}`);
        socketState.emit({ type: "error", code: message.code || "relay-error", error });
        rejectConnect?.(error);
      }
    }

    function connect() {
      if (connectPromise) return connectPromise;
      socketState.setState("connecting");
      connectPromise = new Promise((resolve, reject) => {
        const socket = new WebSocketImpl(parsedRelayUrl.href);
        socketState.install(socket);
        socket.addEventListener("open", () => {
          sendRoomMessage("interactive-host", { hostPublicKey: invitation.hostPublicKeyText });
        });
        socket.addEventListener("message", (event) => {
          handleMessage(event, resolve, reject).catch((error) => {
            socketState.emit({ type: "error", code: "invalid-interactive-message", error });
            reject(error);
          });
        });
        socket.addEventListener("error", () => reject(new Error("The interactive relay connection failed.")));
        socket.addEventListener("close", () => {
          if (!["ended", "removed"].includes(socketState.state)) socketState.setState("disconnected");
        });
      });
      return connectPromise;
    }

    async function approve(participantId) {
      const pending = pendingParticipants.get(participantId);
      if (!pending) {
        throw new Error("That interactive participant is not pending.");
      }
      if (pairingParticipant()) throw new Error("Finish the current pairing before approving another guest.");
      const secrets = await Session.deriveInteractiveSecrets({
        privateKey: invitation.hostKeyPair.privateKey,
        peerPublicKeyText: pending.guestPublicKey,
        roomId: invitation.roomId,
        hostPublicKeyText: invitation.hostPublicKeyText,
        guestPublicKeyText: pending.guestPublicKey,
        role: "host"
      });
      const participant = {
        ...pending,
        secrets,
        state: "pairing",
        currentGrant: null,
        grantTimer: null,
        hostConfirmed: false,
        guestConfirmed: false,
        hostConfirmationSequence: 0,
        grantSequence: 0,
        hostChatSequence: 0,
        sendQueue: Promise.resolve(),
        lastInboundSequence: new Map()
      };
      pendingParticipants.delete(participantId);
      participants.set(participantId, participant);
      if (announcedPendingId === participantId) announcedPendingId = null;
      activeParticipantId = participantId;
      sendRoomMessage("interactive-approve", {
        participantId,
        sessionId,
        sourceEpoch,
        verificationRequired: invitation.verificationRequired
      });
      refreshAggregateState();
      socketState.emit({
        type: "pairing",
        participantId,
        displayName: participant.displayName,
        sas: secrets.sas,
        verificationRequired: invitation.verificationRequired
      });
      if (!invitation.verificationRequired) await confirmPairing();
      return {
        participantId,
        displayName: participant.displayName,
        sas: secrets.sas,
        verificationRequired: invitation.verificationRequired
      };
    }

    function deny(participantId) {
      if (!pendingParticipants.has(participantId)) return false;
      sendRoomMessage("interactive-deny", { participantId });
      pendingParticipants.delete(participantId);
      if (announcedPendingId === participantId) announcedPendingId = null;
      announceNextPending();
      return true;
    }

    async function confirmPairing(participantId = activeParticipantId) {
      const participant = participants.get(participantId);
      if (!participant?.secrets || participant.state !== "pairing") throw new Error("No participant is waiting for pairing confirmation.");
      const confirmation = {
        type: "shared-view-pairing-confirmation",
        version: 1,
        sessionId,
        participantId: participant.participantId,
        sequence: ++participant.hostConfirmationSequence,
        confirmedAt: Date.now(),
        role: "host"
      };
      await sendEncrypted(participant, "host-confirm", confirmation);
      participant.hostConfirmed = true;
      socketState.emit({ type: "pairing-confirmed", participantId, role: "host" });
      await maybeBecomeReady(participant);
    }

    async function setCapability(capability, enabled) {
      if (capability === "view.receive") throw new Error("View access ends only by removing the guest.");
      if (!Contract.INTERACTIVE_CAPABILITIES.includes(capability)) throw new Error("The capability is unsupported.");
      const ready = readyParticipants();
      if (!ready.length) throw new Error("No interactive participant is ready.");
      if (enabled) capabilities.add(capability);
      else capabilities.delete(capability);
      return Promise.all(ready.map((participant) => issueGrant(participant)));
    }

    async function publish(snapshot) {
      const ready = readyParticipants().filter((participant) => currentGrantAllows(participant, "view.receive"));
      if (!ready.length) throw new Error("Interactive participants are not ready for snapshots.");
      if (snapshot.sessionId !== sessionId) throw new Error("The snapshot belongs to another session.");
      return Promise.all(ready.map((participant) => sendEncrypted(participant, "snapshot", snapshot)));
    }

    async function publishPatch(patch) {
      const ready = readyParticipants().filter((participant) => currentGrantAllows(participant, "view.receive"));
      if (!ready.length) throw new Error("Interactive participants are not ready for patches.");
      if (patch.sessionId !== sessionId) throw new Error("The patch belongs to another session.");
      return Promise.all(ready.map((participant) => sendEncrypted(participant, "patch", patch)));
    }

    async function publishPresence(presence) {
      const ready = readyParticipants().filter((participant) => currentGrantAllows(participant, "view.receive"));
      if (!ready.length) throw new Error("Interactive participants are not ready for presence.");
      if (presence.sessionId !== sessionId) throw new Error("The presence belongs to another session.");
      const encoded = Contract.encodeHostPresence(presence);
      return Promise.all(ready.map((participant) => sendEncrypted(participant, "host-presence", encoded)));
    }

    async function sendChat(text) {
      const recipients = readyParticipants().filter((participant) => currentGrantAllows(participant, "chat.send"));
      if (!recipients.length) throw new Error("Chat is not granted.");
      const chats = await Promise.all(recipients.map(async (participant) => {
        const chat = {
          type: "shared-view-chat",
          version: 1,
          sessionId,
          participantId: participant.participantId,
          sequence: ++participant.hostChatSequence,
          sentAt: Date.now(),
          sourceEpoch,
          grantId: participant.currentGrant.grantId,
          sender: "host",
          text: String(text || "").slice(0, 500)
        };
        await sendEncrypted(participant, "host-chat", chat);
        return chat;
      }));
      socketState.emit({ type: "chat", chat: chats[0], displayName: "You", recipients: chats.length });
      return chats;
    }

    async function removeGuest(reason = "host-removed", participantId = activeParticipantId) {
      const participant = participants.get(participantId) || readyParticipants().at(-1);
      if (!participant) return false;
      clearTimeout(participant.grantTimer);
      sendRoomMessage("interactive-remove", {
        participantId: participant.participantId,
        reason: String(reason).slice(0, 80)
      });
      participants.delete(participant.participantId);
      if (activeParticipantId === participant.participantId) activeParticipantId = readyParticipants().at(-1)?.participantId || null;
      socketState.emit({ type: "removed", reason, participantId: participant.participantId, displayName: participant.displayName });
      announceNextPending();
      return true;
    }

    function end(reason = "stopped") {
      if (socketState.state === "ended") return;
      for (const participant of participants.values()) clearTimeout(participant.grantTimer);
      try { sendRoomMessage("room-end", { reason: String(reason).slice(0, 80) }); } catch (_error) {}
      socketState.setState("ended", { reason });
      socketState.close();
    }

    return Object.freeze({
      approve,
      confirmPairing,
      connect,
      deny,
      end,
      inviteUrl: invitation.inviteUrl,
      publish,
      publishPatch,
      publishPresence,
      removeGuest,
      roomId: invitation.roomId,
      sendChat,
      setCapability,
      status,
      usage: socketState.usage
    });
  }

  async function createInteractiveGuest({
    inviteUrl,
    relayUrl = null,
    displayName = "Guest",
    WebSocketImpl = globalThis.WebSocket,
    onEvent = () => {}
  }) {
    const invitation = await Session.parseInteractiveInvitation(inviteUrl);
    const relayCandidate = relayUrl ? new URL(relayUrl) : new URL("/relay", inviteUrl);
    if (!relayUrl) relayCandidate.protocol = relayCandidate.protocol === "https:" ? "wss:" : "ws:";
    relayCandidate.hash = "";
    const parsedRelayUrl = validateInteractiveRelayUrl(relayCandidate.href, WebSocketImpl);
    const guestIdentity = await Session.createInteractiveKeyPair();
    const participantId = Session.randomParticipantId();
    const socketState = createInteractiveSocketState({ parsedRelayUrl, WebSocketImpl, onEvent });
    let connectPromise = null;
    let secrets = null;
    let currentGrant = null;
    let guestConfirmationSequence = 0;
    let guestPresenceSequence = 0;
    let guestChatSequence = 0;
    let encryptedSendQueue = Promise.resolve();
    let hostConfirmed = false;
    let pairingSessionId = null;
    let pairingSourceEpoch = null;
    const lastInboundSequence = new Map();

    function status() {
      return Object.freeze({
        state: socketState.state,
        roomId: invitation.roomId,
        participantId,
        verificationRequired: invitation.verificationRequired,
        usage: socketState.usage(),
        capabilities: currentGrant ? [...currentGrant.capabilities] : []
      });
    }

    function sendRoomMessage(type, details = {}) {
      socketState.send({ type, version: 1, roomId: invitation.roomId, participantId, ...details });
    }

    function grantAllows(capability) {
      return Contract.capabilityGrantAllows(currentGrant, capability);
    }

    function acceptInboundSequence(kind, sequence) {
      const last = lastInboundSequence.get(kind) || 0;
      if (!Number.isInteger(sequence) || sequence <= last) return false;
      lastInboundSequence.set(kind, sequence);
      return true;
    }

    function payloadMatchesGrant(payload) {
      return Boolean(
        currentGrant &&
        payload.sessionId === currentGrant.sessionId &&
        payload.participantId === participantId &&
        payload.sourceEpoch === currentGrant.sourceEpoch &&
        payload.grantId === currentGrant.grantId
      );
    }

    function sendEncrypted(kind, payload) {
      encryptedSendQueue = encryptedSendQueue.then(async () => {
        if (!secrets) throw new Error("The interactive guest is not paired.");
        const envelope = await Session.encryptInteractive({
          payload,
          roomId: invitation.roomId,
          participantId,
          kind,
          key: secrets.sendKey
        });
        sendRoomMessage("interactive-envelope", { envelope });
        return envelope;
      });
      return encryptedSendQueue;
    }

    async function handleEnvelope(message) {
      if (!secrets || message.participantId !== participantId) return;
      const { kind, sequence } = message.envelope || {};
      if (!["host-confirm", "grant", "snapshot", "patch", "host-presence", "host-chat", "remove"].includes(kind)) return;
      if (!acceptInboundSequence(kind, sequence)) {
        socketState.emit({ type: "denied", code: "replay", kind });
        return;
      }
      const payload = await Session.decryptInteractive({
        envelope: message.envelope,
        roomId: invitation.roomId,
        participantId,
        expectedKind: kind,
        key: secrets.receiveKey
      });
      if (kind === "host-confirm") {
        hostConfirmed = true;
        socketState.emit({ type: "pairing-confirmed", role: "host" });
        return;
      }
      if (kind === "grant") {
        if (
          payload.participantId !== participantId ||
          payload.sessionId !== pairingSessionId ||
          payload.sourceEpoch !== pairingSourceEpoch ||
          payload.expiresAt <= Date.now()
        ) {
          throw new Error("The capability grant is invalid or expired.");
        }
        currentGrant = payload;
        socketState.setState("ready", { participantId });
        socketState.emit({ type: "grant", grant: payload, capabilities: [...payload.capabilities], hostConfirmed });
        return;
      }
      if (kind === "snapshot") {
        if (!grantAllows("view.receive") || payload.sessionId !== currentGrant.sessionId) return;
        socketState.emit({ type: "snapshot", snapshot: payload });
        return;
      }
      if (kind === "patch") {
        if (!grantAllows("view.receive") || payload.sessionId !== currentGrant.sessionId) return;
        socketState.emit({ type: "patch", patch: payload });
        return;
      }
      if (kind === "host-presence") {
        const presence = Contract.decodeHostPresence(payload, currentGrant.sessionId);
        if (!grantAllows("view.receive") || !presence) return;
        socketState.emit({ type: "host-presence", presence });
        return;
      }
      if (kind === "host-chat") {
        if (!grantAllows("chat.send") || !payloadMatchesGrant(payload)) return;
        socketState.emit({ type: "chat", chat: payload, displayName: "Host" });
        return;
      }
      socketState.setState("removed", { reason: payload.reason || "host-removed" });
      socketState.emit({ type: "removed", reason: payload.reason || "host-removed" });
    }

    async function handleMessage(event, rejectConnect) {
      socketState.recordReceived(event.data);
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch (_error) {
        throw new Error("The relay sent invalid interactive JSON.");
      }
      if (message.type === "interactive-approved" && message.participantId === participantId) {
        if (
          typeof message.sessionId !== "string" || !message.sessionId ||
          typeof message.sourceEpoch !== "string" || !message.sourceEpoch
        ) {
          throw new Error("The host approval context is invalid.");
        }
        if (
          typeof message.verificationRequired !== "boolean" ||
          message.verificationRequired !== invitation.verificationRequired
        ) {
          throw new Error("The host approval verification setting does not match the invitation.");
        }
        pairingSessionId = message.sessionId;
        pairingSourceEpoch = message.sourceEpoch;
        secrets = await Session.deriveInteractiveSecrets({
          privateKey: guestIdentity.keyPair.privateKey,
          peerPublicKeyText: invitation.hostPublicKeyText,
          roomId: invitation.roomId,
          hostPublicKeyText: invitation.hostPublicKeyText,
          guestPublicKeyText: guestIdentity.publicKeyText,
          role: "guest"
        });
        socketState.setState("pairing", { participantId });
        socketState.emit({
          type: "pairing",
          participantId,
          sas: secrets.sas,
          verificationRequired: invitation.verificationRequired
        });
        if (!invitation.verificationRequired) await confirmPairing();
        return;
      }
      if (message.type === "interactive-envelope") {
        await handleEnvelope(message);
        return;
      }
      if (message.type === "interactive-removed") {
        currentGrant = null;
        socketState.setState("removed", { reason: message.reason || "host-removed" });
        socketState.emit({ type: "removed", reason: message.reason || "host-removed" });
        return;
      }
      if (message.type === "room-ended") {
        currentGrant = null;
        socketState.setState("ended", { reason: message.reason || "stopped" });
        socketState.close();
        return;
      }
      if (message.type === "room-error") {
        const error = new Error(`Interactive relay error: ${message.code || "unknown"}`);
        socketState.emit({ type: "error", code: message.code || "relay-error", error });
        rejectConnect?.(error);
      }
    }

    function connect() {
      if (connectPromise) return connectPromise;
      socketState.setState("connecting");
      connectPromise = new Promise((resolve, reject) => {
        const socket = new WebSocketImpl(parsedRelayUrl.href);
        socketState.install(socket);
        socket.addEventListener("open", () => {
          sendRoomMessage("interactive-join", {
            guestPublicKey: guestIdentity.publicKeyText,
            displayName: String(displayName || "Guest").trim().slice(0, 40) || "Guest"
          });
          socketState.setState("awaiting-approval", { participantId });
          resolve(status());
        });
        socket.addEventListener("message", (event) => {
          handleMessage(event, reject).catch((error) => {
            socketState.emit({ type: "error", code: "invalid-interactive-message", error });
            reject(error);
          });
        });
        socket.addEventListener("error", () => reject(new Error("The interactive relay connection failed.")));
        socket.addEventListener("close", () => {
          if (!["ended", "removed"].includes(socketState.state)) socketState.setState("disconnected");
        });
      });
      return connectPromise;
    }

    async function confirmPairing() {
      if (!secrets || socketState.state !== "pairing") throw new Error("The interactive guest is not waiting for pairing confirmation.");
      const confirmation = {
        type: "shared-view-pairing-confirmation",
        version: 1,
        sessionId: pairingSessionId,
        participantId,
        sequence: ++guestConfirmationSequence,
        confirmedAt: Date.now(),
        role: "guest"
      };
      await sendEncrypted("guest-confirm", confirmation);
      socketState.emit({ type: "pairing-confirmed", role: "guest" });
    }

    async function publishPresence({ viewport, cursor, sharing }) {
      if (!grantAllows("presence.publish")) throw new Error("Guest presence is not granted.");
      const presence = {
        type: "shared-view-guest-presence",
        version: 1,
        sessionId: currentGrant.sessionId,
        participantId,
        sequence: ++guestPresenceSequence,
        capturedAt: Date.now(),
        sourceEpoch: currentGrant.sourceEpoch,
        grantId: currentGrant.grantId,
        sharing,
        viewport,
        cursor
      };
      await sendEncrypted("guest-presence", Contract.encodeGuestPresence(presence));
      return presence;
    }

    async function sendChat(text) {
      if (!grantAllows("chat.send")) throw new Error("Guest chat is not granted.");
      const chat = {
        type: "shared-view-chat",
        version: 1,
        sessionId: currentGrant.sessionId,
        participantId,
        sequence: ++guestChatSequence,
        sentAt: Date.now(),
        sourceEpoch: currentGrant.sourceEpoch,
        grantId: currentGrant.grantId,
        sender: "guest",
        text: String(text || "").slice(0, 500)
      };
      await sendEncrypted("guest-chat", chat);
      socketState.emit({ type: "chat", chat, displayName: "You" });
      return chat;
    }

    function leave() {
      if (!["ended", "removed"].includes(socketState.state)) socketState.setState("ended", { reason: "guest-left" });
      socketState.close();
    }

    return Object.freeze({
      confirmPairing,
      connect,
      leave,
      participantId,
      publishPresence,
      sendChat,
      status,
      usage: socketState.usage
    });
  }

  globalThis.AmbientSharedViewTransport = Object.freeze({
    createInteractiveGuest,
    createInteractiveHost,
    createPublisher
  });
})();
