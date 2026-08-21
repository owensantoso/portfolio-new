(() => {
  "use strict";

  const Contract = globalThis.AmbientSharedViewContract;
  const ENVELOPE_TYPE = "shared-view-encrypted-frame";
  const PATCH_ENVELOPE_TYPE = "shared-view-encrypted-patch";
  const PRESENCE_ENVELOPE_TYPE = "shared-view-encrypted-presence";
  const INTERACTIVE_ENVELOPE_TYPE = "shared-view-interactive-envelope";
  const ENVELOPE_VERSION = 0;
  const INTERACTIVE_VERSION = 2;
  const ROOM_PATTERN = /^[A-Za-z0-9_-]{22}$/;
  const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
  const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
  const MAX_CIPHERTEXT_CHARACTERS = 8_000_000;
  const PUBLIC_KEY_PATTERN = /^[A-Za-z0-9_-]{87}$/;
  const interactiveKinds = new Set([
    "host-confirm",
    "guest-confirm",
    "grant",
    "snapshot",
    "patch",
    "host-presence",
    "guest-presence",
    "host-chat",
    "guest-chat",
    "host-ink",
    "guest-ink",
    "host-avatar",
    "guest-avatar",
    "guest-asset-request",
    "remove"
  ]);
  const compressedInteractiveKinds = new Set(["snapshot", "patch"]);

  function bytesToBase64Url(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  }

  function base64UrlToBytes(value) {
    const text = String(value || "");
    if (!text || !BASE64URL_PATTERN.test(text)) throw new Error("Invalid base64url value.");
    const padded = text.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function randomToken(byteLength) {
    return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
  }

  function validateRoomId(roomId) {
    return ROOM_PATTERN.test(String(roomId || ""));
  }

  function randomParticipantId() {
    return randomToken(16);
  }

  async function importKey(keyBytes) {
    const bytes = keyBytes instanceof Uint8Array ? keyBytes : new Uint8Array(keyBytes);
    if (bytes.byteLength !== 32) throw new Error("Shared View keys must be 256 bits.");
    return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }

  async function createInvitation({ viewerBaseUrl }) {
    const url = new URL(viewerBaseUrl);
    if (!/^https?:$/u.test(url.protocol)) throw new Error("The viewer must use an HTTP or HTTPS URL.");
    url.search = "";
    const roomId = randomToken(16);
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    const keyText = bytesToBase64Url(keyBytes);
    const key = await importKey(keyBytes);
    url.hash = new URLSearchParams({ room: roomId, key: keyText }).toString();
    return { roomId, key, keyText, inviteUrl: url.href };
  }

  async function parseInvitation(inviteUrl) {
    const url = new URL(inviteUrl);
    const parameters = new URLSearchParams(url.hash.replace(/^#/u, ""));
    const roomId = parameters.get("room") || "";
    const keyText = parameters.get("key") || "";
    if (!validateRoomId(roomId) || !KEY_PATTERN.test(keyText)) {
      throw new Error("The Shared View invitation is invalid.");
    }
    const keyBytes = base64UrlToBytes(keyText);
    return { roomId, keyText, key: await importKey(keyBytes) };
  }

  async function createInteractiveKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );
    const publicKeyText = bytesToBase64Url(await crypto.subtle.exportKey("raw", keyPair.publicKey));
    if (!PUBLIC_KEY_PATTERN.test(publicKeyText)) throw new Error("The interactive public key is invalid.");
    return { keyPair, publicKeyText };
  }

  async function importInteractivePublicKey(publicKeyText) {
    if (!PUBLIC_KEY_PATTERN.test(String(publicKeyText || ""))) {
      throw new Error("The interactive public key is invalid.");
    }
    const bytes = base64UrlToBytes(publicKeyText);
    if (bytes.byteLength !== 65 || bytes[0] !== 4) throw new Error("The interactive public key is invalid.");
    return crypto.subtle.importKey("raw", bytes, { name: "ECDH", namedCurve: "P-256" }, false, []);
  }

  async function createInteractiveInvitation({ viewerBaseUrl, verificationRequired = true }) {
    const url = new URL(viewerBaseUrl);
    if (!/^https?:$/u.test(url.protocol)) throw new Error("The viewer must use an HTTP or HTTPS URL.");
    url.search = "";
    const roomId = randomToken(16);
    const hostIdentity = await createInteractiveKeyPair();
    url.hash = new URLSearchParams({
      v: String(INTERACTIVE_VERSION),
      room: roomId,
      host: hostIdentity.publicKeyText,
      verify: verificationRequired ? "1" : "0"
    }).toString();
    return {
      roomId,
      hostKeyPair: hostIdentity.keyPair,
      hostPublicKeyText: hostIdentity.publicKeyText,
      verificationRequired: Boolean(verificationRequired),
      inviteUrl: url.href
    };
  }

  async function parseInteractiveInvitation(inviteUrl) {
    const url = new URL(inviteUrl);
    const parameters = new URLSearchParams(url.hash.replace(/^#/u, ""));
    const roomId = parameters.get("room") || "";
    const hostPublicKeyText = parameters.get("host") || "";
    const verificationParameter = parameters.get("verify");
    if (parameters.get("v") !== String(INTERACTIVE_VERSION) || !validateRoomId(roomId)) {
      throw new Error("The interactive Shared View invitation is invalid.");
    }
    const hostPublicKey = await importInteractivePublicKey(hostPublicKeyText);
    if (verificationParameter !== null && verificationParameter !== "0" && verificationParameter !== "1") {
      throw new Error("The interactive Shared View verification setting is invalid.");
    }
    return {
      roomId,
      hostPublicKeyText,
      hostPublicKey,
      verificationRequired: verificationParameter !== "0"
    };
  }

  async function deriveInteractiveSecrets({
    privateKey,
    peerPublicKeyText,
    roomId,
    hostPublicKeyText,
    guestPublicKeyText,
    role
  }) {
    if (role !== "host" && role !== "guest") throw new Error("The interactive role is invalid.");
    if (!validateRoomId(roomId)) throw new Error("The interactive room is invalid.");
    if (!privateKey || privateKey.algorithm?.name !== "ECDH") throw new Error("The interactive private key is invalid.");
    const peerPublicKey = await importInteractivePublicKey(peerPublicKeyText);
    await importInteractivePublicKey(hostPublicKeyText);
    await importInteractivePublicKey(guestPublicKeyText);
    const sharedBits = await crypto.subtle.deriveBits({ name: "ECDH", public: peerPublicKey }, privateKey, 256);
    const baseKey = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey", "deriveBits"]);
    const encoder = new TextEncoder();
    const salt = await crypto.subtle.digest("SHA-256", encoder.encode(`ambient-shared-view-v1:${roomId}`));
    const transcript = `${roomId}:${hostPublicKeyText}:${guestPublicKeyText}`;

    async function deriveKey(label) {
      return crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt, info: encoder.encode(`${transcript}:${label}`) },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    }

    const hostToGuestKey = await deriveKey("host-to-guest");
    const guestToHostKey = await deriveKey("guest-to-host");
    const sasBytes = new Uint8Array(await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: encoder.encode(`${transcript}:sas`) },
      baseKey,
      48
    ));
    const sas = [0, 2, 4]
      .map((offset) => (((sasBytes[offset] << 8) | sasBytes[offset + 1]) % 1000).toString().padStart(3, "0"))
      .join(" ");
    return role === "host"
      ? { sendKey: hostToGuestKey, receiveKey: guestToHostKey, sas }
      : { sendKey: guestToHostKey, receiveKey: hostToGuestKey, sas };
  }

  function envelopeAdditionalData(envelope) {
    return new TextEncoder().encode([
      envelope.type,
      ENVELOPE_VERSION,
      envelope.roomId,
      envelope.sequence
    ].join(":"));
  }

  function validateEncryptedEnvelope(envelope, expectedType) {
    return Boolean(
      envelope &&
      envelope.type === expectedType &&
      envelope.version === ENVELOPE_VERSION &&
      validateRoomId(envelope.roomId) &&
      Number.isInteger(envelope.sequence) &&
      envelope.sequence >= 1 &&
      typeof envelope.iv === "string" &&
      envelope.iv.length === 16 &&
      BASE64URL_PATTERN.test(envelope.iv) &&
      typeof envelope.ciphertext === "string" &&
      envelope.ciphertext.length > 16 &&
      envelope.ciphertext.length <= MAX_CIPHERTEXT_CHARACTERS &&
      BASE64URL_PATTERN.test(envelope.ciphertext)
    );
  }

  function validateEnvelope(envelope) {
    return validateEncryptedEnvelope(envelope, ENVELOPE_TYPE);
  }

  function validatePresenceEnvelope(envelope) {
    return validateEncryptedEnvelope(envelope, PRESENCE_ENVELOPE_TYPE);
  }

  function validatePatchEnvelope(envelope) {
    return validateEncryptedEnvelope(envelope, PATCH_ENVELOPE_TYPE);
  }

  function validateInteractiveEnvelope(envelope) {
    return Boolean(
      envelope &&
      envelope.type === INTERACTIVE_ENVELOPE_TYPE &&
      envelope.version === INTERACTIVE_VERSION &&
      validateRoomId(envelope.roomId) &&
      ROOM_PATTERN.test(String(envelope.participantId || "")) &&
      interactiveKinds.has(envelope.kind) &&
      ["json", "gzip-json"].includes(envelope.encoding) &&
      Number.isInteger(envelope.sequence) &&
      envelope.sequence >= 1 &&
      typeof envelope.iv === "string" &&
      envelope.iv.length === 16 &&
      BASE64URL_PATTERN.test(envelope.iv) &&
      typeof envelope.ciphertext === "string" &&
      envelope.ciphertext.length > 16 &&
      envelope.ciphertext.length <= MAX_CIPHERTEXT_CHARACTERS &&
      BASE64URL_PATTERN.test(envelope.ciphertext)
    );
  }

  function validatePairingConfirmation(value, role) {
    return Boolean(
      value &&
      value.type === "shared-view-pairing-confirmation" &&
      value.version === INTERACTIVE_VERSION &&
      value.role === role &&
      typeof value.sessionId === "string" &&
      value.sessionId.length > 0 &&
      value.sessionId.length <= 100 &&
      ROOM_PATTERN.test(String(value.participantId || "")) &&
      Number.isInteger(value.sequence) &&
      value.sequence >= 1 &&
      Number.isFinite(value.confirmedAt)
    );
  }

  function validateRemove(value) {
    return Boolean(
      value &&
      value.type === "shared-view-participant-removed" &&
      value.version === INTERACTIVE_VERSION &&
      typeof value.sessionId === "string" &&
      ROOM_PATTERN.test(String(value.participantId || "")) &&
      Number.isInteger(value.sequence) &&
      value.sequence >= 1 &&
      typeof value.reason === "string" &&
      value.reason.length <= 80
    );
  }

  // Snapshot payloads repeat about a hundred Cascading Style Sheets property
  // names per node, so they compress by more than an order of magnitude.
  // Compression happens before encryption, which is the only order that works:
  // ciphertext does not compress. Both sides always compress, so there is no
  // encoding field to negotiate and no downgrade to get wrong.
  //
  // This leaks compressed length to the relay. Plaintext length was already
  // observable, so this narrows rather than widens what a length reveals, and
  // the relay still never holds a key.
  async function compressBytes(bytes) {
    if (typeof CompressionStream !== "function") {
      throw new Error("This browser cannot compress Shared View payloads.");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function decompressBytes(bytes) {
    if (typeof DecompressionStream !== "function") {
      throw new Error("This browser cannot decompress Shared View payloads.");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function encodePayload(payload) {
    return compressBytes(new TextEncoder().encode(JSON.stringify(payload)));
  }

  async function decodePayload(plaintext) {
    return JSON.parse(new TextDecoder().decode(await decompressBytes(new Uint8Array(plaintext))));
  }

  function validateInteractivePayload(kind, payload) {
    if (kind === "host-confirm") return validatePairingConfirmation(payload, "host");
    if (kind === "guest-confirm") return validatePairingConfirmation(payload, "guest");
    if (kind === "grant") return Boolean(Contract?.validateCapabilityGrant(payload));
    if (kind === "snapshot") return Boolean(Contract?.validateSnapshot(payload));
    if (kind === "patch") return Boolean(Contract?.validateSnapshotPatch(payload));
    if (kind === "host-presence") return Boolean(Contract?.validateEncodedHostPresence(payload));
    if (kind === "guest-presence") return Boolean(Contract?.validateEncodedGuestPresence(payload));
    if (kind === "host-chat") return Boolean(Contract?.validateChat(payload) && payload.sender === "host");
    if (kind === "guest-chat") return Boolean(Contract?.validateChat(payload) && payload.sender === "guest");
    if (kind === "host-ink") return Boolean(Contract?.validateInk(payload) && payload.sender === "host");
    if (kind === "guest-ink") return Boolean(Contract?.validateInk(payload) && payload.sender === "guest");
    if (kind === "host-avatar") return Boolean(Contract?.validateAvatar(payload) && payload.sender === "host");
    if (kind === "guest-avatar") return Boolean(Contract?.validateAvatar(payload) && payload.sender === "guest");
    if (kind === "guest-asset-request") return Boolean(Contract?.validateAssetRequest(payload));
    if (kind === "remove") return validateRemove(payload);
    return false;
  }

  function interactivePayloadSequence(payload) {
    return Array.isArray(payload) ? payload[0] : payload?.sequence;
  }

  function interactiveAdditionalData(envelope) {
    return new TextEncoder().encode([
      envelope.type,
      envelope.version,
      envelope.roomId,
      envelope.participantId,
      envelope.kind,
      envelope.sequence,
      envelope.encoding
    ].join(":"));
  }

  async function encryptInteractive({ payload, roomId, participantId, kind, key }) {
    if (!validateRoomId(roomId) || !ROOM_PATTERN.test(String(participantId || "")) || !interactiveKinds.has(kind)) {
      throw new Error("The interactive Shared View routing data is invalid.");
    }
    if (!validateInteractivePayload(kind, payload) || payload.participantId && payload.participantId !== participantId) {
      throw new Error("Cannot encrypt invalid interactive Shared View data.");
    }
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    let encoding = "json";
    let plaintext = encoded;
    if (compressedInteractiveKinds.has(kind)) {
      try {
        plaintext = await compressBytes(encoded);
        encoding = "gzip-json";
      } catch (_error) {
        // Safari exposes CompressionStream in extension content worlds where
        // the actual stream operation can still fail. V2 authenticates the
        // selected encoding, so falling back to encrypted JSON is explicit.
      }
    }
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
    const envelope = {
      type: INTERACTIVE_ENVELOPE_TYPE,
      version: INTERACTIVE_VERSION,
      roomId,
      participantId,
      kind,
      sequence: interactivePayloadSequence(payload),
      encoding,
      iv: bytesToBase64Url(ivBytes),
      ciphertext: ""
    };
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: ivBytes, additionalData: interactiveAdditionalData(envelope) },
      key,
      plaintext
    );
    envelope.ciphertext = bytesToBase64Url(ciphertext);
    if (envelope.ciphertext.length > MAX_CIPHERTEXT_CHARACTERS) {
      throw new Error("The encrypted Shared View update exceeds the message limit.");
    }
    return envelope;
  }

  async function decryptInteractive({ envelope, roomId, participantId, expectedKind, key }) {
    if (
      !validateInteractiveEnvelope(envelope) ||
      envelope.roomId !== roomId ||
      envelope.participantId !== participantId ||
      envelope.kind !== expectedKind
    ) {
      throw new Error("The interactive Shared View envelope is invalid.");
    }
    let plaintext;
    try {
      plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: base64UrlToBytes(envelope.iv),
          additionalData: interactiveAdditionalData(envelope)
        },
        key,
        base64UrlToBytes(envelope.ciphertext)
      );
    } catch (_error) {
      throw new Error("Interactive message authentication failed.");
    }
    let decodedBytes;
    try {
      decodedBytes = envelope.encoding === "gzip-json"
        ? await decompressBytes(new Uint8Array(plaintext))
        : new Uint8Array(plaintext);
    } catch (_error) {
      throw new Error("Interactive message decompression failed.");
    }
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(decodedBytes));
    } catch (_error) {
      throw new Error("Interactive message JSON decoding failed.");
    }
    if (!validateInteractivePayload(expectedKind, payload) || interactivePayloadSequence(payload) !== envelope.sequence) {
      throw new Error("The decrypted interactive Shared View data is invalid.");
    }
    if (payload.participantId && payload.participantId !== participantId) {
      throw new Error("The interactive participant does not match its envelope.");
    }
    return payload;
  }

  async function encryptPayload({ payload, roomId, key, envelopeType, validate }) {
    if (!validate(payload)) throw new Error("Cannot encrypt invalid Shared View data.");
    if (!validateRoomId(roomId)) throw new Error("Cannot encrypt for an invalid room.");
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
    const envelope = {
      type: envelopeType,
      version: ENVELOPE_VERSION,
      roomId,
      sequence: payload.sequence,
      iv: bytesToBase64Url(ivBytes),
      ciphertext: ""
    };
    const plaintext = await encodePayload(payload);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: ivBytes, additionalData: envelopeAdditionalData(envelope) },
      key,
      plaintext
    );
    envelope.ciphertext = bytesToBase64Url(ciphertext);
    return envelope;
  }

  async function decryptPayload({ envelope, roomId, key, validateEnvelope: validateEncrypted, validatePayload }) {
    if (!validateEncrypted(envelope) || envelope.roomId !== roomId) {
      throw new Error("The encrypted Shared View envelope is invalid.");
    }
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64UrlToBytes(envelope.iv),
        additionalData: envelopeAdditionalData(envelope)
      },
      key,
      base64UrlToBytes(envelope.ciphertext)
    );
    const payload = await decodePayload(plaintext);
    if (!validatePayload(payload) || payload.sequence !== envelope.sequence) {
      throw new Error("The decrypted Shared View data is invalid.");
    }
    return payload;
  }

  async function encryptSnapshot({ snapshot, roomId, key }) {
    return encryptPayload({
      payload: snapshot,
      roomId,
      key,
      envelopeType: ENVELOPE_TYPE,
      validate: (value) => Boolean(Contract && Contract.validateSnapshot(value))
    });
  }

  async function decryptSnapshot({ envelope, roomId, key }) {
    return decryptPayload({
      envelope,
      roomId,
      key,
      validateEnvelope,
      validatePayload: (value) => Boolean(Contract && Contract.validateSnapshot(value))
    });
  }

  async function encryptPatch({ patch, roomId, key }) {
    return encryptPayload({
      payload: patch,
      roomId,
      key,
      envelopeType: PATCH_ENVELOPE_TYPE,
      validate: (value) => Boolean(Contract && Contract.validateSnapshotPatch(value))
    });
  }

  async function decryptPatch({ envelope, roomId, key }) {
    return decryptPayload({
      envelope,
      roomId,
      key,
      validateEnvelope: validatePatchEnvelope,
      validatePayload: (value) => Boolean(Contract && Contract.validateSnapshotPatch(value))
    });
  }

  async function encryptPresence({ presence, roomId, key }) {
    return encryptPayload({
      payload: presence,
      roomId,
      key,
      envelopeType: PRESENCE_ENVELOPE_TYPE,
      validate: (value) => Boolean(Contract && Contract.validatePresence(value))
    });
  }

  async function decryptPresence({ envelope, roomId, key }) {
    return decryptPayload({
      envelope,
      roomId,
      key,
      validateEnvelope: validatePresenceEnvelope,
      validatePayload: (value) => Boolean(Contract && Contract.validatePresence(value))
    });
  }

  globalThis.AmbientSharedViewSession = Object.freeze({
    ENVELOPE_TYPE,
    ENVELOPE_VERSION,
    INTERACTIVE_ENVELOPE_TYPE,
    INTERACTIVE_VERSION,
    PRESENCE_ENVELOPE_TYPE,
    PATCH_ENVELOPE_TYPE,
    MAX_CIPHERTEXT_CHARACTERS,
    base64UrlToBytes,
    bytesToBase64Url,
    createInvitation,
    createInteractiveInvitation,
    createInteractiveKeyPair,
    decryptInteractive,
    decryptPatch,
    decryptPresence,
    decryptSnapshot,
    encryptPresence,
    encryptPatch,
    encryptSnapshot,
    encryptInteractive,
    deriveInteractiveSecrets,
    importKey,
    parseInvitation,
    parseInteractiveInvitation,
    randomParticipantId,
    validateEnvelope,
    validatePresenceEnvelope,
    validatePatchEnvelope,
    validateInteractiveEnvelope,
    validateRoomId
  });
})();
