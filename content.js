// Snap Blur in-page overlay.
// Step 1 (select): frozen screenshot over the page, drag/resize an area, then Copy or Markup.
// Step 2 (markup): hide info (blur / pixelate / redact) or annotate (pen / rectangle / arrow / text),
// then Copy. Nothing is saved: the image only lives in memory until the overlay closes.

(() => {
  if (window.__snapBlur) return; // already injected into this tab's isolated world

  const CSS = `
    :host { all: initial; }
    [hidden] { display: none !important; }
    * { box-sizing: border-box; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
    .root { position: absolute; inset: 0; overflow: hidden; user-select: none; -webkit-user-select: none; color: #e8e8ec; }

    button { all: unset; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
             height: 34px; padding: 0 12px; border-radius: 8px; color: #e8e8ec; cursor: pointer; white-space: nowrap; }
    button:hover { background: #34343c; }
    button:focus-visible { outline: 2px solid #4c8df6; outline-offset: 1px; }
    button:disabled { opacity: .35; cursor: default; background: none; }
    button.primary { background: #1a73e8; color: #fff; font-weight: 600; }
    button.primary:hover { background: #2b7ff0; }
    button svg { width: 18px; height: 18px; flex: none; }
    .ib { width: 34px; padding: 0; }

    /* step 1: select */
    .select { cursor: crosshair; }
    .shot { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; }
    .dim { position: absolute; inset: 0; background: rgba(0, 0, 0, .4); }
    .sel { position: absolute; outline: 1px dashed #fff; cursor: move;
           box-shadow: 0 0 0 1px rgba(0, 0, 0, .6), 0 0 0 9999px rgba(0, 0, 0, .4); }
    .h { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px;
         background: #fff; border: 1px solid #333; border-radius: 50%; }
    .h[data-dir=nw] { left: 0; top: 0; cursor: nwse-resize; }
    .h[data-dir=n]  { left: 50%; top: 0; cursor: ns-resize; }
    .h[data-dir=ne] { left: 100%; top: 0; cursor: nesw-resize; }
    .h[data-dir=e]  { left: 100%; top: 50%; cursor: ew-resize; }
    .h[data-dir=se] { left: 100%; top: 100%; cursor: nwse-resize; }
    .h[data-dir=s]  { left: 50%; top: 100%; cursor: ns-resize; }
    .h[data-dir=sw] { left: 0; top: 100%; cursor: nesw-resize; }
    .h[data-dir=w]  { left: 0; top: 50%; cursor: ew-resize; }
    .float { position: absolute; display: flex; align-items: center; gap: 2px; padding: 4px;
             background: #26262c; border: 1px solid #3a3a42; border-radius: 12px;
             box-shadow: 0 6px 24px rgba(0, 0, 0, .45); cursor: default; }
    .hint { top: 12px; left: 50%; transform: translateX(-50%); padding-left: 14px; white-space: nowrap; }
    .hint span { color: #a8a8b0; margin-right: 6px; }

    /* step 2: markup */
    .markup { background: #18181c; display: flex; flex-direction: column; }
    .top { display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 8px 12px;
           background: #26262c; border-bottom: 1px solid #0d0d10; flex-wrap: wrap; }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #fff; margin-right: 4px; }
    .brand svg { width: 20px; height: 20px; color: #4c8df6; }
    .seg { display: flex; gap: 2px; padding: 3px; background: #18181c; border-radius: 10px; }
    .seg .ib { color: #b8b8c0; }
    .seg .ib.active { background: #1a73e8; color: #fff; }
    .sep { width: 1px; height: 24px; background: #3a3a42; margin: 0 2px; }
    .opts { display: flex; align-items: center; gap: 10px; min-height: 34px; }
    .opts label { display: flex; align-items: center; gap: 8px; color: #a8a8b0; }
    .opts input[type=range] { width: 110px; accent-color: #1a73e8; }
    .swatch { width: 22px; height: 22px; padding: 0; border-radius: 50%;
              box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .3); }
    .swatch:hover { background: var(--c); transform: scale(1.1); }
    .swatch.active { box-shadow: 0 0 0 2px #26262c, 0 0 0 4px #fff; }
    .size { width: 28px; height: 28px; padding: 0; }
    .size i { display: block; border-radius: 50%; background: currentColor; }
    .size.active { background: #3a3a42; }
    .spacer { flex: 1; }
    .stage { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .wrap { position: relative; line-height: 0; }
    .wrap canvas { display: block; cursor: crosshair; box-shadow: 0 4px 24px rgba(0, 0, 0, .6); }
    .wrap canvas.text-cursor { cursor: text; }
    .draw { position: absolute; border: 1px dashed #fff; outline: 1px dashed #000;
            background: rgba(26, 115, 232, .15); pointer-events: none; }
    .text-in { position: absolute; margin: 0; padding: 0; border: 0; background: transparent; resize: none;
               overflow: hidden; white-space: pre; field-sizing: content; min-width: 2ch; line-height: 1.25;
               font-weight: 600; outline: 1px dashed rgba(255, 255, 255, .9); outline-offset: 4px;
               box-shadow: 0 0 0 5px rgba(0, 0, 0, .25); }
    .toast { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 10px 18px;
             background: #26262c; color: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0, 0, 0, .5); }
  `;

  // 24x24 stroke icons. `fill: true` paths are filled instead of stroked.
  const ICONS = {
    blur: ["M12 3c3.2 4.2 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.8-6.8 6-11z"],
    pixelate: ["M4 4h7v7H4zM13 13h7v7h-7z", { d: "M13 4h7v7h-7zM4 13h7v7H4z", fill: true }],
    box: ["M3 7h18v10H3z", { d: "M6 10h12v4H6z", fill: true }],
    pen: ["M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3"],
    rect: ["M4 6h16v12H4z"],
    arrow: ["M5 19L19 5M10 5h9v9"],
    text: ["M5 7V5h14v2M12 5v14M9 19h6"],
    undo: ["M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"],
    redo: ["M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3"],
    copy: ["M9 9h11v11H9zM5 15H4V4h11v1"],
    save: ["M12 4v11M7 10l5 5 5-5M5 20h14"],
    close: ["M6 6l12 12M18 6L6 18"],
    settings: ["M4 7h9M17 7h3M4 17h3M11 17h9", "M13 5h4v4h-4zM7 15h4v4H7z"],
    scissors: ["M8.5 8.5L20 20M15.5 8.5L4 20", "M3 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0M15 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
  };

  const TOOLS = globalThis.SNAP_BLUR_TOOLS; // from keys.js, injected first
  const HIDE_TOOLS = new Set(TOOLS.filter((t) => t.group === "hide").map((t) => t.name));
  const COLORS = ["#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#000000", "#ffffff"];
  // CSS px; multiplied by the capture scale so results look the same on any display.
  const SIZES = { s: { stroke: 2, text: 16, dot: 6 }, m: { stroke: 4, text: 22, dot: 10 }, l: { stroke: 7, text: 32, dot: 14 } };
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const MIN = 4; // smallest selection, CSS px

  // Last used options, kept in memory while the tab lives.
  const prefs = { tool: "blur", color: COLORS[0], size: "m", strength: 6 };

  let session = null;

  window.__snapBlur = { start };

  // ---------- helpers ----------

  // Build DOM without innerHTML so pages with Trusted Types / strict CSP still work.
  function h(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") el.className = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el[k] = v;
    }
    for (const c of [].concat(children)) el.append(c);
    return el;
  }

  function icon(name) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    for (const p of ICONS[name]) {
      const { d, fill } = typeof p === "string" ? { d: p } : p;
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", fill ? "currentColor" : "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.append(path);
    }
    return svg;
  }

  // Icon button; `label` is shown as text unless `iconOnly`.
  function btn(name, label, props = {}, iconOnly = false) {
    const cls = [props.class, iconOnly && "ib"].filter(Boolean).join(" ");
    return h("button", { ...props, class: cls, title: props.title ?? label, ariaLabel: label },
      iconOnly ? [icon(name)] : [icon(name), label]);
  }

  // Content scripts cannot open the options page themselves; the service worker does.
  function settingsBtn() {
    return btn("settings", "Shortcut settings", {
      onclick: () => chrome.runtime.sendMessage({ type: "open-options" }),
    }, true);
  }

  function newCanvas(w, hgt) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = hgt;
    return c;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  async function decode(dataUrl) {
    // Decode in memory: an <img src="data:..."> could be blocked by the page's CSP.
    const bin = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return createImageBitmap(new Blob([bytes], { type: "image/png" }));
  }

  // ---------- session ----------

  async function start(dataUrl) {
    close();
    const bitmap = await decode(dataUrl);
    const keys = await globalThis.snapBlurLoadKeys(); // tool name -> key
    const shot = newCanvas(bitmap.width, bitmap.height);
    shot.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close();

    const host = document.createElement("snap-blur-overlay");
    for (const [k, v] of Object.entries({
      position: "fixed", left: "0", top: "0", width: "100vw", height: "100vh",
      "z-index": "2147483647", display: "block", margin: "0", padding: "0",
    })) host.style.setProperty(k, v, "important");

    const shadow = host.attachShadow({ mode: "closed" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    shadow.adoptedStyleSheets = [sheet];

    session = {
      host,
      shadow,
      shot,
      // Image pixels per CSS pixel at capture time (device ratio x zoom).
      scaleX: shot.width / window.innerWidth,
      scaleY: shot.height / window.innerHeight,
      keys,
      keyToTool: Object.fromEntries(Object.entries(keys).map(([tool, key]) => [key, tool])),
      view: null, // current step, see showSelect / showMarkup
      cleanups: [],
    };

    host.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
    host.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", onKey, true);
    document.documentElement.append(host);
    showSelect();
  }

  // Stop listening; the host stays until the caller removes it.
  function detach() {
    window.removeEventListener("keydown", onKey, true);
    for (const f of session.cleanups) f();
    const s = session;
    session = null;
    return s;
  }

  function close() {
    if (session) detach().host.remove();
  }

  function setView(view) {
    if (session.view) session.view.root.remove();
    session.view = view;
    session.shadow.append(view.root);
  }

  function onKey(e) {
    if (!session) return;
    // The overlay is modal: page shortcuts must not fire underneath it.
    e.stopImmediatePropagation();
    const v = session.view;

    if (v.textEditing?.()) {
      // Let the text box receive normal typing; only Enter / Esc are ours.
      // isComposing: Enter that confirms an IME (Vietnamese, Japanese) must not commit.
      if (e.key === "Escape") {
        e.preventDefault();
        v.cancelText();
      } else if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        v.commitText();
      }
      return;
    }

    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    let handled = true;
    if (e.key === "Escape") {
      if (!v.cancelDrag()) close();
    } else if (e.key === "Enter" || (mod && k === "c")) {
      v.copy();
    } else if (mod && k === "s") {
      v.save(); // also stops the browser's "Save page as"
    } else if (mod && (k === "y" || (k === "z" && e.shiftKey)) && v.redo) {
      v.redo();
    } else if (mod && k === "z" && v.undo) {
      v.undo();
    } else if (!mod && !e.altKey && v.setTool && session.keyToTool[globalThis.snapBlurKeyOf(e)]) {
      v.setTool(session.keyToTool[globalThis.snapBlurKeyOf(e)]);
    } else {
      handled = false;
    }
    if (handled) e.preventDefault();
  }

  async function copyCanvas(canvas) {
    try {
      // Pass a promise so the user-gesture window is not lost while encoding.
      const blob = new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
      );
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    } catch (err) {
      console.error("[Snap Blur]", err);
      const hint = window.isSecureContext ? "" : " (clipboard needs an https page)";
      toast(`Copy failed: ${err.message}${hint}`);
      return;
    }
    finish("Copied to clipboard");
  }

  // Download through an <a download> link: no `downloads` permission needed,
  // and the browser's own "Ask where to save" setting still applies.
  function saveCanvas(canvas) {
    canvas.toBlob((blob) => {
      if (!blob) {
        toast("Save failed");
        return;
      }
      const url = URL.createObjectURL(blob);
      h("a", { href: url, download: fileName() }).click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      finish("Download started");
    }, "image/png");
  }

  function fileName() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `snap-blur-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-` +
      `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
  }

  // Leave only a short confirmation, then remove everything.
  function finish(message) {
    session.view.root.remove();
    toast(message);
    const s = detach();
    s.host.style.setProperty("pointer-events", "none", "important");
    setTimeout(() => s.host.remove(), 1200);
  }

  function toast(text) {
    const { shadow } = session;
    shadow.querySelector(".toast")?.remove();
    const el = h("div", { class: "toast", role: "status", textContent: text });
    shadow.append(el);
    setTimeout(() => el.remove(), 2500);
  }

  // ---------- step 1: select area ----------

  function showSelect() {
    const { shot, scaleX, scaleY } = session;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const view = newCanvas(shot.width, shot.height);
    view.className = "shot";
    view.getContext("2d").drawImage(shot, 0, 0);

    const dim = h("div", { class: "dim" });
    const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((d) =>
      h("div", { class: "h", dataset: { dir: d } }),
    );
    const sel = h("div", { class: "sel", hidden: true }, handles);
    const bar = h("div", { class: "float bar", hidden: true }, [
      btn("copy", "Copy", { class: "primary", title: "Copy (Enter)", onclick: () => copySelection() }),
      btn("save", "Save", { title: "Save as PNG (Ctrl+S)", onclick: () => saveSelection() }),
      btn("pen", "Markup", { title: "Hide info or annotate before copying", onclick: () => showMarkup(cropSelection()) }),
      btn("close", "Cancel", { title: "Cancel (Esc)", onclick: close }, true),
    ]);
    const hint = h("div", { class: "float hint" }, [
      h("span", { textContent: "Drag to select an area" }),
      h("button", { textContent: "Whole screen", onclick: () => { rect = { x: 0, y: 0, w: vw, h: vh }; layout(); } }),
      settingsBtn(),
      btn("close", "Cancel", { title: "Cancel (Esc)", onclick: close }, true),
    ]);
    const root = h("div", { class: "root select" }, [view, dim, sel, bar, hint]);

    let rect = null; // selection in CSS px
    let drag = null;

    for (const el of [bar, hint]) el.addEventListener("pointerdown", (e) => e.stopPropagation());

    root.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      root.setPointerCapture(e.pointerId);
      const p = { x: clamp(e.clientX, 0, vw), y: clamp(e.clientY, 0, vh) };
      const dir = e.target.dataset?.dir;
      if (dir && rect) drag = { mode: "resize", dir, start: { ...rect } };
      else if (e.target === sel && rect) drag = { mode: "move", p0: p, start: { ...rect } };
      else drag = { mode: "new", p0: p };
      update(p);
    });

    root.addEventListener("pointermove", (e) => {
      if (drag) update({ x: clamp(e.clientX, 0, vw), y: clamp(e.clientY, 0, vh) });
    });

    root.addEventListener("pointerup", (e) => {
      if (!drag) return;
      update({ x: clamp(e.clientX, 0, vw), y: clamp(e.clientY, 0, vh) });
      drag = null;
      if (rect && (rect.w < MIN || rect.h < MIN)) rect = null;
      layout();
    });

    function update(p) {
      if (drag.mode === "new") {
        rect = fromEdges(drag.p0.x, drag.p0.y, p.x, p.y);
      } else if (drag.mode === "move") {
        const s = drag.start;
        rect = {
          ...s,
          x: clamp(s.x + p.x - drag.p0.x, 0, vw - s.w),
          y: clamp(s.y + p.y - drag.p0.y, 0, vh - s.h),
        };
      } else {
        const s = drag.start;
        let [l, t, r, b] = [s.x, s.y, s.x + s.w, s.y + s.h];
        if (drag.dir.includes("w")) l = p.x;
        if (drag.dir.includes("e")) r = p.x;
        if (drag.dir.includes("n")) t = p.y;
        if (drag.dir.includes("s")) b = p.y;
        rect = fromEdges(l, t, r, b);
      }
      layout();
    }

    function fromEdges(x0, y0, x1, y1) {
      const x = Math.min(x0, x1);
      const y = Math.min(y0, y1);
      return { x, y, w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
    }

    function layout() {
      dim.hidden = !!rect;
      sel.hidden = !rect;
      bar.hidden = !rect || !!drag;
      hint.hidden = !!rect || !!drag;
      if (!rect) return;
      Object.assign(sel.style, {
        left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px`,
      });
      if (bar.hidden) return;
      const bw = bar.offsetWidth;
      const bh = bar.offsetHeight;
      let top = rect.y + rect.h + 8;
      if (top + bh > vh - 8) top = rect.y - bh - 8; // no room below: go above
      if (top < 8) top = rect.y + rect.h - bh - 8; // no room above: go inside
      bar.style.top = `${clamp(top, 8, vh - bh - 8)}px`;
      bar.style.left = `${clamp(rect.x + rect.w - bw, 8, vw - bw - 8)}px`;
    }

    function cropSelection() {
      const x = Math.round(rect.x * scaleX);
      const y = Math.round(rect.y * scaleY);
      const w = Math.max(1, Math.min(shot.width - x, Math.round(rect.w * scaleX)));
      const hgt = Math.max(1, Math.min(shot.height - y, Math.round(rect.h * scaleY)));
      const c = newCanvas(w, hgt);
      c.getContext("2d").drawImage(shot, x, y, w, hgt, 0, 0, w, hgt);
      return c;
    }

    function copySelection() {
      if (rect) copyCanvas(cropSelection());
    }

    function saveSelection() {
      if (rect) saveCanvas(cropSelection());
    }

    setView({
      root,
      copy: copySelection,
      save: saveSelection,
      cancelDrag() {
        if (!drag && !rect) return false;
        drag = null;
        rect = null;
        layout();
        return true;
      },
    });
  }

  // ---------- step 2: markup ----------

  function showMarkup(base) {
    const scale = session.scaleX;
    let stack = [base];
    let redoStack = [];
    let drag = null; // { tool, color, width, pts: [{x, y}] } in image px
    let textBox = null; // { el, x, y, px, color } while typing
    let textPending = false;

    const canvas = newCanvas(base.width, base.height);
    const ctx = canvas.getContext("2d");
    const draw = h("div", { class: "draw", hidden: true });

    // --- toolbar ---
    const toolBtns = {};
    const toolSeg = h("div", { class: "seg", role: "toolbar", ariaLabel: "Tools" });
    TOOLS.forEach(({ name, label, group }, i) => {
      if (i > 0 && TOOLS[i - 1].group !== group) toolSeg.append(h("span", { class: "sep" }));
      const key = globalThis.snapBlurKeyLabel(session.keys[name]);
      toolBtns[name] = btn(name, label, { title: `${label} (${key})`, onclick: () => setTool(name) }, true);
      toolSeg.append(toolBtns[name]);
    });

    const strength = h("input", {
      type: "range", min: 1, max: 10, value: prefs.strength,
      oninput: () => { prefs.strength = Number(strength.value); },
    });
    const hideOpts = h("div", { class: "opts" }, [h("label", {}, ["Strength", strength])]);

    const swatches = COLORS.map((c) => {
      const b = h("button", { class: "swatch", title: c, ariaLabel: `Color ${c}`, onclick: () => setColor(c) });
      b.style.background = c;
      b.style.setProperty("--c", c);
      return b;
    });
    const sizeBtns = Object.entries(SIZES).map(([key, s]) => {
      const dot = h("i");
      dot.style.width = dot.style.height = `${s.dot}px`;
      return h("button", { class: "size", dataset: { size: key }, title: `Size ${key.toUpperCase()}`, onclick: () => setSize(key) }, dot);
    });
    const drawOpts = h("div", { class: "opts" }, [
      ...swatches,
      h("span", { class: "sep" }),
      ...sizeBtns,
    ]);

    const undoBtn = btn("undo", "Undo", { title: "Undo (Ctrl+Z)", onclick: undo }, true);
    const redoBtn = btn("redo", "Redo", { title: "Redo (Ctrl+Shift+Z)", onclick: redo }, true);

    const top = h("div", { class: "top" }, [
      h("div", { class: "brand" }, [icon("scissors"), "Snap Blur"]),
      toolSeg,
      h("span", { class: "sep" }),
      hideOpts,
      drawOpts,
      h("span", { class: "spacer" }),
      undoBtn,
      redoBtn,
      h("span", { class: "sep" }),
      btn("save", "Save", { title: "Save as PNG (Ctrl+S)", onclick: save }),
      btn("copy", "Copy", { class: "primary", title: "Copy (Enter / Ctrl+C)", onclick: copy }),
      settingsBtn(),
      btn("close", "Close", { title: "Close (Esc)", onclick: close }, true),
    ]);
    const wrap = h("div", { class: "wrap" }, [canvas, draw]);
    const stage = h("div", { class: "stage" }, wrap);
    const root = h("div", { class: "root markup" }, [top, stage]);

    // Toolbar clicks must not reach the canvas logic, but should commit pending text.
    top.addEventListener("pointerdown", () => commitText());

    setView({
      root, copy, save, undo, redo, setTool, cancelDrag,
      textEditing: () => !!textBox,
      commitText,
      cancelText,
    });
    setTool(prefs.tool);
    setColor(prefs.color);
    setSize(prefs.size);
    fit();
    paint();
    window.addEventListener("resize", fit);
    session.cleanups.push(() => window.removeEventListener("resize", fit));

    // --- state ---

    function current() {
      return stack[stack.length - 1];
    }

    function paint() {
      ctx.drawImage(current(), 0, 0);
      undoBtn.disabled = stack.length < 2;
      redoBtn.disabled = redoStack.length === 0;
    }

    function push(c) {
      stack.push(c);
      redoStack = [];
      paint();
    }

    function cloneCurrent() {
      const out = newCanvas(canvas.width, canvas.height);
      out.getContext("2d").drawImage(current(), 0, 0);
      return out;
    }

    // Show at real CSS size, shrunk to fit the stage.
    function fit() {
      const k = Math.min(1 / scale, (stage.clientWidth - 48) / canvas.width, (stage.clientHeight - 48) / canvas.height);
      canvas.style.width = `${canvas.width * k}px`;
      canvas.style.height = `${canvas.height * k}px`;
    }

    function setTool(name) {
      commitText();
      prefs.tool = name;
      for (const [n, b] of Object.entries(toolBtns)) b.classList.toggle("active", n === name);
      const hide = HIDE_TOOLS.has(name);
      hideOpts.hidden = !hide;
      drawOpts.hidden = hide;
      canvas.classList.toggle("text-cursor", name === "text");
    }

    function setColor(c) {
      prefs.color = c;
      for (const b of swatches) b.classList.toggle("active", b.title === c);
      if (textBox) {
        textBox.color = c;
        textBox.el.style.color = c;
      }
    }

    function setSize(key) {
      prefs.size = key;
      for (const b of sizeBtns) b.classList.toggle("active", b.dataset.size === key);
    }

    function undo() {
      commitText();
      if (stack.length < 2) return;
      redoStack.push(stack.pop());
      paint();
    }

    function redo() {
      if (!redoStack.length) return;
      stack.push(redoStack.pop());
      paint();
    }

    function copy() {
      commitText();
      paint();
      copyCanvas(canvas);
    }

    function save() {
      commitText();
      paint();
      saveCanvas(canvas);
    }

    function cancelDrag() {
      if (!drag) return false;
      drag = null;
      draw.hidden = true;
      paint();
      return true;
    }

    // --- drawing ---

    function displayScale() {
      return canvas.getBoundingClientRect().width / canvas.width;
    }

    function toImage(e) {
      const b = canvas.getBoundingClientRect();
      return {
        x: clamp((e.clientX - b.left) * (canvas.width / b.width), 0, canvas.width),
        y: clamp((e.clientY - b.top) * (canvas.height / b.height), 0, canvas.height),
      };
    }

    function boxOf(a, b) {
      const x = Math.round(Math.min(a.x, b.x));
      const y = Math.round(Math.min(a.y, b.y));
      return { x, y, w: Math.round(Math.max(a.x, b.x)) - x, h: Math.round(Math.max(a.y, b.y)) - y };
    }

    function last(d) {
      return d.pts[d.pts.length - 1];
    }

    function drawShape(c, s) {
      const a = s.pts[0];
      const b = last(s);
      c.save();
      c.strokeStyle = c.fillStyle = s.color;
      c.lineWidth = s.width;
      c.lineCap = "round";
      c.lineJoin = "round";
      if (s.tool === "pen") {
        c.beginPath();
        c.moveTo(a.x, a.y);
        for (const p of s.pts) c.lineTo(p.x, p.y);
        if (s.pts.length === 1) c.lineTo(a.x + 0.01, a.y); // a click draws a dot
        c.stroke();
      } else if (s.tool === "rect") {
        const r = boxOf(a, b);
        c.strokeRect(r.x, r.y, r.w, r.h);
      } else if (s.tool === "arrow") {
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const head = Math.max(s.width * 3.5, 12 * scale);
        // Stop the shaft inside the head so the round cap does not poke out of the tip.
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x - Math.cos(ang) * head * 0.7, b.y - Math.sin(ang) * head * 0.7);
        c.stroke();
        c.beginPath();
        c.moveTo(b.x, b.y);
        c.lineTo(b.x - head * Math.cos(ang - 0.45), b.y - head * Math.sin(ang - 0.45));
        c.lineTo(b.x - head * Math.cos(ang + 0.45), b.y - head * Math.sin(ang + 0.45));
        c.closePath();
        c.fill();
      }
      c.restore();
    }

    function hideArea(r) {
      const src = current();
      const level = prefs.strength;
      const out = cloneCurrent();
      const o = out.getContext("2d");
      o.save();
      o.beginPath();
      o.rect(r.x, r.y, r.w, r.h);
      o.clip();
      if (drag.tool === "blur") {
        // Two passes: one Gaussian pass can leave large text guessable.
        o.filter = `blur(${Math.round(level * 2.5 * scale)}px)`;
        o.drawImage(src, 0, 0);
        o.drawImage(out, 0, 0);
      } else if (drag.tool === "pixelate") {
        const block = Math.max(2, Math.round(level * 2 * scale));
        const tw = Math.max(1, Math.ceil(r.w / block));
        const th = Math.max(1, Math.ceil(r.h / block));
        const tmp = newCanvas(tw, th);
        const t = tmp.getContext("2d");
        t.imageSmoothingQuality = "high";
        t.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, tw, th);
        o.imageSmoothingEnabled = false;
        o.drawImage(tmp, 0, 0, tw, th, r.x, r.y, tw * block, th * block);
      } else {
        o.fillStyle = "#000";
        o.fillRect(r.x, r.y, r.w, r.h);
      }
      o.restore();
      push(out);
    }

    function preview() {
      if (HIDE_TOOLS.has(drag.tool)) {
        const r = boxOf(drag.pts[0], last(drag));
        const k = displayScale();
        Object.assign(draw.style, {
          left: `${r.x * k}px`, top: `${r.y * k}px`, width: `${r.w * k}px`, height: `${r.h * k}px`,
        });
        draw.hidden = false;
      } else {
        paint();
        drawShape(ctx, drag);
      }
    }

    function finish() {
      const d = drag;
      drag = null;
      draw.hidden = true;
      const a = d.pts[0];
      const b = last(d);
      const r = boxOf(a, b);
      if (HIDE_TOOLS.has(d.tool)) {
        drag = d; // hideArea reads drag.tool
        if (r.w >= 3 && r.h >= 3) hideArea(r);
        drag = null;
        paint();
        return;
      }
      const tiny =
        (d.tool === "rect" && (r.w < 3 || r.h < 3)) ||
        (d.tool === "arrow" && Math.hypot(b.x - a.x, b.y - a.y) < 6 * scale);
      if (tiny) {
        paint();
        return;
      }
      const out = cloneCurrent();
      drawShape(out.getContext("2d"), d);
      push(out);
    }

    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (textBox) {
        commitText(); // click outside the text box = done typing
        return;
      }
      if (prefs.tool === "text") {
        textPending = true; // open on pointerup, after the browser's own focus handling
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      drag = {
        tool: prefs.tool,
        color: prefs.color,
        width: SIZES[prefs.size].stroke * scale,
        pts: [toImage(e)],
      };
      preview();
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = toImage(e);
      if (drag.tool === "pen") drag.pts.push(p);
      else drag.pts[1] = p;
      preview();
    });

    canvas.addEventListener("pointerup", (e) => {
      if (textPending) {
        textPending = false;
        openText(toImage(e));
        return;
      }
      if (!drag) return;
      // Use the release point: the last pointermove may have been coalesced away.
      const p = toImage(e);
      if (drag.tool === "pen") drag.pts.push(p);
      else drag.pts[1] = p;
      finish();
    });

    canvas.addEventListener("pointercancel", cancelDrag);

    // --- text ---

    function openText(p) {
      const px = SIZES[prefs.size].text * scale; // font size in image px
      const lh = px * 1.25;
      const k = displayScale();
      const el = h("textarea", { class: "text-in", rows: 1, spellcheck: false, ariaLabel: "Text" });
      // Click point = middle of the first line.
      const y = p.y - lh / 2;
      Object.assign(el.style, {
        left: `${p.x * k}px`,
        top: `${y * k}px`,
        fontSize: `${px * k}px`,
        fontFamily: FONT,
        color: prefs.color,
        caretColor: prefs.color,
      });
      wrap.append(el);
      textBox = { el, x: p.x, y, px, color: prefs.color };
      requestAnimationFrame(() => el.focus());
    }

    function cancelText() {
      if (!textBox) return;
      textBox.el.remove();
      textBox = null;
    }

    function commitText() {
      if (!textBox) return;
      const t = textBox;
      cancelText();
      const lines = t.el.value.replace(/\s+$/, "").split("\n");
      if (!lines.join("").trim()) return;
      const out = cloneCurrent();
      const o = out.getContext("2d");
      o.font = `600 ${t.px}px ${FONT}`;
      o.fillStyle = t.color;
      o.textBaseline = "middle";
      lines.forEach((line, i) => o.fillText(line, t.x, t.y + (i + 0.5) * t.px * 1.25));
      push(out);
    }
  }
})();
