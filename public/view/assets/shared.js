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
    "background-color", "background-position", "background-repeat", "background-size", "bottom", "border-bottom-color", "border-bottom-left-radius",
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
    "word-break", "overflow-wrap", "hyphens", "tab-size", "word-spacing",
    "z-index"
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
    "chat.send",
    "ink.publish",
    "avatar.publish"
  ]);

  // A fixed palette keeps arbitrary CSS off the wire. Indices travel, not
  // colours. See SPEC-0015.
  const INK_COLORS = Object.freeze([
    "#f43f5e", "#f59e0b", "#22c55e", "#38bdf8", "#a855f7", "#f8fafc"
  ]);
  const INK_MODES = Object.freeze(["laser", "pinned"]);
  const MAX_INK_POINTS_PER_FRAME = 64;
  const MAX_INK_STROKE_POINTS = 2000;
  const MAX_INK_WIDTH = 12;

  const safeTagSet = new Set(SAFE_TAGS);
  const safeStyleSet = new Set(SAFE_STYLES);
  const omittedTagSet = new Set(OMITTED_TAGS);
  const interactiveCapabilitySet = new Set(INTERACTIVE_CAPABILITIES);
  const patchAttributeSet = new Set([
    "ariaLabel", "checked", "disabled", "inputType", "placeholder",
    "selected", "selectedIndex", "title", "value", "backgroundImageUrl",
    "scrollTop", "scrollLeft"
  ]);
  const PARTICIPANT_PATTERN = /^[A-Za-z0-9_-]{22}$/;
  const MAX_PATCH_OPERATIONS = 256;
  // Receiver ceiling. Must stay above the capture ceiling in content.js, with
  // headroom, or a capture at the limit would be rejected on arrival.
  const MAX_RENDER_NODES = 13000;
  // Rasterized icons are PNGs, so unlike the render tree they do not compress
  // further. These caps are therefore close to a direct wire cost.
  const MAX_VISUAL_ASSETS = 192;
  const MAX_VISUAL_ASSET_DATA_LENGTH = 750000;
  const MAX_VISUAL_ASSET_TOTAL_LENGTH = 4000000;
  const MAX_STYLE_SHEETS = 64;
  const MAX_STYLE_SHEET_LENGTH = 2000000;
  const MAX_STYLE_TOTAL_LENGTH = 6000000;
  const MAX_REMOTE_FONTS = 16;
  const MAX_REMOTE_FONT_DATA_LENGTH = 300000;

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

  // The display label is prose and may be reworded. Fidelity scoring needs a
  // stable machine-readable kind to count placeholders by category, so carry
  // both. See SPEC-0014.
  function unsupportedKind(tagName) {
    const tag = String(tagName || "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(UNSUPPORTED_SURFACES, tag) ? tag : null;
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

  function normalizeRemoteAssetUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""));
      if (!["http:", "https:"].includes(url.protocol)) return null;
      if (url.username || url.password || url.href.length > 2048) return null;
      return url.href;
    } catch (_error) {
      return null;
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

  // Stylesheet text is carried for layout only. The receiver renders it as CSS
  // inside an isolated frame; it is never executed and never becomes script.
  // Anything that could escape that boundary is rejected here rather than
  // sanitized, because a partially sanitized stylesheet is harder to reason
  // about than a rejected one. See ADR-0005.
  function validateStyleSheets(sheets) {
    if (sheets === undefined) return true;
    if (!Array.isArray(sheets) || sheets.length > MAX_STYLE_SHEETS) return false;
    let totalLength = 0;
    for (const sheet of sheets) {
      if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) return false;
      if (sheet.unreadable !== undefined) {
        if (sheet.unreadable !== true) return false;
        if (sheet.href !== null && normalizeRemoteAssetUrl(sheet.href) !== sheet.href) return false;
        continue;
      }
      if (typeof sheet.cssText !== "string" || !sheet.cssText.length) return false;
      if (sheet.cssText.length > MAX_STYLE_SHEET_LENGTH) return false;
      // `@import` would make the receiver fetch further sheets we never
      // inspected; javascript: and expression() are historic script vectors.
      if (/@import|javascript\s*:|expression\s*\(/iu.test(sheet.cssText)) return false;
      if (sheet.media !== undefined && (typeof sheet.media !== "string" || sheet.media.length > 200)) return false;
      totalLength += sheet.cssText.length;
      if (totalLength > MAX_STYLE_TOTAL_LENGTH) return false;
    }
    return true;
  }

  function validateVisualAssets(assets) {
    if (assets === undefined) return true;
    if (!assets || typeof assets !== "object" || Array.isArray(assets)) return false;
    const entries = Object.entries(assets);
    if (entries.length > MAX_VISUAL_ASSETS) return false;
    let totalLength = 0;
    for (const [assetId, asset] of entries) {
      if (!PARTICIPANT_PATTERN.test(assetId)) return false;
      if (!asset || typeof asset !== "object" || Array.isArray(asset)) return false;
      if (asset.mime !== "image/png" && asset.mime !== "image/webp") return false;
      if (!Number.isInteger(asset.width) || asset.width < 1 || asset.width > 2048) return false;
      if (!Number.isInteger(asset.height) || asset.height < 1 || asset.height > 2048) return false;
      if (
        typeof asset.dataUrl !== "string" ||
        asset.dataUrl.length > MAX_VISUAL_ASSET_DATA_LENGTH ||
        !asset.dataUrl.startsWith(`data:${asset.mime};base64,`)
      ) return false;
      totalLength += asset.dataUrl.length;
      if (totalLength > MAX_VISUAL_ASSET_TOTAL_LENGTH) return false;
    }
    return true;
  }

  function visualAssetMimeFromDataUrl(dataUrl) {
    if (typeof dataUrl !== "string") return null;
    return /^data:(image\/(?:png|webp));base64,/u.exec(dataUrl)?.[1] || null;
  }

  function validateRemoteFonts(fonts) {
    if (fonts === undefined) return true;
    if (!Array.isArray(fonts) || fonts.length > MAX_REMOTE_FONTS) return false;
    return fonts.every((font) => Boolean(
      font &&
      typeof font === "object" &&
      !Array.isArray(font) &&
      validBoundedString(font.family) &&
      font.family.length <= 100 &&
      !/[{};]/u.test(font.family) &&
      validBoundedString(font.weight, 30) &&
      /^[1-9]00(?: [1-9]00)?$|^(?:normal|bold)$/u.test(font.weight) &&
      validBoundedString(font.style, 30) &&
      /^(?:normal|italic|oblique(?: -?[0-9]+(?:\.[0-9]+)?deg)?)$/u.test(font.style) &&
      normalizeRemoteAssetUrl(font.url) === font.url &&
      (font.dataUrl === undefined || (
        typeof font.dataUrl === "string" &&
        font.dataUrl.length <= MAX_REMOTE_FONT_DATA_LENGTH &&
        /^data:font\/woff2;base64,[A-Za-z0-9+/=]+$/u.test(font.dataUrl)
      ))
    ));
  }

  function validateRenderNode(node, counters = { count: 0, depth: 0 }) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return false;
    counters.count += 1;
    if (counters.count > MAX_RENDER_NODES || counters.depth > 50) return false;

    if (node.i !== undefined && (!Number.isInteger(node.i) || node.i < 1 || node.i > 5_000_000)) return false;
    if (node.type === "text") {
      return typeof node.text === "string" && node.text.length <= 20000;
    }
    if (node.type === "placeholder") {
      return Boolean(
        typeof node.label === "string" &&
        node.label.length <= 200 &&
        (node.kind === undefined || unsupportedKind(node.kind) === node.kind) &&
        (node.assetId === undefined || PARTICIPANT_PATTERN.test(node.assetId)) &&
        (node.remoteUrl === undefined || normalizeRemoteAssetUrl(node.remoteUrl) === node.remoteUrl)
      );
    }
    if (node.type !== "element" || !safeTagSet.has(node.tag)) return false;
    if (node.styles && Object.keys(sanitizeStyleMap(node.styles)).length !== Object.keys(node.styles).length) {
      return false;
    }
    if (node.attributes && (typeof node.attributes !== "object" || Array.isArray(node.attributes))) {
      return false;
    }
    if (
      node.attributes &&
      (Object.keys(node.attributes).some((attribute) => !patchAttributeSet.has(attribute)) ||
        (node.attributes.backgroundImageUrl !== undefined &&
          normalizeRemoteAssetUrl(node.attributes.backgroundImageUrl) !== node.attributes.backgroundImageUrl))
    ) return false;
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
    if (!validateVisualAssets(snapshot.assets)) return false;
    if (!validateStyleSheets(snapshot.styleSheets)) return false;
    if (!validateRemoteFonts(snapshot.fonts)) return false;
    if (!validateRenderNode(snapshot.root)) return false;
    let validReferences = true;
    const visit = (node) => {
      if (node?.type === "placeholder" && node.assetId && !snapshot.assets?.[node.assetId]) validReferences = false;
      for (const child of node?.children || []) visit(child);
    };
    visit(snapshot.root);
    return validReferences;
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
        previousNode.height !== nextNode.height ||
        previousNode.assetId !== nextNode.assetId ||
        previousNode.remoteUrl !== nextNode.remoteUrl
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
    if (!sameRecord(previousSnapshot.fonts, nextSnapshot.fonts)) patch.fonts = nextSnapshot.fonts || [];
    const addedAssets = {};
    for (const [assetId, asset] of Object.entries(nextSnapshot.assets || {})) {
      if (JSON.stringify(previousSnapshot.assets?.[assetId]) !== JSON.stringify(asset)) addedAssets[assetId] = asset;
    }
    if (Object.keys(addedAssets).length) patch.assets = addedAssets;
    return patch;
  }

  function patchHasRenderableChanges(patch) {
    return Boolean(
      patch &&
      (
        (Array.isArray(patch.operations) && patch.operations.length > 0) ||
        patch.fonts !== undefined ||
        Object.keys(patch.assets || {}).length > 0
      )
    );
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
      assets: patch.assets || {},
      root: { type: "element", tag: "body", styles: {}, attributes: {}, children: [] }
    })) return false;
    if (!validateVisualAssets(patch.assets)) return false;
    if (!validateRemoteFonts(patch.fonts)) return false;
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
    if (snapshot.assets !== undefined || patch.assets !== undefined) {
      result.assets = { ...(snapshot.assets || {}), ...(patch.assets || {}) };
    }
    if (snapshot.fonts !== undefined || patch.fonts !== undefined) result.fonts = patch.fonts || snapshot.fonts || [];
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
    if (
      grant.hostDisplayName !== undefined &&
      (typeof grant.hostDisplayName !== "string" || grant.hostDisplayName.trim().length < 1 || grant.hostDisplayName.length > 40)
    ) return false;
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

  // Anchor validation is deliberately borrowed rather than copied. anchor.js
  // loads after this module, so resolve it at call time and fail closed when it
  // is absent: an unvalidated point must never reach a renderer.
  function validateInkPoint(point) {
    const Anchor = globalThis.AmbientSharedViewAnchor;
    return Boolean(Anchor?.validatePoint(point));
  }

  function validateInk(ink) {
    if (!ink || ink.type !== "shared-view-ink" || ink.version !== 1) return false;
    if (!validateInteractiveIdentity(ink) || !Number.isFinite(ink.capturedAt)) return false;
    if (ink.sender !== "host" && ink.sender !== "guest") return false;
    if (!validBoundedString(ink.strokeId, 64)) return false;
    if (!INK_MODES.includes(ink.mode)) return false;
    if (!Number.isInteger(ink.color) || ink.color < 0 || ink.color >= INK_COLORS.length) return false;
    if (!Number.isFinite(ink.width) || ink.width <= 0 || ink.width > MAX_INK_WIDTH) return false;
    if (typeof ink.done !== "boolean") return false;
    if (!Array.isArray(ink.points) || ink.points.length > MAX_INK_POINTS_PER_FRAME) return false;
    // A frame with no points is only meaningful as the end of a stroke.
    if (!ink.points.length && !ink.done) return false;
    return ink.points.every(validateInkPoint);
  }

  function validateAvatar(avatar) {
    if (!avatar || avatar.type !== "shared-view-avatar" || avatar.version !== 1) return false;
    if (!validateInteractiveIdentity(avatar) || !Number.isFinite(avatar.capturedAt)) return false;
    if (avatar.sender !== "host" && avatar.sender !== "guest") return false;
    if (!validateInkPoint(avatar.at)) return false;
    if (![avatar.x, avatar.y, avatar.vx, avatar.vy].every((value) => Number.isFinite(value) && Math.abs(value) <= 1_000_000)) return false;
    if (avatar.viewport !== undefined && !(
      avatar.viewport &&
      Number.isFinite(avatar.viewport.width) && avatar.viewport.width > 0 && avatar.viewport.width <= 100_000 &&
      Number.isFinite(avatar.viewport.height) && avatar.viewport.height > 0 && avatar.viewport.height <= 100_000
    )) return false;
    if (avatar.facing !== -1 && avatar.facing !== 1) return false;
    if (!avatar.input || !Number.isFinite(avatar.input.direction) || avatar.input.direction < -1 || avatar.input.direction > 1) return false;
    if (typeof avatar.input.jump !== "boolean" || typeof avatar.input.drop !== "boolean") return false;
    return ["grounded", "airborne", "wallslide"].includes(avatar.state);
  }

  // Staged asset delivery. A referenced image is far cheaper than an inlined
  // one, but it fails on session-gated or unreachable resources. The guest
  // reports which node identities failed and the host inlines only those, so
  // the cheap path stays the default and the expensive path is targeted.
  // See SPEC-0019.
  function validateAssetRequest(request) {
    if (!request || request.type !== "shared-view-asset-request" || request.version !== 1) return false;
    if (!validateInteractiveIdentity(request) || !Number.isFinite(request.requestedAt)) return false;
    if (!Array.isArray(request.nodeIds) || !request.nodeIds.length || request.nodeIds.length > 64) return false;
    return request.nodeIds.every((id) => Number.isInteger(id) && id >= 1 && id <= 5_000_000);
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
    MAX_RENDER_NODES,
    INK_COLORS,
    INK_MODES,
    MAX_INK_POINTS_PER_FRAME,
    MAX_INK_STROKE_POINTS,
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
    normalizeRemoteAssetUrl,
    normalizeTag,
    patchHasRenderableChanges,
    sanitizeStyleMap,
    shouldOmitTag,
    unsupportedKind,
    unsupportedLabel,
    validatePatchPath,
    validatePresence,
    validateCapabilities,
    validateCapabilityGrant,
    validateChat,
    validateInk,
    validateAvatar,
    validateAssetRequest,
    validateGuestPresence,
    validateEncodedGuestPresence,
    validateEncodedHostPresence,
    validateRenderNode,
    validateRemoteFonts,
    validateVisualAssets,
    visualAssetMimeFromDataUrl,
    validateStyleSheets,
    validateSnapshotPatch,
    validateSnapshot
  });
})();
