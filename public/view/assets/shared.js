(() => {
  "use strict";

  const SAFE_TAGS = Object.freeze([
    "article", "aside", "b", "blockquote", "body", "br", "button", "code",
    "dd", "div", "dl", "dt", "em", "fieldset", "figcaption", "figure",
    "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header",
    "hr", "i", "input", "label", "legend", "li", "main", "nav", "ol",
    "option", "p", "pre", "section", "select", "small", "span", "strong",
    "sub", "sup", "table", "tbody", "td", "textarea", "tfoot", "th",
    "thead", "tr", "u", "ul"
  ]);

  const SAFE_STYLES = Object.freeze([
    "align-content", "align-items", "align-self", "aspect-ratio",
    "background-color", "bottom", "border-bottom-color", "border-bottom-left-radius",
    "border-bottom-right-radius", "border-bottom-style", "border-bottom-width",
    "border-collapse", "border-left-color", "border-left-style",
    "border-left-width", "border-right-color", "border-right-style",
    "border-right-width", "border-spacing", "border-top-color",
    "border-top-left-radius", "border-top-right-radius", "border-top-style",
    "border-top-width", "box-shadow", "box-sizing", "color", "column-gap",
    "clear", "display", "flex-basis", "flex-direction", "flex-grow", "flex-shrink", "float",
    "flex-wrap", "font-family", "font-size", "font-style", "font-weight",
    "gap", "grid-auto-columns", "grid-auto-flow", "grid-auto-rows",
    "grid-column", "grid-row", "grid-template-areas", "grid-template-columns",
    "grid-template-rows",
    "height", "justify-content", "justify-items", "justify-self", "left",
    "letter-spacing", "line-height", "margin-bottom", "margin-left",
    "margin-right", "margin-top", "max-height", "max-width", "min-height",
    "min-width", "opacity", "order", "overflow-x", "overflow-y",
    "padding-bottom", "padding-left", "padding-right", "padding-top",
    "place-content", "place-items", "position", "row-gap", "table-layout",
    "right", "text-align", "text-decoration-color", "text-decoration-line",
    "text-decoration-style", "text-indent", "text-transform", "text-wrap", "top", "transform",
    "transform-origin", "vertical-align", "white-space", "width",
    "word-break", "z-index"
  ]);

  const UNSUPPORTED_SURFACES = Object.freeze({
    canvas: "Canvas is not shared in this proof",
    iframe: "Embedded frame is not shared in this proof",
    img: "Image is not shared in this proof",
    audio: "Audio is not shared in this proof",
    video: "Video is not shared in this proof",
    svg: "SVG is not shared in this proof",
    object: "Embedded object is not shared in this proof",
    embed: "Embedded content is not shared in this proof"
  });

  const OMITTED_TAGS = Object.freeze([
    "base", "head", "link", "meta", "noscript", "script", "style", "template",
    "title"
  ]);
  const INTERACTIVE_CAPABILITIES = Object.freeze([
    "view.receive",
    "presence.publish",
    "chat.send"
  ]);

  const safeTagSet = new Set(SAFE_TAGS);
  const safeStyleSet = new Set(SAFE_STYLES);
  const omittedTagSet = new Set(OMITTED_TAGS);
  const interactiveCapabilitySet = new Set(INTERACTIVE_CAPABILITIES);
  const patchAttributeSet = new Set([
    "ariaLabel", "checked", "disabled", "inputType", "placeholder",
    "selected", "selectedIndex", "title", "value"
  ]);
  const PARTICIPANT_PATTERN = /^[A-Za-z0-9_-]{22}$/;
  const MAX_PATCH_OPERATIONS = 256;

  function validBoundedString(value, maximum = 100) {
    return typeof value === "string" && value.length > 0 && value.length <= maximum;
  }

  function validateInteractiveIdentity(value) {
    return Boolean(
      value &&
      validBoundedString(value.sessionId) &&
      PARTICIPANT_PATTERN.test(String(value.participantId || "")) &&
      Number.isInteger(value.sequence) &&
      value.sequence >= 1 &&
      validBoundedString(value.sourceEpoch) &&
      validBoundedString(value.grantId)
    );
  }

  function normalizeTag(tagName) {
    const tag = String(tagName || "").toLowerCase();
    if (safeTagSet.has(tag)) return tag;
    if (tag === "a") return "span";
    return "div";
  }

  function unsupportedLabel(tagName) {
    return UNSUPPORTED_SURFACES[String(tagName || "").toLowerCase()] || null;
  }

  function shouldOmitTag(tagName) {
    return omittedTagSet.has(String(tagName || "").toLowerCase());
  }

  function maskInputValue(inputType, value) {
    if (String(inputType || "").toLowerCase() === "password") {
      return "••••••••";
    }
    return String(value || "").slice(0, 500);
  }

  function normalizeSourceUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return { origin: url.origin, path: url.pathname || "/" };
    } catch (_error) {
      return { origin: "unknown", path: "/" };
    }
  }

  function safeStyleValue(value) {
    const normalized = String(value || "").trim();
    if (!normalized) return null;
    if (/url\s*\(|expression\s*\(|javascript\s*:/i.test(normalized)) return null;
    if (normalized.length > 500) return null;
    return normalized;
  }

  function sanitizeStyleMap(styles) {
    const result = {};
    if (!styles || typeof styles !== "object" || Array.isArray(styles)) return result;
    for (const [property, value] of Object.entries(styles)) {
      if (!safeStyleSet.has(property)) continue;
      const safeValue = safeStyleValue(value);
      if (safeValue !== null) result[property] = safeValue;
    }
    return result;
  }

  function validateRenderNode(node, counters = { count: 0, depth: 0 }) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return false;
    counters.count += 1;
    if (counters.count > 2600 || counters.depth > 50) return false;

    if (node.type === "text") {
      return typeof node.text === "string" && node.text.length <= 20000;
    }
    if (node.type === "placeholder") {
      return typeof node.label === "string" && node.label.length <= 200;
    }
    if (node.type !== "element" || !safeTagSet.has(node.tag)) return false;
    if (node.styles && Object.keys(sanitizeStyleMap(node.styles)).length !== Object.keys(node.styles).length) {
      return false;
    }
    if (node.attributes && (typeof node.attributes !== "object" || Array.isArray(node.attributes))) {
      return false;
    }
    if (!Array.isArray(node.children)) return false;

    for (const child of node.children) {
      const childCounters = { count: counters.count, depth: counters.depth + 1 };
      if (!validateRenderNode(child, childCounters)) return false;
      counters.count = childCounters.count;
    }
    return true;
  }

  function validateSnapshot(snapshot) {
    if (!snapshot || snapshot.type !== "shared-view-snapshot" || snapshot.version !== 0) return false;
    if (!Number.isInteger(snapshot.sequence) || snapshot.sequence < 1) return false;
    if (!snapshot.sessionId || typeof snapshot.sessionId !== "string") return false;
    if (!snapshot.source || typeof snapshot.source.title !== "string") return false;
    if (!snapshot.viewport || !Number.isFinite(snapshot.viewport.width) || !Number.isFinite(snapshot.viewport.height)) {
      return false;
    }
    if (snapshot.display !== undefined) {
      const display = snapshot.display;
      if (
        !display ||
        !Number.isFinite(display.pixelRatio) || display.pixelRatio < 0.1 || display.pixelRatio > 10 ||
        !Number.isFinite(display.screenWidth) || display.screenWidth < 1 ||
        !Number.isFinite(display.screenHeight) || display.screenHeight < 1 ||
        !Number.isFinite(display.availableWidth) || display.availableWidth < 1 ||
        !Number.isFinite(display.availableHeight) || display.availableHeight < 1 ||
        !Number.isFinite(display.colorDepth) || display.colorDepth < 1 ||
        !Number.isInteger(display.touchPoints) || display.touchPoints < 0 ||
        typeof display.coarsePointer !== "boolean"
      ) {
        return false;
      }
    }
    return validateRenderNode(snapshot.root);
  }

  function sameRecord(left, right) {
    return JSON.stringify(left || {}) === JSON.stringify(right || {});
  }

  function createRecordPatch(previous, next) {
    const before = previous || {};
    const after = next || {};
    const set = {};
    const remove = [];
    for (const [key, value] of Object.entries(after)) {
      if (before[key] !== value) set[key] = value;
    }
    for (const key of Object.keys(before)) {
      if (!(key in after)) remove.push(key);
    }
    return Object.keys(set).length || remove.length ? { set, remove } : null;
  }

  function collectSnapshotPatchOperations(previousNode, nextNode, path, operations) {
    if (operations.length > MAX_PATCH_OPERATIONS) return;
    if (
      previousNode.type !== nextNode.type ||
      (previousNode.type === "element" && previousNode.tag !== nextNode.tag) ||
      (previousNode.type === "placeholder" && (
        previousNode.label !== nextNode.label ||
        previousNode.width !== nextNode.width ||
        previousNode.height !== nextNode.height
      ))
    ) {
      operations.push({ op: "replace", path, node: nextNode });
      return;
    }
    if (nextNode.type === "text") {
      if (previousNode.text !== nextNode.text) operations.push({ op: "text", path, text: nextNode.text });
      return;
    }
    if (nextNode.type === "placeholder") {
      if (!sameRecord(previousNode.styles, nextNode.styles)) {
        operations.push({ op: "replace", path, node: nextNode });
      }
      return;
    }
    if (previousNode.children.length !== nextNode.children.length) {
      operations.push({ op: "children", path, children: nextNode.children });
    }
    const styles = createRecordPatch(previousNode.styles, nextNode.styles);
    const attributes = createRecordPatch(previousNode.attributes, nextNode.attributes);
    if (previousNode.sourceTag !== nextNode.sourceTag || styles || attributes) {
      const operation = { op: "element", path };
      if (previousNode.sourceTag !== nextNode.sourceTag) operation.sourceTag = nextNode.sourceTag;
      if (styles) operation.styles = styles;
      if (attributes) operation.attributes = attributes;
      operations.push(operation);
    }
    if (previousNode.children.length !== nextNode.children.length) return;
    for (let index = 0; index < nextNode.children.length; index += 1) {
      collectSnapshotPatchOperations(previousNode.children[index], nextNode.children[index], [...path, index], operations);
      if (operations.length > MAX_PATCH_OPERATIONS) return;
    }
  }

  function createSnapshotPatch(previousSnapshot, nextSnapshot) {
    if (!validateSnapshot(previousSnapshot) || !validateSnapshot(nextSnapshot)) return null;
    if (
      previousSnapshot.sessionId !== nextSnapshot.sessionId ||
      nextSnapshot.sequence <= previousSnapshot.sequence
    ) {
      return null;
    }
    const operations = [];
    collectSnapshotPatchOperations(previousSnapshot.root, nextSnapshot.root, [], operations);
    if (operations.length > MAX_PATCH_OPERATIONS) return null;
    const patch = {
      type: "shared-view-patch",
      version: 0,
      sessionId: nextSnapshot.sessionId,
      sequence: nextSnapshot.sequence,
      baseSequence: previousSnapshot.sequence,
      capturedAt: nextSnapshot.capturedAt,
      source: nextSnapshot.source,
      viewport: nextSnapshot.viewport,
      diagnostics: nextSnapshot.diagnostics,
      operations
    };
    if (nextSnapshot.display !== undefined) patch.display = nextSnapshot.display;
    return patch;
  }

  function validatePatchPath(path) {
    return Boolean(
      Array.isArray(path) &&
      path.length <= 35 &&
      path.every((index) => Number.isInteger(index) && index >= 0 && index < 1500)
    );
  }

  function validateSnapshotPatch(patch) {
    if (!patch || patch.type !== "shared-view-patch" || patch.version !== 0) return false;
    if (!validBoundedString(patch.sessionId)) return false;
    if (!Number.isInteger(patch.sequence) || !Number.isInteger(patch.baseSequence)) return false;
    if (patch.sequence <= patch.baseSequence || patch.baseSequence < 1) return false;
    if (!Number.isFinite(patch.capturedAt)) return false;
    if (!patch.source || !validBoundedString(patch.source.title, 200)) return false;
    if (!patch.viewport || !Number.isFinite(patch.viewport.width) || !Number.isFinite(patch.viewport.height)) return false;
    if (!validateSnapshot({
      ...patch,
      type: "shared-view-snapshot",
      version: 0,
      root: { type: "element", tag: "body", styles: {}, attributes: {}, children: [] }
    })) return false;
    if (!Array.isArray(patch.operations) || patch.operations.length > MAX_PATCH_OPERATIONS) return false;
    for (const operation of patch.operations) {
      if (!operation || !validatePatchPath(operation.path)) return false;
      if (operation.op === "text") {
        if (typeof operation.text !== "string" || operation.text.length > 20000) return false;
        continue;
      }
      if (operation.op === "element") {
        if (
          operation.sourceTag !== undefined &&
          (typeof operation.sourceTag !== "string" || !operation.sourceTag || operation.sourceTag.length > 30)
        ) return false;
        if (!operation.styles && !operation.attributes && operation.sourceTag === undefined) return false;
        if (operation.styles) {
          if (
            !operation.styles.set || typeof operation.styles.set !== "object" || Array.isArray(operation.styles.set) ||
            !Array.isArray(operation.styles.remove) ||
            Object.keys(sanitizeStyleMap(operation.styles.set)).length !== Object.keys(operation.styles.set).length ||
            operation.styles.remove.some((property) => !safeStyleSet.has(property))
          ) return false;
        }
        if (operation.attributes && (
          !operation.attributes.set || typeof operation.attributes.set !== "object" || Array.isArray(operation.attributes.set) ||
          !Array.isArray(operation.attributes.remove) ||
          Object.keys(operation.attributes.set).some((attribute) => !patchAttributeSet.has(attribute)) ||
          operation.attributes.remove.some((attribute) => !patchAttributeSet.has(attribute))
        )) return false;
        continue;
      }
      if (
        operation.op === "children" &&
        Array.isArray(operation.children) &&
        operation.children.every((child) => validateRenderNode(child))
      ) continue;
      if (operation.op === "replace" && validateRenderNode(operation.node)) continue;
      return false;
    }
    return true;
  }

  function nodeAtPath(root, path) {
    let node = root;
    for (const index of path) {
      if (node?.type !== "element" || !Array.isArray(node.children) || index >= node.children.length) return null;
      node = node.children[index];
    }
    return node;
  }

  function applySnapshotPatch(snapshot, patch) {
    if (!validateSnapshot(snapshot) || !validateSnapshotPatch(patch)) return null;
    if (snapshot.sessionId !== patch.sessionId || snapshot.sequence !== patch.baseSequence) return null;
    const root = JSON.parse(JSON.stringify(snapshot.root));
    for (const operation of patch.operations) {
      if (operation.op === "replace" && operation.path.length === 0) {
        Object.assign(root, JSON.parse(JSON.stringify(operation.node)));
        for (const key of Object.keys(root)) {
          if (!(key in operation.node)) delete root[key];
        }
        continue;
      }
      const node = nodeAtPath(root, operation.path);
      if (!node) return null;
      if (operation.op === "text") {
        if (node.type !== "text") return null;
        node.text = operation.text;
        continue;
      }
      if (operation.op === "element") {
        if (node.type !== "element") return null;
        if (Object.hasOwn(operation, "sourceTag")) node.sourceTag = operation.sourceTag;
        node.styles ||= {};
        node.attributes ||= {};
        for (const property of operation.styles?.remove || []) delete node.styles[property];
        for (const [property, value] of Object.entries(operation.styles?.set || {})) node.styles[property] = value;
        for (const attribute of operation.attributes?.remove || []) delete node.attributes[attribute];
        for (const [attribute, value] of Object.entries(operation.attributes?.set || {})) node.attributes[attribute] = value;
        continue;
      }
      if (operation.op === "children") {
        if (node.type !== "element") return null;
        node.children = JSON.parse(JSON.stringify(operation.children));
        continue;
      }
      if (operation.path.length === 0) return null;
      const parent = nodeAtPath(root, operation.path.slice(0, -1));
      const index = operation.path.at(-1);
      if (parent?.type !== "element" || index >= parent.children.length) return null;
      parent.children[index] = JSON.parse(JSON.stringify(operation.node));
    }
    const result = {
      type: "shared-view-snapshot",
      version: 0,
      sessionId: patch.sessionId,
      sequence: patch.sequence,
      capturedAt: patch.capturedAt,
      source: patch.source,
      viewport: patch.viewport,
      diagnostics: patch.diagnostics,
      root
    };
    if (patch.display !== undefined) result.display = patch.display;
    return validateSnapshot(result) ? result : null;
  }

  function validatePresence(presence) {
    if (!presence || presence.type !== "shared-view-presence" || presence.version !== 0) return false;
    if (!presence.sessionId || typeof presence.sessionId !== "string" || presence.sessionId.length > 100) return false;
    if (!Number.isInteger(presence.sequence) || presence.sequence < 1) return false;
    if (!Number.isFinite(presence.capturedAt)) return false;
    if (!presence.viewport || !Number.isFinite(presence.viewport.scrollX) || !Number.isFinite(presence.viewport.scrollY)) {
      return false;
    }
    if (presence.viewport.scrollX < 0 || presence.viewport.scrollY < 0) return false;
    if (!presence.cursor || !Number.isFinite(presence.cursor.x) || !Number.isFinite(presence.cursor.y)) return false;
    if (presence.cursor.x < 0 || presence.cursor.y < 0 || typeof presence.cursor.visible !== "boolean") return false;
    return true;
  }

  function validateCapabilities(capabilities) {
    return Boolean(
      Array.isArray(capabilities) &&
      capabilities.length >= 1 &&
      capabilities.length <= INTERACTIVE_CAPABILITIES.length &&
      new Set(capabilities).size === capabilities.length &&
      capabilities.every((capability) => interactiveCapabilitySet.has(capability))
    );
  }

  function validateCapabilityGrant(grant) {
    if (!grant || grant.type !== "shared-view-capability-grant" || grant.version !== 1) return false;
    if (!validateInteractiveIdentity(grant)) return false;
    if (!Number.isFinite(grant.issuedAt) || !Number.isFinite(grant.expiresAt)) return false;
    if (grant.expiresAt <= grant.issuedAt || grant.expiresAt - grant.issuedAt > 30 * 60 * 1000) return false;
    return validateCapabilities(grant.capabilities);
  }

  function capabilityGrantAllows(grant, capability, payload = null, now = Date.now()) {
    if (!validateCapabilityGrant(grant)) return false;
    if (!interactiveCapabilitySet.has(capability) || !grant.capabilities.includes(capability)) return false;
    if (!Number.isFinite(now) || grant.expiresAt <= now) return false;
    if (!payload) return true;
    return Boolean(
      payload.sessionId === grant.sessionId &&
      payload.participantId === grant.participantId &&
      payload.sourceEpoch === grant.sourceEpoch &&
      payload.grantId === grant.grantId
    );
  }

  function validateGuestPresence(presence) {
    if (!presence || presence.type !== "shared-view-guest-presence" || presence.version !== 1) return false;
    if (!validateInteractiveIdentity(presence) || !Number.isFinite(presence.capturedAt)) return false;
    if (typeof presence.sharing !== "boolean") return false;
    if (!presence.viewport || !Number.isFinite(presence.viewport.scrollX) || !Number.isFinite(presence.viewport.scrollY)) {
      return false;
    }
    if (presence.viewport.scrollX < 0 || presence.viewport.scrollY < 0) return false;
    if (!presence.cursor || !Number.isFinite(presence.cursor.x) || !Number.isFinite(presence.cursor.y)) return false;
    if (presence.cursor.x < 0 || presence.cursor.y < 0 || typeof presence.cursor.visible !== "boolean") return false;
    return true;
  }

  function encodeHostPresence(presence) {
    if (!validatePresence(presence)) return null;
    return [
      presence.sequence,
      Math.round(presence.capturedAt),
      Math.round(presence.viewport.scrollX),
      Math.round(presence.viewport.scrollY),
      Math.round(presence.cursor.x),
      Math.round(presence.cursor.y),
      presence.cursor.visible ? 1 : 0
    ];
  }

  function validateEncodedHostPresence(value) {
    return Boolean(
      Array.isArray(value) &&
      value.length === 7 &&
      Number.isInteger(value[0]) && value[0] >= 1 &&
      Number.isFinite(value[1]) &&
      value.slice(2, 6).every((number) => Number.isInteger(number) && number >= 0) &&
      (value[6] === 0 || value[6] === 1)
    );
  }

  function decodeHostPresence(value, sessionId) {
    if (!validateEncodedHostPresence(value) || !validBoundedString(sessionId)) return null;
    return {
      type: "shared-view-presence",
      version: 0,
      sessionId,
      sequence: value[0],
      capturedAt: value[1],
      viewport: { scrollX: value[2], scrollY: value[3] },
      cursor: { x: value[4], y: value[5], visible: value[6] === 1 }
    };
  }

  function encodeGuestPresence(presence) {
    if (!validateGuestPresence(presence)) return null;
    return [
      presence.sequence,
      Math.round(presence.capturedAt),
      presence.grantId,
      presence.sharing ? 1 : 0,
      Math.round(presence.viewport.scrollX),
      Math.round(presence.viewport.scrollY),
      Math.round(presence.cursor.x),
      Math.round(presence.cursor.y),
      presence.cursor.visible ? 1 : 0
    ];
  }

  function validateEncodedGuestPresence(value) {
    return Boolean(
      Array.isArray(value) &&
      value.length === 9 &&
      Number.isInteger(value[0]) && value[0] >= 1 &&
      Number.isFinite(value[1]) &&
      validBoundedString(value[2]) &&
      (value[3] === 0 || value[3] === 1) &&
      value.slice(4, 8).every((number) => Number.isInteger(number) && number >= 0) &&
      (value[8] === 0 || value[8] === 1)
    );
  }

  function decodeGuestPresence(value, grant) {
    if (!validateEncodedGuestPresence(value) || !validateCapabilityGrant(grant) || value[2] !== grant.grantId) return null;
    return {
      type: "shared-view-guest-presence",
      version: 1,
      sessionId: grant.sessionId,
      participantId: grant.participantId,
      sequence: value[0],
      capturedAt: value[1],
      sourceEpoch: grant.sourceEpoch,
      grantId: value[2],
      sharing: value[3] === 1,
      viewport: { scrollX: value[4], scrollY: value[5] },
      cursor: { x: value[6], y: value[7], visible: value[8] === 1 }
    };
  }

  function validateChat(chat) {
    if (!chat || chat.type !== "shared-view-chat" || chat.version !== 1) return false;
    if (!validateInteractiveIdentity(chat) || !Number.isFinite(chat.sentAt)) return false;
    if (chat.sender !== "host" && chat.sender !== "guest") return false;
    return typeof chat.text === "string" && chat.text.trim().length > 0 && chat.text.length <= 500;
  }

  globalThis.AmbientSharedViewContract = Object.freeze({
    SAFE_TAGS,
    SAFE_STYLES,
    INTERACTIVE_CAPABILITIES,
    UNSUPPORTED_SURFACES,
    OMITTED_TAGS,
    capabilityGrantAllows,
    applySnapshotPatch,
    createSnapshotPatch,
    decodeGuestPresence,
    decodeHostPresence,
    encodeGuestPresence,
    encodeHostPresence,
    maskInputValue,
    normalizeSourceUrl,
    normalizeTag,
    sanitizeStyleMap,
    shouldOmitTag,
    unsupportedLabel,
    validatePresence,
    validateCapabilities,
    validateCapabilityGrant,
    validateChat,
    validateGuestPresence,
    validateEncodedGuestPresence,
    validateEncodedHostPresence,
    validateRenderNode,
    validateSnapshotPatch,
    validateSnapshot
  });
})();
