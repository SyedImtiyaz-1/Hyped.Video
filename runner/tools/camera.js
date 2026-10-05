/*
 * Hyped camera: shows a page captured with .hyped/capture.mjs in a scene, framed in a browser window (or a phone), and
 * moves a camera over it. Marks (rings, typing, cursor clicks, labels) are pinned to the page's real elements by their
 * measured boxes, so they stay exactly on target however the camera zooms, pans or scrolls the page.
 *
 *   <script src=".hyped/camera.js"></script>          (adjust the path to where your page lives)
 *   const capture = <the page.json written by capture.mjs: inline it, or await HypedCamera.load("capture/home/")>;
 *   const shot = HypedCamera.create(sceneElement, capture, {
 *     base: "capture/home/",              // the capture's folder, relative to this page (where page.png is)
 *     accent: "#C8F135",                  // the brand's accent: rings, clicks and labels
 *     inset: { bottom: 0.2 },             // keep framed targets clear of burned-in captions (0.26 for vertical)
 *     shots: [                            // where the camera looks; it eases from one to the next, then holds
 *       { at: 12.0, on: "window" },                                            // the whole browser window
 *       { at: cue.word("03", "paste").start - 0.15, on: "input-yourproduct-com-or-a-github-repo" },
 *       { at: 15.6, on: ["input-yourproduct-com-or-a-github-repo", "button-make-my-free-video"] },
 *       { at: 18.0, on: "heading-made-with-hyped" },                           // scrolls the page down to it
 *     ],
 *     marks: [                            // drawn on the page's elements
 *       { at: 12.9, until: 16.5, ring: "input-yourproduct-com-or-a-github-repo", dim: 0.35 },
 *       { at: 13.1, type: "acme.com" },                                       // captured with --type "acme.com"
 *       { at: 15.2, cursor: "button-make-my-free-video", click: true },
 *       { at: 15.3, until: 16.5, label: "button-make-my-free-video", text: "One click" },
 *     ],
 *   });
 *   await shot.ready;                     // the screenshots are loaded: before capturing any frame
 *   shot.render(t);                       // on EVERY frame, with t on the final timeline, like captions.render(t)
 *
 * Targets ("on", ring, cursor, label) are element ids from page.json (capture.mjs prints the main ones and draws them
 * on elements.jpg), an element's exact text ("Make my free video"), a list of them (framed together), a box
 * { x, y, w, h } in the page's CSS pixels, or "window" (the whole browser window) / "viewport" (the page area).
 *
 * Shots: at (seconds: when the move starts; start it 0-0.2 s before the word that names the target), on, and
 * optionally pad (CSS px around the target), zoom (times the whole-window view, instead of fitting the target),
 * move (seconds; by default 0.75-2.2 s, longer the further the picture travels; 0 cuts), ease ("smooth" | "out" |
 * "linear"), drift (slow push-in while holding, default
 * 0.025; 0 holds dead still), scroll (page scroll in CSS px, or "top"; by default the page scrolls just enough to show
 * the target). The camera never zooms past the screenshot's own sharpness, never shows past the window's edges when
 * zoomed in, and keeps the target inside the frame minus the inset.
 *
 * Marks: ring { at, until, ring, pad, dim, color }: an outline that settles onto the element; dim darkens the rest of
 * the page (0-0.8). type { at, until, type, cps }: plays the typing filmed by capture.mjs --type, with a caret.
 * cursor { at, until, cursor, click, move, from, point }: the pointer arrives at the target at `at` (gliding in over
 * `move` seconds, default 0.65) and clicks if click is true; point is where on the element, [0.5, 0.5] by default.
 * label { at, until, label, text, side, size }: a tag beside the element ("bottom" by default, or top, left, right),
 * outside any ring around it; size is its text height at 1080p (34 by default).
 * `until` ends a mark (it fades out); without it the mark stays to the end of the scene.
 *
 * Options: frame ("browser" | "phone" | "none": full-bleed page, no window), background (CSS behind the window),
 * url (the address in the browser bar), accentText, maxZoom (cap below the screenshot's sharpness), width/height (the
 * frame size; defaults to the scene element's, else the window's), debug (outline every element with its id).
 *
 * Rendering is a pure function of t: no CSS transitions, timers or animations, so every captured frame is exact.
 */
(function () {
  "use strict";

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const unit = (x) => clamp(x, 0, 1);
  const EASE = {
    smooth: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    out: (x) => 1 - Math.pow(1 - x, 3),
    linear: (x) => x,
  };
  const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/\s+/g, " ").trim();
  // Deterministic jitter in [0, 1) per integer: a natural typing rhythm that's the same on every render.
  const noise = (n) => {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const luminance = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return 0;
    const v = parseInt(m[1], 16);
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  };
  const px = (v) => `${Math.round(v * 100) / 100}px`;

  function node(tag, style, parent) {
    const e = document.createElement(tag);
    Object.assign(e.style, style);
    if (parent) parent.appendChild(e);
    return e;
  }

  /** The page.json in a capture folder, for pages served over http (inline the JSON instead for file:// pages). */
  function load(base) {
    const url = String(base).replace(/\/?$/, "/") + "page.json";
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HypedCamera.load: ${url} returned ${r.status}`);
      return r.json();
    });
  }

  function create(container, capture, options) {
    if (!container || !container.appendChild) throw new Error("HypedCamera.create: the first argument is the scene element to draw in");
    if (!capture || !capture.viewport || !Array.isArray(capture.elements)) throw new Error("HypedCamera.create: pass the page.json written by .hyped/capture.mjs");
    const o = Object.assign(
      {
        base: "",
        frame: capture.viewport.mobile ? "phone" : "browser",
        accent: "#ffffff",
        accentText: "#0a0a0a",
        background: null,
        url: null,
        inset: {},
        maxZoom: capture.scale || 1,
        shots: [{ at: 0, on: "window" }],
        marks: [],
        width: 0,
        height: 0,
        debug: false,
      },
      options || {},
    );
    if (!["browser", "phone", "none"].includes(o.frame)) throw new Error(`HypedCamera: frame must be "browser", "phone" or "none", not "${o.frame}"`);
    const base = o.base ? String(o.base).replace(/\/?$/, "/") : "";
    const vw = capture.viewport.width;
    const vh = capture.viewport.height;
    const pageW = capture.width || vw;
    const pageH = capture.height || vh;
    const maxScroll = Math.max(0, pageH - vh);
    const sticky = Math.min(capture.sticky || 0, vh / 3);
    const dark = luminance(capture.background) < 0.5;

    // ---- Targets -------------------------------------------------------------------------------------------------
    const byId = new Map(capture.elements.map((e) => [e.id, e]));
    const KINDS = ["button", "field", "input", "heading", "badge", "link", "card", "image", "text", "section"];
    function find(name) {
      if (byId.has(name)) return byId.get(name);
      const want = norm(name);
      for (const test of [(e) => norm(e.text) === want, (e) => norm(e.text).startsWith(want)]) {
        const hits = capture.elements.filter(test);
        if (!hits.length) continue;
        const best = KINDS.map((k) => hits.filter((h) => h.kind === k)).find((list) => list.length) || hits;
        if (best.length === 1) return best[0];
        throw new Error(`HypedCamera: "${name}" matches ${best.length} elements (${best.slice(0, 6).map((h) => h.id).join(", ")}): use one of their ids`);
      }
      const stem = want.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const close = capture.elements.filter((e) => stem && e.id.includes(stem.slice(0, 14))).slice(0, 6).map((e) => e.id);
      throw new Error(`HypedCamera: no element "${name}" in page.json${close.length ? ` (did you mean ${close.join(", ")}?)` : " (see elements.jpg and page.json for ids)"}`);
    }
    function target(spec) {
      if (spec == null) throw new Error("HypedCamera: a shot or mark has no target");
      if (spec === "window" || spec === "viewport") return { special: spec };
      if (Array.isArray(spec)) {
        const boxes = spec.map(target);
        if (boxes.some((b) => b.special)) throw new Error('HypedCamera: "window" and "viewport" can\'t be combined with other targets');
        const x = Math.min(...boxes.map((b) => b.x));
        const y = Math.min(...boxes.map((b) => b.y));
        const right = Math.max(...boxes.map((b) => b.x + b.w));
        const bottom = Math.max(...boxes.map((b) => b.y + b.h));
        return { x, y, w: right - x, h: bottom - y, r: 0, fixed: boxes.every((b) => b.fixed) };
      }
      if (typeof spec === "object") {
        const b = { x: Number(spec.x), y: Number(spec.y), w: Number(spec.w), h: Number(spec.h), r: Number(spec.r) || 0, fixed: !!spec.fixed };
        if (![b.x, b.y, b.w, b.h].every(Number.isFinite)) throw new Error("HypedCamera: a box target needs numeric x, y, w and h (page CSS pixels)");
        return b;
      }
      const e = find(String(spec));
      return { x: e.x, y: e.y, w: e.w, h: e.h, r: e.r || 0, fixed: !!e.fixed, id: e.id };
    }
    function typingOf(spec) {
      const list = capture.typing || [];
      const t = list.find((x) => x.id === spec) || list.find((x) => x.text === spec) || list.find((x) => norm(x.text) === norm(spec));
      if (!t) throw new Error(`HypedCamera: no typing "${spec}" in page.json: capture the page with --type "${spec}"`);
      return t;
    }
    const time = (v, what) => {
      if (!Number.isFinite(v)) throw new Error(`HypedCamera: ${what} needs a numeric "at" (seconds on the final timeline)`);
      return v;
    };

    const shots = (o.shots && o.shots.length ? o.shots : [{ at: 0, on: "window" }])
      .map((s) => Object.assign({}, s, { at: time(s.at, "a shot"), tgt: target(s.on == null ? "window" : s.on) }))
      .sort((a, b) => a.at - b.at);
    const rings = [];
    const typings = [];
    const cursors = [];
    const labels = [];
    for (const m of o.marks || []) {
      if (m.ring != null) rings.push(Object.assign({}, m, { at: time(m.at, "a ring"), tgt: target(m.ring) }));
      else if (m.type != null) typings.push(Object.assign({}, m, { at: time(m.at, "a typing mark"), typing: typingOf(m.type) }));
      else if (m.cursor != null) cursors.push(Object.assign({}, m, { at: time(m.at, "a cursor"), tgt: target(m.cursor), src: m.from != null ? target(m.from) : null }));
      else if (m.label != null) {
        if (!m.text) throw new Error("HypedCamera: a label mark needs text");
        labels.push(Object.assign({}, m, { at: time(m.at, "a label"), tgt: target(m.label) }));
      } else throw new Error(`HypedCamera: unknown mark ${JSON.stringify(m)} (use ring, type, cursor or label)`);
    }
    cursors.sort((a, b) => a.at - b.at);
    if (rings.concat(cursors, labels).some((m) => m.tgt.special)) throw new Error('HypedCamera: marks need an element or a box, not "window" or "viewport"');

    // ---- The world: a browser window (or phone, or the bare page) in CSS pixels of the captured page -------------------
    const bar = o.frame === "browser" ? Math.round(clamp(vw * 0.028, 30, 52)) : 0;
    const bezel = o.frame === "phone" ? Math.round(vw * 0.034) : 0;
    const radius = o.frame === "browser" ? Math.round(clamp(vw * 0.009, 8, 18)) : o.frame === "phone" ? Math.round(vw * 0.15) : 0;
    const innerRadius = o.frame === "phone" ? radius - bezel : 0;
    // A phone shows its status bar above the page, as a real one does, so the Dynamic Island never covers the site.
    const status = o.frame === "phone" ? Math.round(vw * 0.12) : 0;
    const win = { x: 0, y: 0, w: vw + 2 * bezel, h: vh + bar + status + 2 * bezel };
    const content = { x: bezel, y: bar + bezel + status, w: vw, h: vh };

    const accentSoft = `color-mix(in srgb, ${o.accent} 18%, transparent)`;
    const root = node("div", { position: "absolute", left: "0", top: "0", right: "0", bottom: "0", overflow: "hidden", pointerEvents: "none", background: o.background || (dark ? `radial-gradient(90% 75% at 50% 0%, ${accentSoft} 0%, transparent 62%), linear-gradient(180deg, #141416 0%, #09090b 100%)` : `radial-gradient(90% 75% at 50% 0%, ${accentSoft} 0%, transparent 62%), linear-gradient(180deg, #f4f4f6 0%, #e4e4e8 100%)`) }, container);
    root.setAttribute("data-hyped-camera", "");
    if (o.frame === "none") root.style.background = capture.background || "#000";
    const world = node("div", { position: "absolute", left: "0", top: "0", width: px(win.w), height: px(win.h), transformOrigin: "0 0" }, root);
    const chrome = dark ? { bar: "#1f1f23", pill: "#2b2b30", text: "#a1a1aa", edge: "rgba(255,255,255,0.09)" } : { bar: "#e8e8eb", pill: "#f8f8f9", text: "#5f6368", edge: "rgba(0,0,0,0.12)" };
    const windowEl = node("div", {
      position: "absolute", left: "0", top: "0", width: px(win.w), height: px(win.h), borderRadius: px(radius), overflow: "hidden",
      background: o.frame === "phone" ? "#0c0c0e" : chrome.bar,
      boxShadow: o.frame === "none" ? "none" : `0 ${px(win.w * 0.018)} ${px(win.w * 0.06)} rgba(0,0,0,${dark ? 0.55 : 0.28}), 0 0 0 1px ${o.frame === "phone" ? "rgba(255,255,255,0.14)" : chrome.edge}`,
    }, world);
    if (o.frame === "browser") {
      const d = bar * 0.26;
      ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => node("div", { position: "absolute", left: px(bar * 0.5 + i * (d + bar * 0.2)), top: px((bar - d) / 2), width: px(d), height: px(d), borderRadius: "50%", background: c }, windowEl));
      const pillW = Math.min(vw * 0.42, 620);
      const pill = node("div", {
        position: "absolute", left: px((vw - pillW) / 2), top: px(bar * 0.19), width: px(pillW), height: px(bar * 0.62), borderRadius: px(bar * 0.31),
        background: chrome.pill, color: chrome.text, font: `500 ${px(bar * 0.34)}/${px(bar * 0.62)} -apple-system, "Inter", "Segoe UI", sans-serif`,
        textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }, windowEl);
      pill.textContent = o.url || String(capture.url || "").replace(/^[a-z]+:\/\//i, "").replace(/\/$/, "");
    }
    const contentEl = node("div", {
      position: "absolute", left: px(content.x), top: px(content.y), width: px(content.w), height: px(content.h), overflow: "hidden",
      background: capture.background || "#fff", borderRadius: o.frame === "phone" ? `0 0 ${px(innerRadius)} ${px(innerRadius)}` : o.frame === "browser" ? `0 0 ${px(radius)} ${px(radius)}` : "0",
    }, windowEl);
    const pageEl = node("div", { position: "absolute", left: "0", top: "0", width: px(pageW), height: px(pageH) }, contentEl);
    const images = [];
    const image = (src, style, parent) => {
      const img = node("img", Object.assign({ position: "absolute", display: "block", maxWidth: "none" }, style), parent);
      img.decoding = "sync";
      img.draggable = false;
      img.src = base + src;
      images.push(img);
      return img;
    };
    image(capture.image || "page.png", { left: "0", top: "0", width: px(pageW), height: px(pageH) }, pageEl);
    let stickyEl = null;
    if (sticky > 0) {
      stickyEl = node("div", { position: "absolute", left: "0", top: "0", width: px(vw), height: px(sticky), overflow: "hidden" }, contentEl);
      image(capture.image || "page.png", { left: "0", top: "0", width: px(pageW), height: px(pageH) }, stickyEl);
    }
    if (o.frame === "phone") {
      const ink = dark ? "#fff" : "#000";
      const bar2 = node("div", { position: "absolute", left: px(bezel), top: px(bezel), width: px(vw), height: px(status), background: capture.background || "#fff", borderRadius: `${px(innerRadius)} ${px(innerRadius)} 0 0` }, windowEl);
      const clock = node("div", { position: "absolute", left: px(vw * 0.1), top: "0", height: px(status), font: `600 ${px(status * 0.34)}/${px(status * 1.08)} -apple-system, "Inter", sans-serif`, color: ink, letterSpacing: "0.01em" }, bar2);
      clock.textContent = "9:41";
      const battery = node("div", { position: "absolute", right: px(vw * 0.09), top: px(status * 0.42), width: px(status * 0.5), height: px(status * 0.24), boxSizing: "border-box", border: `${px(1.2)} solid ${ink}`, borderRadius: px(status * 0.07), opacity: "0.9" }, bar2);
      node("div", { position: "absolute", left: px(1.4), top: px(1.4), right: px(status * 0.14), bottom: px(1.4), background: ink, borderRadius: px(status * 0.03) }, battery);
      node("div", { position: "absolute", left: px(win.w / 2 - vw * 0.15), top: px(bezel + status * 0.18), width: px(vw * 0.3), height: px(status * 0.62), borderRadius: px(status * 0.31), background: "#000" }, windowEl);
    }

    // Typing: the filmed frames sit on the page at their measured box, pixel for pixel over page.png.
    for (const m of typings) {
      const t = m.typing;
      const layer = node("div", { position: "absolute", left: px(t.x), top: px(t.y), width: px(t.w), height: px(t.h), visibility: "hidden" }, pageEl);
      m.layer = layer;
      m.frames = t.frames.map((f) => image(f, { left: "0", top: "0", width: px(t.w), height: px(t.h), visibility: "hidden" }, layer));
      const c = t.caret || { color: dark ? "#fff" : "#111", width: 2 };
      m.caret = node("div", { position: "absolute", width: px(c.width || 2), background: c.color, borderRadius: px(1), visibility: "hidden" }, layer);
      // The moment each character appears: a steady pace with a little human unevenness.
      const cps = m.cps || 13;
      m.times = [];
      let at = m.at + 0.25;
      for (let k = 1; k < t.frames.length; k++) {
        at += (0.7 + 0.6 * noise(k)) / cps;
        m.times.push(at);
      }
    }
    if (o.debug) {
      for (const e of capture.elements) {
        const b = node("div", { position: "absolute", left: px(e.x), top: px(e.y), width: px(e.w), height: px(e.h), outline: "1px solid rgba(255,0,80,0.8)" }, e.fixed && stickyEl ? stickyEl : pageEl);
        const tag = node("div", { position: "absolute", left: "0", top: "-12px", font: "10px/12px monospace", color: "#fff", background: "rgba(255,0,80,0.8)", whiteSpace: "nowrap", padding: "0 2px" }, b);
        tag.textContent = e.id;
      }
    }

    // Screen-space marks: rings and click flashes clipped to the page area; labels, ripples and the cursor above all.
    const overlay = node("div", { position: "absolute", left: "0", top: "0", right: "0", bottom: "0" }, root);
    const clip = node("div", { position: "absolute", overflow: "hidden" }, overlay);
    for (const m of rings) m.el = node("div", { position: "absolute", boxSizing: "border-box", display: "none" }, clip);
    for (const m of cursors) {
      if (m.click) {
        m.flash = node("div", { position: "absolute", display: "none", background: "rgba(255,255,255,0.22)" }, clip);
        m.ripple = node("div", { position: "absolute", display: "none", borderRadius: "50%", boxSizing: "border-box" }, overlay);
      }
    }
    for (const m of labels) {
      m.el = node("div", { position: "absolute", display: "none", whiteSpace: "nowrap", fontWeight: "650", letterSpacing: "-0.01em", background: o.accent, color: o.accentText, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }, overlay);
      m.el.textContent = m.text;
    }
    const cursorEl = cursors.length ? node("div", { position: "absolute", left: "0", top: "0", display: "none", transformOrigin: "0 0", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.45))" }, overlay) : null;
    // On a phone the pointer is a fingertip: a soft circle that presses down, not an arrow.
    const touch = o.frame === "phone";
    if (cursorEl) {
      cursorEl.innerHTML = touch
        ? '<div style="width:100%;height:100%;border-radius:50%;box-sizing:border-box;background:rgba(255,255,255,0.42);border:2px solid rgba(255,255,255,0.92)"></div>'
        : '<svg viewBox="0 0 24 34" width="100%" height="100%" style="display:block"><path d="M2 2 L2 27 L8.5 21 L13 31.5 L17.5 29.5 L13 19.5 L22 19.5 Z" fill="#fff" stroke="#0a0a0a" stroke-width="1.7" stroke-linejoin="round"/></svg>';
      if (touch) cursorEl.style.transformOrigin = "50% 50%";
    }

    const ready = Promise.all(images.map((img) => img.decode().catch(() => {
      throw new Error(`HypedCamera: couldn't load ${img.src} (base must be the capture's folder, relative to this page)`);
    })));
    ready.catch(() => {});

    // ---- Framing ---------------------------------------------------------------------------------------------------
    let W = 0, H = 0, safe, fit, minS, maxS, margin, planned;
    const starts = []; // where each move begins: the camera's real state when its shot starts
    const toWorld = (b, scroll) => ({ x: content.x + b.x, y: content.y + b.y - (b.fixed ? 0 : scroll), w: b.w, h: b.h });
    function scrollFor(b, current) {
      if (b.fixed) return current;
      const pad = 24;
      const top = b.y - pad, bottom = b.y + b.h + pad;
      if (top >= current + sticky && bottom <= current + vh) return current;
      const s = bottom - top > vh - sticky ? top - sticky : b.y + b.h / 2 - (vh + sticky) / 2;
      return clamp(Math.round(s), 0, maxScroll);
    }
    function clampView(v) {
      const s = clamp(v.s, minS, maxS);
      const m = margin / s;
      const bounds = o.frame === "none" ? content : { x: win.x - m, y: win.y - m, w: win.w + 2 * m, h: win.h + 2 * m };
      let x = v.x, y = v.y;
      const left = x - safe.cx / s, right = x + (W - safe.cx) / s;
      const top = y - safe.cy / s, bottom = y + (H - safe.cy) / s;
      if (right - left >= bounds.w) x = bounds.x + bounds.w / 2 + (W / 2 - safe.cx) / s * (o.frame === "none" ? 1 : 0);
      else if (left < bounds.x) x += bounds.x - left;
      else if (right > bounds.x + bounds.w) x -= right - (bounds.x + bounds.w);
      if (bottom - top >= bounds.h) y = bounds.y + bounds.h / 2 + (H / 2 - safe.cy) / s * (o.frame === "none" ? 1 : 0);
      else if (top < bounds.y) y += bounds.y - top;
      else if (bottom > bounds.y + bounds.h) y -= bottom - (bounds.y + bounds.h);
      return { x, y, s, scroll: v.scroll };
    }
    function layout() {
      W = o.width || container.clientWidth || window.innerWidth;
      H = o.height || container.clientHeight || window.innerHeight;
      const ins = Object.assign(o.frame === "none" ? { top: 0, right: 0, bottom: 0, left: 0 } : { top: 0.07, right: 0.06, bottom: 0.07, left: 0.06 }, o.inset || {});
      safe = { x: W * ins.left, y: H * ins.top, w: W * (1 - ins.left - ins.right), h: H * (1 - ins.top - ins.bottom) };
      safe.cx = safe.x + safe.w / 2;
      safe.cy = safe.y + safe.h / 2;
      fit = o.frame === "none" ? Math.max(W / vw, H / vh) : Math.min(safe.w / win.w, safe.h / win.h);
      minS = fit;
      maxS = Math.max(o.maxZoom, fit);
      margin = o.frame === "none" ? 0 : 0.035 * Math.min(W, H);
      let scroll = 0;
      planned = shots.map((sh, i) => {
        let box;
        if (sh.tgt.special) {
          scroll = sh.scroll === "top" ? 0 : Number.isFinite(sh.scroll) ? clamp(sh.scroll, 0, maxScroll) : scroll;
          box = sh.tgt.special === "window" ? win : content;
        } else {
          scroll = sh.scroll === "top" ? 0 : Number.isFinite(sh.scroll) ? clamp(sh.scroll, 0, maxScroll) : scrollFor(sh.tgt, scroll);
          const b = toWorld(sh.tgt, scroll);
          // Only what's inside the window can be seen: frame that part.
          const x0 = Math.max(b.x, content.x), y0 = Math.max(b.y, content.y);
          const x1 = Math.min(b.x + b.w, content.x + content.w), y1 = Math.min(b.y + b.h, content.y + content.h);
          box = x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : content;
        }
        const pad = sh.tgt.special ? 0 : Number.isFinite(sh.pad) ? sh.pad : clamp(0.22 * Math.max(box.w, box.h), 28, 140);
        const s = Number.isFinite(sh.zoom) ? sh.zoom * fit : Math.min(safe.w / (box.w + 2 * pad), safe.h / (box.h + 2 * pad));
        const v = clampView({ x: box.x + box.w / 2, y: box.y + box.h / 2, s, scroll });
        return Object.assign(v, { at: sh.at, move: i === 0 ? 0 : Number.isFinite(sh.move) ? Math.max(0, sh.move) : null, ease: EASE[sh.ease] || EASE.smooth, drift: Number.isFinite(sh.drift) ? sh.drift : 0.025 });
      });
      // A move takes as long as the eye needs: longer the further the picture travels and the more it zooms.
      planned.forEach((p, i) => {
        if (p.move != null) return;
        const a = planned[i - 1];
        const scale = Math.sqrt(a.s * p.s);
        const screens = (Math.hypot(p.x - a.x, p.y - a.y) + Math.abs(p.scroll - a.scroll)) * scale / Math.min(W, H);
        const auto = clamp(0.75 + 0.4 * screens + 0.25 * Math.abs(Math.log(p.s / a.s)), 0.75, 2.2);
        const next = planned[i + 1];
        p.move = next ? Math.min(auto, Math.max(0.5, (next.at - p.at) * 0.95)) : auto;
      });
      starts.length = 0;
    }
    // Holding on shot i: a slow push-in that starts and ends at rest, so moves in and out of it stay smooth.
    function held(i, t) {
      const p = planned[i];
      const start = p.at + p.move;
      const next = planned[i + 1];
      const span = Math.max(0.5, (next ? next.at : start + 5) - start);
      const room = Math.max(0, Math.min(p.drift, maxS / p.s - 1));
      const d = room * (0.5 - 0.5 * Math.cos(Math.PI * unit((t - start) / span)));
      return clampView({ x: p.x, y: p.y, s: p.s * (1 + d), scroll: p.scroll });
    }
    function mix(a, b, e) {
      const s = Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * e);
      // A long move pulls back a little on the way, so the eye keeps its place.
      const screens = (Math.hypot(b.x - a.x, b.y - a.y) * Math.min(a.s, b.s)) / Math.min(W, H);
      const bump = clamp((screens - 0.6) * 0.18, 0, 0.28) * Math.sin(Math.PI * e);
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, s: s / (1 + bump), scroll: a.scroll + (b.scroll - a.scroll) * e };
    }
    function during(i, t) {
      const p = planned[i];
      if (i > 0 && p.move > 0 && t < p.at + p.move) {
        if (!starts[i]) starts[i] = during(i - 1, p.at);
        const v = mix(starts[i], p, p.ease(unit((t - p.at) / p.move)));
        return o.frame === "none" ? clampView(v) : v;
      }
      return held(i, t);
    }
    function state(t) {
      if (!planned || W !== (o.width || container.clientWidth || window.innerWidth) || H !== (o.height || container.clientHeight || window.innerHeight)) layout();
      let i = 0;
      while (i + 1 < planned.length && planned[i + 1].at <= t) i++;
      return during(i, t);
    }

    // ---- Drawing ---------------------------------------------------------------------------------------------------
    function screen(v) {
      return { tx: safe.cx - v.x * v.s, ty: safe.cy - v.y * v.s };
    }
    function project(b, v) {
      const { tx, ty } = screen(v);
      const w = toWorld(b, v.scroll);
      return { x: tx + w.x * v.s, y: ty + w.y * v.s, w: w.w * v.s, h: w.h * v.s };
    }
    // How far into a mark we are: 0 before it, rising over `rise` seconds, falling over `fall` after `until`.
    const presence = (m, t, rise, fall) => {
      if (t < m.at) return 0;
      const up = EASE.out(unit((t - m.at) / rise));
      return Number.isFinite(m.until) ? up * (1 - unit((t - m.until) / fall)) : up;
    };
    const minWH = () => Math.min(W, H);

    function cursorAt(t, v) {
      if (!cursors.length) return null;
      const first = cursors[0];
      const enter = first.at - (first.move ?? 0.65);
      const last = cursors[cursors.length - 1];
      const leave = Number.isFinite(last.until) ? last.until : last.at + 1.4;
      if (t < enter - 0.15 || t > leave + 0.3) return null;
      const point = (m) => {
        const p = m.point || [0.5, 0.5];
        return { x: m.tgt.x + m.tgt.w * p[0], y: m.tgt.y + m.tgt.h * p[1], fixed: m.tgt.fixed };
      };
      const toScreen = (p) => {
        const { tx, ty } = screen(v);
        const w = toWorld({ x: p.x, y: p.y, w: 0, h: 0, fixed: p.fixed }, v.scroll);
        return { x: tx + w.x * v.s, y: ty + w.y * v.s };
      };
      let i = 0;
      while (i + 1 < cursors.length && cursors[i + 1].at - (cursors[i + 1].move ?? 0.65) <= t) i++;
      const m = cursors[i];
      const end = toScreen(point(m));
      let start;
      if (i > 0) start = toScreen(point(cursors[i - 1]));
      else if (m.src) start = toScreen({ x: m.src.x + m.src.w / 2, y: m.src.y + m.src.h / 2, fixed: m.src.fixed });
      else start = { x: end.x + minWH() * 0.22, y: end.y + minWH() * 0.18 };
      const move = m.move ?? 0.65;
      const e = EASE.smooth(unit((t - (m.at - move)) / Math.max(0.01, move)));
      const dx = end.x - start.x, dy = end.y - start.y;
      const dist = Math.hypot(dx, dy) || 1;
      const arc = 0.1 * dist * Math.sin(Math.PI * e);
      const pos = { x: start.x + dx * e - (dy / dist) * arc, y: start.y + dy * e + (dx / dist) * arc };
      const alpha = unit((t - (enter - 0.15)) / 0.15) * (1 - unit((t - leave) / 0.3));
      let press = 1;
      for (const c of cursors) if (c.click && t >= c.at && t < c.at + 0.3) press = 1 - 0.16 * Math.sin((Math.PI * (t - c.at)) / 0.3);
      return { pos, alpha, press };
    }

    function render(t) {
      const v = state(t);
      const { tx, ty } = screen(v);
      world.style.transform = `translate(${px(tx)}, ${px(ty)}) scale(${Math.round(v.s * 100000) / 100000})`;
      pageEl.style.transform = `translateY(${px(-v.scroll)})`;
      if (stickyEl) stickyEl.style.display = v.scroll > 0.5 ? "block" : "none";

      // The page area on screen: rings and flashes are clipped to it, so nothing shows outside the window.
      const area = { x: tx + content.x * v.s, y: ty + content.y * v.s, w: content.w * v.s, h: content.h * v.s };
      Object.assign(clip.style, { left: px(area.x), top: px(area.y), width: px(area.w), height: px(area.h), borderRadius: o.frame === "phone" ? `0 0 ${px(innerRadius * v.s)} ${px(innerRadius * v.s)}` : o.frame === "browser" ? `0 0 ${px(radius * v.s)} ${px(radius * v.s)}` : "0" });
      const unitPx = minWH() / 1080;

      for (const m of rings) {
        const a = presence(m, t, 0.32, 0.25);
        if (a <= 0) {
          m.el.style.display = "none";
          continue;
        }
        const r = project(m.tgt, v);
        const pad = (Number.isFinite(m.pad) ? m.pad : 7) * unitPx + (1 - EASE.out(unit((t - m.at) / 0.38))) * 16 * unitPx;
        const width = (m.width || 3) * unitPx;
        const color = m.color || o.accent;
        const dim = clamp(Number(m.dim) || 0, 0, 0.85) * a;
        m.box = { x: r.x - pad - width, y: r.y - pad - width, w: r.w + 2 * (pad + width), h: r.h + 2 * (pad + width) };
        Object.assign(m.el.style, {
          display: "block", left: px(r.x - pad - area.x), top: px(r.y - pad - area.y), width: px(r.w + 2 * pad), height: px(r.h + 2 * pad),
          border: `${px(width)} solid ${color}`, borderRadius: px((m.tgt.r || 0) * v.s + pad), opacity: String(Math.min(1, a * 1.4)),
          boxShadow: `0 0 0 1px rgba(0,0,0,0.25), 0 0 ${px(22 * unitPx)} color-mix(in srgb, ${color} 45%, transparent)${dim > 0 ? `, 0 0 0 ${px(Math.max(W, H) * 2)} rgba(0,0,0,${dim.toFixed(3)})` : ""}`,
        });
      }

      for (const m of typings) {
        if (t < m.at || (Number.isFinite(m.until) && t >= m.until)) {
          m.layer.style.visibility = "hidden";
          for (const f of m.frames) f.style.visibility = "hidden";
          m.caret.style.visibility = "hidden";
          continue;
        }
        let k = 0;
        while (k < m.times.length && m.times[k] <= t) k++;
        m.layer.style.visibility = "visible";
        m.frames.forEach((f, i) => (f.style.visibility = i === k ? "visible" : "hidden"));
        const c = m.typing.carets[k];
        const done = k >= m.times.length ? m.times[m.times.length - 1] || m.at : null;
        const on = done == null || t - done < 0.45 || (t - done) % 1.06 < 0.53;
        Object.assign(m.caret.style, { visibility: on && c ? "visible" : "hidden", left: px(c ? c.x : 0), top: px(c ? c.y : 0), height: px(c ? c.h : 0) });
      }

      // Rings drawn this frame, so a label beside a ringed element sits outside the ring, not on its line.
      const ringed = [];
      for (const m of rings) if (m.el.style.display !== "none") ringed.push(m.box);
      for (const m of labels) {
        const a = presence(m, t, 0.28, 0.2);
        if (a <= 0) {
          m.el.style.display = "none";
          continue;
        }
        const r = project(m.tgt, v);
        // Centred on its element, but beyond any ring drawn around it.
        let outer = r;
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        for (const b of ringed) {
          if (cx < b.x || cx > b.x + b.w || cy < b.y || cy > b.y + b.h) continue;
          const x0 = Math.min(outer.x, b.x), y0 = Math.min(outer.y, b.y);
          outer = { x: x0, y: y0, w: Math.max(outer.x + outer.w, b.x + b.w) - x0, h: Math.max(outer.y + outer.h, b.y + b.h) - y0 };
        }
        const size = Math.round((m.size || 34) * unitPx);
        Object.assign(m.el.style, { display: "block", font: `650 ${size}px/1.2 ${o.font || "inherit"}`, padding: `${px(size * 0.36)} ${px(size * 0.7)}`, borderRadius: px(size * 0.55) });
        const w = m.el.offsetWidth, h = m.el.offsetHeight;
        const gap = size * 0.45;
        const side = m.side || "bottom";
        let x = cx - w / 2, y = outer.y + outer.h + gap;
        if (side === "top") y = outer.y - gap - h;
        if (side === "left") (x = outer.x - gap - w), (y = cy - h / 2);
        if (side === "right") (x = outer.x + outer.w + gap), (y = cy - h / 2);
        x = clamp(x, safe.x, safe.x + safe.w - w);
        y = clamp(y, safe.y, safe.y + safe.h - h);
        const lift = (1 - a) * 10 * unitPx * (side === "top" ? -1 : 1);
        Object.assign(m.el.style, { left: px(x), top: px(y + lift), opacity: String(a) });
      }

      const cur = cursorAt(t, v);
      if (cursorEl) {
        if (!cur) cursorEl.style.display = "none";
        else {
          const size = (touch ? 50 : 34) * unitPx;
          const w = touch ? size : size * 0.7;
          const o2 = touch ? size / 2 : size * 0.06;
          Object.assign(cursorEl.style, { display: "block", width: px(w), height: px(size), opacity: String(cur.alpha), transform: `translate(${px(cur.pos.x - (touch ? w / 2 : o2))}, ${px(cur.pos.y - o2)}) scale(${cur.press.toFixed(3)})` });
        }
      }
      for (const m of cursors) {
        if (!m.click) continue;
        const since = t - m.at;
        if (since < 0 || since > 0.55) {
          m.flash.style.display = "none";
          m.ripple.style.display = "none";
          continue;
        }
        const r = project(m.tgt, v);
        const f = 1 - unit(since / 0.22);
        Object.assign(m.flash.style, { display: f > 0 ? "block" : "none", left: px(r.x - area.x), top: px(r.y - area.y), width: px(r.w), height: px(r.h), borderRadius: px((m.tgt.r || 0) * v.s), opacity: String(f) });
        const p = m.point || [0.5, 0.5];
        const cx = r.x + r.w * p[0], cy = r.y + r.h * p[1];
        const e = EASE.out(unit(since / 0.55));
        const rad = (8 + 34 * e) * unitPx;
        Object.assign(m.ripple.style, { display: "block", left: px(cx - rad), top: px(cy - rad), width: px(rad * 2), height: px(rad * 2), border: `${px(3 * unitPx)} solid ${o.accent}`, opacity: String(0.9 * (1 - e)) });
      }
    }

    return {
      element: root,
      ready,
      render,
      /** The camera at time t: { x, y } world point at the frame's centre of interest, s (scale), scroll (page px). */
      state: (t) => Object.assign({}, state(t)),
      /** Where an element (or box) is on screen at time t, in frame pixels: for your own overlays. */
      project: (spec, t) => project(target(spec), state(t)),
    };
  }

  window.HypedCamera = { create, load };
})();
