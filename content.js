// Snap Blur in-page overlay.
// Step 1 (select): frozen screenshot over the page, drag/resize an area, then Copy or Markup.
// Step 2 (markup): blur / pixelate / black box inside the same tab, then Copy.
// Nothing is saved: the image only lives in memory until the overlay closes.

(() => {
  if (window.__snapBlur) return; // already injected into this tab's isolated world

  const CSS = `
    :host { all: initial; }
    [hidden] { display: none !important; }
    * { box-sizing: border-box; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
    .root { position: absolute; inset: 0; overflow: hidden; user-select: none; -webkit-user-select: none; color: #eee; }
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
    .bar, .hint { position: absolute; display: flex; align-items: center; gap: 4px; padding: 6px;
                  background: #1c1c24; border: 1px solid #444; border-radius: 12px;
                  box-shadow: 0 4px 16px rgba(0, 0, 0, .5); cursor: default; }
    .hint { top: 12px; left: 50%; transform: translateX(-50%); padding-left: 14px; white-space: nowrap; }
    button { all: unset; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
             border-radius: 8px; color: #fff; cursor: pointer; white-space: nowrap; }
    button:hover { background: #3a3a46; }
    button:focus-visible { outline: 2px solid #1a73e8; }
    button:disabled { opacity: .4; cursor: default; background: none; }
    button.primary { background: #1a73e8; }
    button.primary:hover { background: #2b7ff0; }
    button.active { background: #1a3a66; box-shadow: inset 0 0 0 1px #1a73e8; }
    .markup { background: #2b2b2b; display: flex; flex-direction: column; }
    .top { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: #3a3a3a; flex-wrap: wrap; }
    .title { font-weight: 600; margin-right: auto; }
    .group { display: flex; gap: 4px; }
    .strength { display: flex; align-items: center; gap: 6px; color: #aaa; }
    .stage { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .wrap { position: relative; line-height: 0; }
    .wrap canvas { display: block; cursor: crosshair; box-shadow: 0 2px 16px rgba(0, 0, 0, .6); }
    .draw { position: absolute; border: 1px dashed #fff; outline: 1px dashed #000;
            background: rgba(26, 115, 232, .15); pointer-events: none; }
    .toast { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 10px 18px;
             background: #323232; color: #fff; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, .5); }
  `;

  const TOOL_KEYS = { b: "blur", p: "pixelate", k: "box" };
  const MIN = 4; // smallest selection, CSS px

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
    const shot = newCanvas(bitmap.width, bitmap.height);
    shot.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close();

    const host = document.createElement("snap-blur-overlay");
    const hs = host.style;
    for (const [k, v] of Object.entries({
      position: "fixed", left: "0", top: "0", width: "100vw", height: "100vh",
      "z-index": "2147483647", display: "block", margin: "0", padding: "0",
    })) hs.setProperty(k, v, "important");

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
      view: null, // current mode: { root, copy(), undo?(), setTool?(), cancelDrag() }
    };

    host.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
    host.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", onKey, true);
    document.documentElement.append(host);
    showSelect();
  }

  function close() {
    if (!session) return;
    window.removeEventListener("keydown", onKey, true);
    session.host.remove();
    session = null;
  }

  function setView(view) {
    if (session.view) session.view.root.remove();
    session.view = view;
    session.shadow.append(view.root);
  }

  function onKey(e) {
    if (!session) return;
    const v = session.view;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    let handled = true;
    if (e.key === "Escape") {
      if (!v.cancelDrag()) close();
    } else if (e.key === "Enter" || (mod && k === "c")) {
      v.copy();
    } else if (mod && k === "z" && v.undo) {
      v.undo();
    } else if (!mod && !e.altKey && v.setTool && TOOL_KEYS[k]) {
      v.setTool(TOOL_KEYS[k]);
    } else {
      handled = false;
    }
    // The overlay is modal: page shortcuts must not fire underneath it.
    e.stopImmediatePropagation();
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
    // Leave only a short confirmation, then remove everything.
    const s = session;
    s.view.root.remove();
    toast("Copied to clipboard");
    s.host.style.setProperty("pointer-events", "none", "important");
    window.removeEventListener("keydown", onKey, true);
    session = null;
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
    const bar = h("div", { class: "bar", hidden: true }, [
      h("button", { class: "primary", textContent: "Copy", title: "Copy (Enter)", onclick: () => copySelection() }),
      h("button", { textContent: "Markup", title: "Blur / pixelate before copying", onclick: () => showMarkup(cropSelection()) }),
      h("button", { textContent: "\u2715", title: "Cancel (Esc)", onclick: close }),
    ]);
    const hint = h("div", { class: "hint" }, [
      h("span", { textContent: "Drag to select an area" }),
      h("button", { textContent: "Whole screen", onclick: () => { rect = { x: 0, y: 0, w: vw, h: vh }; layout(); } }),
      h("button", { textContent: "\u2715", title: "Cancel (Esc)", onclick: close }),
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
      bar.hidden = true;
      hint.hidden = true;
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

    setView({
      root,
      copy: copySelection,
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
    let tool = "blur";
    let drag = null; // { x0, y0, x1, y1 } in image px

    const canvas = newCanvas(base.width, base.height);
    const ctx = canvas.getContext("2d");
    const draw = h("div", { class: "draw", hidden: true });
    const strength = h("input", { type: "range", min: 1, max: 10, value: 6 });
    const toolBtns = [
      ["blur", "Blur", "B"],
      ["pixelate", "Pixelate", "P"],
      ["box", "Black box", "K"],
    ].map(([name, label, key]) =>
      h("button", { textContent: label, title: `${label} (${key})`, dataset: { tool: name }, onclick: () => setTool(name) }),
    );
    const undoBtn = h("button", { textContent: "Undo", title: "Undo (Ctrl+Z)", onclick: undo });
    const resetBtn = h("button", { textContent: "Reset", onclick: () => { stack = stack.slice(0, 1); render(); } });
    const top = h("div", { class: "top" }, [
      h("span", { class: "title", textContent: "Snap Blur" }),
      h("div", { class: "group" }, toolBtns),
      h("label", { class: "strength" }, ["Strength", strength]),
      h("div", { class: "group" }, [undoBtn, resetBtn]),
      h("button", { class: "primary", textContent: "Copy", title: "Copy (Enter / Ctrl+C)", onclick: copy }),
      h("button", { textContent: "\u2715", title: "Close (Esc)", onclick: close }),
    ]);
    const wrap = h("div", { class: "wrap" }, [canvas, draw]);
    const stage = h("div", { class: "stage" }, wrap);
    const root = h("div", { class: "root markup" }, [top, stage]);

    setView({ root, copy, undo, setTool, cancelDrag });
    setTool(tool);
    render();

    function current() {
      return stack[stack.length - 1];
    }

    function render() {
      const c = current();
      canvas.width = c.width;
      canvas.height = c.height;
      ctx.drawImage(c, 0, 0);
      // Show at real CSS size, shrunk to fit the stage.
      const fit = Math.min(1 / scale, (stage.clientWidth - 32) / c.width, (stage.clientHeight - 32) / c.height);
      canvas.style.width = `${c.width * fit}px`;
      canvas.style.height = `${c.height * fit}px`;
      undoBtn.disabled = resetBtn.disabled = stack.length < 2;
    }

    function setTool(name) {
      tool = name;
      for (const b of toolBtns) b.classList.toggle("active", b.dataset.tool === name);
    }

    function undo() {
      if (stack.length < 2) return;
      stack.pop();
      render();
    }

    function copy() {
      copyCanvas(canvas);
    }

    function cancelDrag() {
      if (!drag) return false;
      drag = null;
      draw.hidden = true;
      return true;
    }

    function apply(r) {
      const src = current();
      const level = Number(strength.value);
      const out = newCanvas(src.width, src.height);
      const o = out.getContext("2d");
      o.drawImage(src, 0, 0);
      o.save();
      o.beginPath();
      o.rect(r.x, r.y, r.w, r.h);
      o.clip();
      if (tool === "blur") {
        // Two passes: one Gaussian pass can leave large text guessable.
        o.filter = `blur(${Math.round(level * 2.5 * scale)}px)`;
        o.drawImage(src, 0, 0);
        o.drawImage(out, 0, 0);
      } else if (tool === "pixelate") {
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
      stack.push(out);
      render();
    }

    function toImage(e) {
      const b = canvas.getBoundingClientRect();
      return {
        x: clamp((e.clientX - b.left) * (canvas.width / b.width), 0, canvas.width),
        y: clamp((e.clientY - b.top) * (canvas.height / b.height), 0, canvas.height),
      };
    }

    function normalized(d) {
      const x = Math.round(Math.min(d.x0, d.x1));
      const y = Math.round(Math.min(d.y0, d.y1));
      return { x, y, w: Math.round(Math.max(d.x0, d.x1)) - x, h: Math.round(Math.max(d.y0, d.y1)) - y };
    }

    function showDraw() {
      const r = normalized(drag);
      const k = canvas.getBoundingClientRect().width / canvas.width;
      Object.assign(draw.style, {
        left: `${r.x * k}px`, top: `${r.y * k}px`, width: `${r.w * k}px`, height: `${r.h * k}px`,
      });
      draw.hidden = false;
    }

    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      const p = toImage(e);
      drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      showDraw();
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = toImage(e);
      drag.x1 = p.x;
      drag.y1 = p.y;
      showDraw();
    });

    canvas.addEventListener("pointerup", (e) => {
      if (!drag) return;
      // Use the release point: the last pointermove may have been coalesced away.
      const p = toImage(e);
      drag.x1 = p.x;
      drag.y1 = p.y;
      const r = normalized(drag);
      drag = null;
      draw.hidden = true;
      if (r.w >= 3 && r.h >= 3) apply(r);
    });

    canvas.addEventListener("pointercancel", cancelDrag);
  }
})();
