// Settings page: shows the browser-owned capture shortcut and edits markup tool keys.

const TOOLS = globalThis.SNAP_BLUR_TOOLS;
const DEFAULTS = Object.fromEntries(TOOLS.map((t) => [t.name, t.key]));
const GROUP_LABEL = { hide: "Hide information", draw: "Annotate" };

const toolsEl = document.getElementById("tools");
const statusEl = document.getElementById("status");
let keys = {};
let listening = null; // { name, button } while waiting for a key

init();

async function init() {
  keys = await globalThis.snapBlurLoadKeys();
  renderTools();
  showCaptureKey();
  // The user may change the browser shortcut in another tab and come back.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) showCaptureKey();
  });
}

async function showCaptureKey() {
  const commands = await chrome.commands.getAll();
  const cmd = commands.find((c) => c.name === "_execute_action");
  document.getElementById("captureKey").textContent = cmd?.shortcut || "Not set";
}

document.getElementById("openShortcuts").addEventListener("click", () => {
  // Extension pages may open browser pages through the tabs API (plain links are blocked).
  const isEdge = navigator.userAgentData?.brands?.some((b) => b.brand === "Microsoft Edge")
    || navigator.userAgent.includes("Edg/");
  chrome.tabs.create({ url: `${isEdge ? "edge" : "chrome"}://extensions/shortcuts` });
});

function renderTools() {
  toolsEl.replaceChildren();
  let group = null;
  for (const t of TOOLS) {
    if (t.group !== group) {
      group = t.group;
      const g = document.createElement("div");
      g.className = "group";
      g.textContent = GROUP_LABEL[group];
      toolsEl.append(g);
    }
    const row = document.createElement("div");
    row.className = "row";
    const label = document.createElement("span");
    label.textContent = t.label;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "key";
    button.textContent = globalThis.snapBlurKeyLabel(keys[t.name]);
    button.setAttribute("aria-label", `${t.label} key: ${keys[t.name]}. Click to change.`);
    button.addEventListener("click", () => startListening(t.name, button));
    row.append(label, button);
    toolsEl.append(row);
  }
}

function startListening(name, button) {
  stopListening();
  listening = { name, button };
  button.classList.add("listening");
  button.textContent = "Press a key…";
  setStatus("Press the new key. Esc cancels.");
}

function stopListening() {
  if (!listening) return;
  const { name, button } = listening;
  button.classList.remove("listening");
  button.textContent = globalThis.snapBlurKeyLabel(keys[name]);
  listening = null;
}

document.addEventListener("keydown", async (e) => {
  if (!listening) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") {
    stopListening();
    setStatus("");
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) {
    setStatus("Use a single key without Ctrl, Cmd or Alt.", "error");
    return;
  }
  const key = globalThis.snapBlurKeyOf(e);
  // Enter, Tab, arrows etc. are multi-character names; they are reserved or awkward.
  if (key.length !== 1 || key === " ") {
    setStatus("Use a letter, digit or symbol.", "error");
    return;
  }
  const { name } = listening;
  const owner = TOOLS.find((t) => t.name !== name && keys[t.name] === key);
  if (owner) {
    setStatus(`"${globalThis.snapBlurKeyLabel(key)}" is already used by ${owner.label}.`, "error");
    return;
  }
  keys[name] = key;
  stopListening();
  await save(`${TOOLS.find((t) => t.name === name).label} = ${globalThis.snapBlurKeyLabel(key)}. Saved.`);
}, true);

document.getElementById("reset").addEventListener("click", async () => {
  stopListening();
  keys = { ...DEFAULTS };
  renderTools();
  await save("Defaults restored.");
});

async function save(message) {
  try {
    await chrome.storage.sync.set({ toolKeys: keys });
    setStatus(`${message} Applies to the next capture.`, "ok");
  } catch (err) {
    setStatus(`Could not save: ${err.message}`, "error");
  }
}

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`;
}
