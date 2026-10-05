#!/usr/bin/env node
/*
 * Hyped capture: a sharp screenshot of a whole web page plus the exact box of every element on it, for scenes that show
 * a real website through .hyped/camera.js.
 *
 *   node .hyped/capture.mjs <url> <out dir> [options]
 *
 *   --viewport laptop|desktop|mobile|<W>x<H>   the browser window: laptop 1440x900 (default), desktop 1920x1080, or
 *                                              mobile 390x844 (the site's phone layout, for vertical videos)
 *   --scale <n>         image pixels per CSS pixel: 2 by default (3 for mobile). The camera never zooms past it, so
 *                       text stays sharp; capture at 3 if you need to zoom further into something small
 *   --type "<text>"     also film typing <text> into the page's main text field (repeatable). "<css selector>=<text>"
 *                       types into a different field
 *   --scheme light|dark force the site's colour scheme (default: the site's own)
 *   --max-height <px>   capture at most this much of the page, in CSS pixels (default 7000)
 *   --wait <ms>         extra time for the page to settle after it loads (default 1500)
 *
 * Writes to <out dir>:
 *   page.png       the page from the top, <scale> times sharp
 *   page.json      what camera.js reads: the page's size and colours, and every heading, button, link, input (and
 *                  the field box drawn around it), badge, image, card, paragraph and section, each with an id, its text
 *                  and its exact box in CSS pixels
 *   elements.jpg   the top of the page with each element's id drawn on it: look at it to pick ids
 *   typing-<text>/ one frame per typed character, for the camera's typing marks
 * and prints the ids of the main elements.
 *
 * The page is shown the way a visitor sees it: content that reveals on scroll is revealed, lazy images are loaded,
 * entrance animations are finished, cookie banners and chat bubbles are hidden, and fonts load before anything is
 * measured. Boxes are measured in the very state that is photographed, so a mark drawn on a box sits on its element.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const VIEWPORTS = { laptop: [1440, 900], desktop: [1920, 1080], mobile: [390, 844] };
const MAX_DEVICE_PIXELS = 16000; // tallest screenshot Chromium reliably produces, in image pixels

// ---- Arguments -------------------------------------------------------------------------------------------------------

function usage(message) {
  if (message) console.error(`capture: ${message}`);
  console.error('Usage: node .hyped/capture.mjs <url> <out dir> [--viewport laptop|desktop|mobile|WxH] [--scale 2] [--type "text"] [--scheme light|dark] [--max-height 7000] [--wait 1500]');
  process.exit(1);
}

const argv = process.argv.slice(2);
const positional = [];
const opts = { viewport: "laptop", scale: 0, type: [], scheme: "", maxHeight: 7000, wait: 1500 };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const value = () => (i + 1 < argv.length ? argv[++i] : usage(`${a} needs a value`));
  if (a === "--viewport") opts.viewport = value();
  else if (a === "--scale") opts.scale = Number(value());
  else if (a === "--type") opts.type.push(value());
  else if (a === "--scheme") opts.scheme = value();
  else if (a === "--max-height") opts.maxHeight = Number(value());
  else if (a === "--wait") opts.wait = Number(value());
  else if (a.startsWith("--")) usage(`unknown option ${a}`);
  else positional.push(a);
}
if (positional.length !== 2) usage();
let [url, outDir] = positional;
if (!/^[a-z]+:\/\//i.test(url)) url = existsSync(url) ? `file://${resolve(url)}` : `https://${url}`;
outDir = resolve(outDir);

const named = VIEWPORTS[opts.viewport];
const sized = /^(\d{3,4})x(\d{3,4})$/.exec(opts.viewport);
if (!named && !sized) usage(`--viewport must be laptop, desktop, mobile or WxH, not "${opts.viewport}"`);
const [vw, vh] = named ?? [Number(sized[1]), Number(sized[2])];
const mobile = vw < 700;
const scale = opts.scale > 0 ? opts.scale : mobile ? 3 : 2;
if (!(scale >= 1 && scale <= 4)) usage("--scale must be between 1 and 4");
if (opts.scheme && !["light", "dark"].includes(opts.scheme)) usage("--scheme must be light or dark");
const maxHeight = Math.max(vh, Math.min(opts.maxHeight || 7000, Math.floor(MAX_DEVICE_PIXELS / scale)));

// ---- Browser over the DevTools protocol (no dependencies: a pipe to Chromium) ---------------------------------------

function findChromium() {
  if (process.env.HYPED_CHROME && existsSync(process.env.HYPED_CHROME)) return process.env.HYPED_CHROME;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, "/ms-playwright", join(process.env.HOME ?? "", "Library/Caches/ms-playwright"), join(process.env.HOME ?? "", ".cache/ms-playwright")].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
    for (const d of dirs) {
      for (const bin of ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium", "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-mac-x64/Chromium.app/Contents/MacOS/Chromium"]) {
        if (existsSync(join(root, d, bin))) return join(root, d, bin);
      }
    }
  }
  for (const bin of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]) {
    if (existsSync(bin)) return bin;
  }
  console.error("capture: no Chromium found (set HYPED_CHROME to a Chrome or Chromium binary).");
  process.exit(1);
}

function launch() {
  const profile = mkdtempSync(join(tmpdir(), "hyped-capture-"));
  const args = [
    "--headless", "--remote-debugging-pipe", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio",
    "--force-color-profile=srgb", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding", "--disable-features=Translate,MediaRouter", "about:blank",
  ];
  if (process.platform === "linux") args.unshift("--no-sandbox");
  const child = spawn(findChromium(), args, { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-4000)));
  const out = child.stdio[3];
  const input = child.stdio[4];
  let id = 0;
  let pending = Buffer.alloc(0);
  const waiting = new Map();
  const listeners = new Set();
  input.on("data", (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    for (let end = pending.indexOf(0); end >= 0; end = pending.indexOf(0)) {
      const message = JSON.parse(pending.subarray(0, end).toString("utf8"));
      pending = pending.subarray(end + 1);
      if (message.id && waiting.has(message.id)) {
        const { resolve: ok, reject, method } = waiting.get(message.id);
        waiting.delete(message.id);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else ok(message.result);
      } else if (message.method) for (const l of listeners) l(message);
    }
  });
  child.on("exit", () => {
    for (const { reject, method } of waiting.values()) reject(new Error(`${method}: the browser closed. ${stderr.split("\n").filter(Boolean).slice(-3).join(" ")}`));
    waiting.clear();
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((ok, reject) => {
      const n = ++id;
      waiting.set(n, { resolve: ok, reject, method });
      out.write(JSON.stringify({ id: n, method, params, sessionId }) + "\0");
    });
  const close = () => {
    child.kill("SIGKILL");
    rmSync(profile, { recursive: true, force: true });
  };
  return { send, on: (l) => listeners.add(l), off: (l) => listeners.delete(l), close };
}

// ---- In-page code (runs in the captured page) -------------------------------------------------------------------------

// Before any of the site's own scripts: content that reveals "in view" counts as in view at once, wherever it is.
const REVEAL_ALL = `(() => {
  if (!window.IntersectionObserver) return;
  class Always {
    constructor(callback, options) { this.callback = callback; this.root = (options && options.root) || null; this.rootMargin = (options && options.rootMargin) || "0px"; this.thresholds = [].concat((options && options.threshold) || 0); this.targets = new Set(); }
    observe(target) {
      if (this.targets.has(target)) return;
      this.targets.add(target);
      setTimeout(() => {
        if (!this.targets.has(target)) return;
        const r = target.getBoundingClientRect();
        this.callback([{ target, isIntersecting: true, intersectionRatio: 1, boundingClientRect: r, intersectionRect: r, rootBounds: null, time: performance.now() }], this);
      }, 0);
    }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
    takeRecords() { return []; }
  }
  window.IntersectionObserver = Always;
})();`;

/** Scroll through (lazy content), hide banners and chat bubbles, finish animations, wait for fonts and images. */
async function preparePage({ maxHeight }) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const img of document.querySelectorAll("img[loading=lazy]")) img.loading = "eager";
  const end = Math.min(document.documentElement.scrollHeight, maxHeight);
  for (let y = 0; y < end; y += Math.round(innerHeight * 0.7)) {
    scrollTo(0, y);
    await sleep(90);
  }
  scrollTo(0, 0);
  await sleep(350);

  // Paused videos would show the browser's own play bar; a visitor sees the picture.
  const quiet = document.createElement("style");
  quiet.textContent = "video::-webkit-media-controls,video::-webkit-media-controls-enclosure,video::-webkit-media-controls-panel,video::-webkit-media-controls-overlay-play-button,video::-webkit-media-controls-start-playback-button{display:none!important}";
  document.head.appendChild(quiet);
  const hide = (el) => el.style.setProperty("display", "none", "important");
  const banner = /\b(cookies?|consent|gdpr|privacy (settings|preferences)|we use cookies|accept all)\b/i;
  const chat = /intercom|crisp|drift|hubspot|tawk|zendesk|livechat|olark|freshchat|tidio|chatwoot|helpscout|beacon/i;
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    const r = el.getBoundingClientRect();
    const id = `${el.id} ${typeof el.className === "string" ? el.className : ""}`;
    const atTop = r.top <= 2 && r.height < 220;
    if (!atTop && banner.test((el.innerText || "").slice(0, 600))) hide(el);
    else if (chat.test(id) || el.querySelector?.("iframe[src*=intercom],iframe[src*=crisp],iframe[src*=drift],iframe[src*=hubspot],iframe[src*=tawk],iframe[src*=zendesk]")) hide(el);
    else if (!atTop && r.width <= 140 && r.height <= 140 && r.right >= innerWidth - 8 && r.bottom >= innerHeight - 8) hide(el);
  }
  for (const f of document.querySelectorAll("iframe")) if (chat.test(f.src || "") || chat.test(f.id || "")) hide(f);

  const settle = () => {
    for (const a of document.getAnimations()) {
      try {
        a.finish();
      } catch {
        try { a.pause(); } catch {}
      }
    }
  };
  settle();
  for (const v of document.querySelectorAll("video")) v.pause();
  await document.fonts.ready;
  const started = performance.now();
  for (const img of document.images) {
    if (img.complete) continue;
    await Promise.race([new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); }), sleep(Math.max(0, 5000 - (performance.now() - started)))]);
  }
  await sleep(250);
  settle();
  for (const v of document.querySelectorAll("video")) v.pause();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/** Every element worth pointing at, with an id, its text and its box in page CSS pixels (measured at scroll 0). */
function measurePage({ maxHeight }) {
  const W = innerWidth;
  const H = Math.min(document.documentElement.scrollHeight, maxHeight);
  const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const slug = (s) => norm(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 36).replace(/-+$/, "");
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return { a: 0 };
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const hex = (c) => {
    const { r, g, b } = parse(c);
    return "#" + [r, g, b].map((v) => Math.round(v || 0).toString(16).padStart(2, "0")).join("");
  };
  const style = new Map();
  const cs = (el) => {
    let s = style.get(el);
    if (!s) style.set(el, (s = getComputedStyle(el)));
    return s;
  };
  const opacity = (el) => {
    let o = 1;
    for (let e = el, depth = 0; e && e.nodeType === 1 && depth < 20; e = e.parentElement, depth++) {
      const s = cs(e);
      if (s.display === "none" || s.visibility === "hidden" || s.contentVisibility === "hidden") return 0;
      o *= Number(s.opacity);
    }
    return o;
  };
  const pinned = (el) => {
    for (let e = el; e && e !== document.body && e.nodeType === 1; e = e.parentElement) {
      const p = cs(e).position;
      if (p === "fixed") return true;
      if (p === "sticky") return e.getBoundingClientRect().top <= 2;
    }
    return false;
  };
  const background = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const c = parse(cs(e).backgroundColor);
      if (c.a > 0.5) return cs(e).backgroundColor;
    }
    return "rgb(255, 255, 255)";
  };
  const labelOf = (el) => {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return l.innerText;
    }
    return el.closest("label")?.innerText || "";
  };
  const fileName = (src) => (src || "").split(/[?#]/)[0].split("/").pop().replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
  const firstHeading = (el) => el.querySelector("h1,h2,h3,h4,h5,h6,[role=heading]")?.innerText || "";

  const visible = (el, r) => r.width >= 4 && r.height >= 4 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W && opacity(el) > 0.08;
  const looksLikeButton = (el, r, s) => {
    if (r.height < 20 || r.height > 110 || r.width > 560) return false;
    if (norm(el.innerText).length > 48) return false;
    const bg = parse(s.backgroundColor);
    const border = parseFloat(s.borderTopWidth) >= 1 && parse(s.borderTopColor).a >= 0.2;
    return bg.a >= 0.15 || border || s.backgroundImage !== "none";
  };
  const looksLikeCard = (el, r, s) => {
    if (r.width < 120 || r.height < 72 || r.width > W * 0.96 || r.height > innerHeight * 1.6) return false;
    const border = parseFloat(s.borderTopWidth) >= 1 && parse(s.borderTopColor).a >= 0.06;
    const shadow = s.boxShadow && s.boxShadow !== "none";
    const bg = parse(s.backgroundColor).a >= 0.04 && s.backgroundColor !== background(el.parentElement || document.body);
    return (border || shadow || bg || s.backgroundImage !== "none") && (parseFloat(s.borderTopLeftRadius) >= 4 || border || shadow);
  };

  const found = [];
  const add = (el, kind, text) => {
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) return;
    const radius = Math.min(parseFloat(cs(el).borderTopLeftRadius) || 0, r.width / 2, r.height / 2);
    found.push({ el, kind, text: norm(text).slice(0, 140), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, r: radius, fixed: pinned(el) || undefined });
  };
  const seen = new Set();
  const take = (selector, fn) => {
    for (const el of document.querySelectorAll(selector)) {
      if (seen.has(el)) continue;
      const kind = fn(el);
      if (kind) seen.add(el);
    }
  };
  // The box a visitor sees as the field: the input itself if it draws its own border or background, else the nearest
  // bordered wrapper around it that isn't much bigger (an input group with an icon and a button inside).
  const boxed = (s) => (parseFloat(s.borderTopWidth) >= 1 && parse(s.borderTopColor).a >= 0.08) || parse(s.backgroundColor).a >= 0.04 || (s.boxShadow && s.boxShadow !== "none");
  const fieldOf = (input) => {
    if (boxed(cs(input))) return null;
    const ri = input.getBoundingClientRect();
    for (let e = input.parentElement, depth = 0; e && e !== document.body && depth < 4; e = e.parentElement, depth++) {
      const r = e.getBoundingClientRect();
      if (r.height > Math.max(ri.height * 3, ri.height + 90) || r.width > Math.max(ri.width * 3.2, ri.width + 640)) return null;
      if (boxed(cs(e))) return e;
    }
    return null;
  };
  take("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=image]):not([type=reset]),textarea,select,[contenteditable=true],[contenteditable='']", (el) => {
    const text = el.placeholder || el.getAttribute("aria-label") || labelOf(el) || el.name || el.value;
    add(el, "input", text);
    const field = fieldOf(el);
    if (field && !seen.has(field)) {
      seen.add(field);
      add(field, "field", text);
    }
    return "input";
  });
  take("button,[role=button],input[type=submit],input[type=button],a[href]", (el) => {
    const r = el.getBoundingClientRect();
    const s = cs(el);
    const text = el.innerText || el.value || el.getAttribute("aria-label") || el.title || "";
    if (el.tagName === "A" && !looksLikeButton(el, r, s)) {
      if (looksLikeCard(el, r, s)) add(el, "card", firstHeading(el) || el.getAttribute("aria-label") || el.innerText);
      else if (norm(text)) add(el, "link", text);
      else return null;
      return "link";
    }
    add(el, "button", text);
    return "button";
  });
  take("h1,h2,h3,h4,h5,h6,[role=heading]", (el) => (add(el, "heading", el.innerText), "heading"));
  take("img,video,canvas,svg,picture", (el) => {
    const r = el.getBoundingClientRect();
    const min = el.tagName === "svg" ? 72 : 40;
    if (r.width < min || r.height < min) return null;
    if (el.closest("button,a[href]") && r.width < 200) return null;
    add(el, "image", el.alt || el.getAttribute("aria-label") || el.title || fileName(el.currentSrc || el.src || el.poster));
    return "image";
  });
  take("div,article,li,section,aside", (el) => {
    const r = el.getBoundingClientRect();
    if (!looksLikeCard(el, r, cs(el))) return null;
    add(el, "card", firstHeading(el) || el.getAttribute("aria-label") || el.innerText.slice(0, 80));
    return "card";
  });
  take("div,span,small,strong,em,mark,code", (el) => {
    const t = norm(el.innerText);
    if (!t || t.length > 40 || el.querySelector("div,p,ul,ol,h1,h2,h3,h4,button,a,input")) return null;
    const r = el.getBoundingClientRect();
    const s = cs(el);
    if (r.height < 14 || r.height > 56 || r.width > 400 || parseFloat(s.borderTopLeftRadius) < 3 || !boxed(s)) return null;
    add(el, "badge", t);
    return "badge";
  });
  take("p,blockquote,figcaption,li,dd,dt", (el) => {
    const t = norm(el.innerText);
    if (t.length < 3 || el.querySelector("p,ul,ol,div,h1,h2,h3,h4")) return null;
    add(el, "text", t);
    return "text";
  });
  take("header,nav,main,section,footer,form,aside,article", (el) => {
    const r = el.getBoundingClientRect();
    if (r.height < 48) return null;
    add(el, "section", el.getAttribute("aria-label") || firstHeading(el) || el.id || el.tagName.toLowerCase());
    return "section";
  });

  // Same box twice (a link wrapping a card, a picture wrapping its img): keep the first, the more specific kind.
  const kept = [];
  const same = (a, b) => Math.abs(a.x - b.x) <= 1.5 && Math.abs(a.y - b.y) <= 1.5 && Math.abs(a.w - b.w) <= 1.5 && Math.abs(a.h - b.h) <= 1.5;
  for (const f of found) if (!kept.some((k) => same(k, f))) kept.push(f);
  const limits = { text: 220, link: 160, card: 120, image: 120, badge: 80, section: 60 };
  const counts = {};
  const out = [];
  const used = new Map();
  kept.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const f of kept) {
    counts[f.kind] = (counts[f.kind] || 0) + 1;
    if (limits[f.kind] && counts[f.kind] > limits[f.kind]) continue;
    const base = `${f.kind}-${slug(f.text) || "untitled"}`;
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    const round = (v) => Math.round(v * 10) / 10;
    out.push({ id: n === 1 ? base : `${base}-${n}`, kind: f.kind, text: f.text, x: round(f.x), y: round(f.y), w: round(f.w), h: round(f.h), r: round(f.r), ...(f.fixed ? { fixed: true } : {}) });
  }

  // A header that stays on screen while the page scrolls: the camera keeps it pinned when it scrolls the page.
  let sticky = 0;
  for (const el of document.querySelectorAll("body *")) {
    const s = cs(el);
    if (s.position !== "fixed" && s.position !== "sticky") continue;
    const r = el.getBoundingClientRect();
    if (r.top <= 2 && r.width >= W * 0.6 && r.height >= 24 && r.height <= 200 && opacity(el) > 0.5) sticky = Math.max(sticky, Math.round(r.bottom));
  }
  const pageBg = parse(cs(document.body).backgroundColor).a > 0.5 ? cs(document.body).backgroundColor : parse(cs(document.documentElement).backgroundColor).a > 0.5 ? cs(document.documentElement).backgroundColor : "rgb(255, 255, 255)";
  return {
    title: document.title,
    width: W,
    height: H,
    fullHeight: document.documentElement.scrollHeight,
    sticky,
    background: hex(pageBg),
    text: hex(cs(document.body).color),
    font: cs(document.body).fontFamily,
    elements: out,
  };
}

/** Type into a field: returns the field's box and caret metrics for the given text, or an error. */
function typeInto({ selector, text, value }) {
  const fields = selector
    ? [document.querySelector(selector)]
    : [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=image]),textarea")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 40 && r.height > 12 && getComputedStyle(el).visibility !== "hidden";
      }).sort((a, b) => {
        // The main field: the first one near the top of the page, the widest if several are level.
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const fold = (r) => (r.top < innerHeight ? 0 : 1);
        return fold(ra) - fold(rb) || rb.width - ra.width || ra.top - rb.top;
      });
  const el = fields[0];
  if (!el) return { error: selector ? `no element matches ${selector}` : "the page has no text field to type into" };
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  el.style.setProperty("caret-color", "transparent", "important");
  if (document.activeElement !== el) el.focus({ preventScroll: true });
  if (el.isContentEditable) el.textContent = value;
  else if (set) set.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
  const spacing = parseFloat(s.letterSpacing) || 0;
  const width = (t) => ctx.measureText(t).width + spacing * t.length;
  const left = parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft) + (parseFloat(s.textIndent) || 0);
  const inner = r.width - left - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight);
  const align = s.textAlign === "center" ? 0.5 : s.textAlign === "right" || s.textAlign === "end" ? 1 : 0;
  const size = parseFloat(s.fontSize);
  const caretH = Math.round(size * 1.18 * 10) / 10;
  const top = parseFloat(s.borderTopWidth) + parseFloat(s.paddingTop);
  const contentH = r.height - top - parseFloat(s.borderBottomWidth) - parseFloat(s.paddingBottom);
  const caretY = el instanceof HTMLTextAreaElement ? top + (parseFloat(s.lineHeight) || size * 1.2) / 2 - caretH / 2 : top + contentH / 2 - caretH / 2;
  const caretX = left + (inner - width(value)) * align + width(value);
  const caret = s.color;
  return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, caret: { x: Math.round(caretX * 10) / 10, y: Math.round(caretY * 10) / 10, h: caretH, color: caret, width: Math.max(1.5, Math.round(size * 0.075 * 10) / 10) } };
}

function clearField({ selector }) {
  const el = selector ? document.querySelector(selector) : document.activeElement;
  if (el && "value" in el) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  el?.style?.removeProperty("caret-color");
  el?.blur?.();
}

/** Outline each element with its id, for elements.jpg. */
function annotate({ elements, scale }) {
  const colors = { field: "#ff3d71", input: "#ff8fab", button: "#00d68f", heading: "#ffaa00", card: "#3366ff", image: "#a16eff", link: "#00b8d9", badge: "#f6e05e" };
  const layer = document.createElement("div");
  layer.id = "__hyped_annotations";
  Object.assign(layer.style, { position: "absolute", left: "0", top: "0", width: "0", height: "0", zIndex: "2147483647", pointerEvents: "none" });
  const font = Math.round(12 / scale);
  for (const e of elements) {
    const color = colors[e.kind];
    if (!color) continue;
    const box = document.createElement("div");
    Object.assign(box.style, { position: "absolute", left: `${e.x}px`, top: `${e.y}px`, width: `${e.w}px`, height: `${e.h}px`, outline: `${Math.max(2, Math.round(2 / scale))}px solid ${color}`, boxSizing: "border-box" });
    const tag = document.createElement("div");
    tag.textContent = e.id;
    Object.assign(tag.style, { position: "absolute", left: "0", top: `-${font + 6}px`, font: `600 ${font}px/1.25 ui-monospace, Menlo, monospace`, color: "#000", background: color, padding: "1px 4px", whiteSpace: "nowrap", borderRadius: "2px" });
    box.appendChild(tag);
    layer.appendChild(box);
  }
  document.body.appendChild(layer);
}

// ---- Capture ---------------------------------------------------------------------------------------------------------

const call = (fn, arg) => `(${fn})(${JSON.stringify(arg ?? {})})`;

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = launch();
  const timer = setTimeout(() => {
    console.error("capture: gave up after 150 s (the page never settled).");
    browser.close();
    process.exit(1);
  }, 150_000);
  try {
    const { send, on, off } = browser;
    const { product } = await send("Browser.getVersion");
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const page = (method, params) => send(method, params, sessionId);
    const evaluate = async (expression) => {
      const r = await page("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`in the page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    };
    await page("Page.enable");
    await page("Runtime.enable");
    await page("Emulation.setDeviceMetricsOverride", { width: vw, height: vh, deviceScaleFactor: scale, mobile });
    const version = (product.split("/")[1] ?? "140.0.0.0").split(".")[0];
    const userAgent = mobile
      ? `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Mobile Safari/537.36`
      : `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
    await page("Emulation.setUserAgentOverride", { userAgent, acceptLanguage: "en-US,en" });
    if (mobile) await page("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    const media = [{ name: "prefers-reduced-motion", value: "reduce" }];
    if (opts.scheme) media.push({ name: "prefers-color-scheme", value: opts.scheme });
    await page("Emulation.setEmulatedMedia", { features: media });
    await page("Page.addScriptToEvaluateOnNewDocument", { source: REVEAL_ALL });

    const loaded = new Promise((ok) => {
      const l = (m) => m.sessionId === sessionId && m.method === "Page.loadEventFired" && (off(l), ok());
      on(l);
    });
    const nav = await page("Page.navigate", { url });
    if (nav.errorText) throw new Error(`couldn't open ${url} (${nav.errorText})`);
    await Promise.race([loaded, new Promise((ok) => setTimeout(ok, 30_000))]);
    await new Promise((ok) => setTimeout(ok, opts.wait));
    await evaluate(call(preparePage, { maxHeight }));
    const info = await evaluate(call(measurePage, { maxHeight }));

    const shot = await page("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true, clip: { x: 0, y: 0, width: info.width, height: info.height, scale: 1 } });
    writeFileSync(join(outDir, "page.png"), Buffer.from(shot.data, "base64"));

    // Typing: one frame per character, cut from the page around the field, in the same state as page.png.
    const typing = [];
    for (const spec of opts.type) {
      const eq = spec.indexOf("=");
      const selector = eq > 0 && /^[#.\[a-z]/i.test(spec) && !/^https?:/i.test(spec) ? spec.slice(0, eq) : "";
      const text = selector ? spec.slice(eq + 1) : spec;
      const name = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "text";
      const dir = `typing-${name}`;
      mkdirSync(join(outDir, dir), { recursive: true });
      const frames = [];
      const carets = [];
      let box = null;
      for (let k = 0; k <= text.length; k++) {
        const r = await evaluate(call(typeInto, { selector, text, value: text.slice(0, k) }));
        if (r.error) throw new Error(`--type "${spec}": ${r.error}`);
        await evaluate("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
        // Room around the field for its focus ring and glow; the same box for every frame.
        if (!box) {
          const m = 18;
          const x = Math.max(0, Math.floor(r.x - m)), y = Math.max(0, Math.floor(r.y - m));
          box = { x, y, w: Math.min(info.width, Math.ceil(r.x + r.w + m)) - x, h: Math.min(info.height, Math.ceil(r.y + r.h + m)) - y, field: { x: r.x, y: r.y, w: r.w, h: r.h } };
        }
        const img = await page("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true, clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 } });
        const file = `${dir}/${String(k).padStart(2, "0")}.png`;
        writeFileSync(join(outDir, file), Buffer.from(img.data, "base64"));
        frames.push(file);
        carets.push({ x: Math.round((r.x - box.x + r.caret.x) * 10) / 10, y: Math.round((r.y - box.y + r.caret.y) * 10) / 10, h: r.caret.h });
        if (k === text.length) box.caret = { color: r.caret.color, width: r.caret.width };
      }
      await evaluate(call(clearField, { selector }));
      const field = info.elements.find((e) => e.kind === "input" && Math.abs(e.x - box.field.x) < 2 && Math.abs(e.y - box.field.y) < 2);
      typing.push({ id: `typing-${name}`, text, input: field?.id ?? null, x: box.x, y: box.y, w: box.w, h: box.h, frames, carets, caret: box.caret });
    }

    // elements.jpg: the top of the page with every element's id, to pick targets from.
    await evaluate(call(annotate, { elements: info.elements, scale: 0.6 }));
    const top = Math.min(info.height, vh * 4);
    const preview = await page("Page.captureScreenshot", { format: "jpeg", quality: 82, captureBeyondViewport: true, fromSurface: true, clip: { x: 0, y: 0, width: info.width, height: top, scale: 0.6 / scale } });
    writeFileSync(join(outDir, "elements.jpg"), Buffer.from(preview.data, "base64"));
    await evaluate("document.getElementById('__hyped_annotations')?.remove()");

    const data = {
      url,
      title: info.title,
      viewport: { width: vw, height: vh, mobile },
      scale,
      width: info.width,
      height: info.height,
      cut: info.fullHeight > info.height ? info.fullHeight : undefined,
      image: "page.png",
      background: info.background,
      text: info.text,
      font: info.font,
      sticky: info.sticky,
      elements: info.elements,
      typing,
    };
    writeFileSync(join(outDir, "page.json"), JSON.stringify(data, null, 1));
    summarize(data);
  } finally {
    clearTimeout(timer);
    browser.close();
  }
}

function summarize(data) {
  const rel = (p) => join(outDir, p).replace(process.cwd() + "/", "");
  console.log(`Captured ${data.url}: ${data.width}x${data.height} CSS px at ${data.scale}x, ${data.elements.length} elements${data.cut ? ` (cut at ${data.height} of ${data.cut} px; capture further down with a larger --max-height if you need it)` : ""}.`);
  console.log(`  ${rel("page.json")} · ${rel("page.png")} · ${rel("elements.jpg")} (ids drawn on the page)`);
  for (const t of data.typing) console.log(`  typing "${t.text}" into ${t.input ?? "the field"}: mark { type: "${t.id}" }`);
  const order = ["field", "input", "button", "heading", "badge", "card", "image", "link"];
  const main = data.elements.filter((e) => order.includes(e.kind) && e.y < data.viewport.height * 3).slice(0, 70);
  if (main.length) console.log("Main elements (id · box x,y w×h · text):");
  for (const e of main) {
    console.log(`  ${e.id.padEnd(44)} ${`${Math.round(e.x)},${Math.round(e.y)} ${Math.round(e.w)}×${Math.round(e.h)}`.padEnd(20)} ${e.text.slice(0, 60)}${e.fixed ? " (pinned)" : ""}`);
  }
  console.log("Everything else (paragraphs, sections, further down the page) is in page.json.");
}

main().catch((err) => {
  console.error(`capture: ${err.message}`);
  process.exit(1);
});
