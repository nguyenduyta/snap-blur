// Shared by content.js (overlay) and options.js (settings page).
// Assigned on globalThis, not declared, so re-injecting into the same tab does not throw.

globalThis.SNAP_BLUR_TOOLS = [
  { name: "blur", label: "Blur", key: "b", group: "hide" },
  { name: "pixelate", label: "Pixelate", key: "p", group: "hide" },
  { name: "box", label: "Redact", key: "k", group: "hide" },
  { name: "pen", label: "Pen", key: "d", group: "draw" },
  { name: "rect", label: "Rectangle", key: "r", group: "draw" },
  { name: "arrow", label: "Arrow", key: "a", group: "draw" },
  { name: "text", label: "Text", key: "t", group: "draw" },
];

// Tool keys merged over the defaults. Only the keys live in storage, never images.
globalThis.snapBlurLoadKeys = async function () {
  const keys = Object.fromEntries(globalThis.SNAP_BLUR_TOOLS.map((t) => [t.name, t.key]));
  try {
    const { toolKeys } = await chrome.storage.sync.get("toolKeys");
    Object.assign(keys, toolKeys);
  } catch (err) {
    console.warn("[Snap Blur] Using default keys:", err);
  }
  return keys;
};

// Normalised form of a keydown, comparable with stored keys.
globalThis.snapBlurKeyOf = function (e) {
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
};

globalThis.snapBlurKeyLabel = function (key) {
  return key === " " ? "Space" : key.toUpperCase();
};
