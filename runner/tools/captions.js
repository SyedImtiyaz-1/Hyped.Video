/*
 * Hyped captions: burned-in, word-by-word captions for scenes captured frame by frame.
 *
 *   <script src=".hyped/captions.js"></script>      (adjust the path to where your page lives)
 *   const captions = HypedCaptions.create(data, { accent: "#C8F135", format: "landscape" });
 *   // then on EVERY frame, with t = seconds on the FINAL video's timeline (not the scene's own clock):
 *   captions.render(t);
 *
 * `data` is the captions.json written by `voice track` (inline it or fetch it before capturing).
 * Options: accent (highlight colour), accentText (text colour on the highlight), font (defaults to the page's
 * font), format ("landscape" | "vertical" | "square", which sets size and safe area), color, background.
 *
 * Rendering is a pure function of t: no CSS transitions, timers or animations, so every captured frame is exact.
 * The caption sits bottom-centre in the safe area; keep other text out of the bottom ~18% (26% for vertical).
 *
 * Word cues, for timing scenes to the voice (same captions.json):
 *   const cue = HypedCaptions.cues(data);
 *   cue.line("03")               // { start, end } of line 03 on the final timeline
 *   cue.word("03", "SQL")        // { start, end } of the first "SQL" in line 03 (caption or spoken spelling)
 *   cue.word("03", "Python", 2)  // the second "Python" in that line
 * Start a visual change 0-0.2 s before its word (cue.word("03", "SQL").start - 0.1), never after it. A line or word
 * that isn't there throws, so a typo can't quietly put the video out of sync.
 */
(function () {
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

  function create(data, options) {
    const o = Object.assign(
      { accent: "#ffffff", accentText: "#0a0a0a", color: "#ffffff", background: "rgba(10,10,10,0.72)", font: "inherit", format: "landscape" },
      options || {},
    );
    const groups = (data && data.groups) || [];
    const short = Math.min(window.innerWidth, window.innerHeight);
    const size = Math.round(short * (o.format === "vertical" ? 0.058 : o.format === "square" ? 0.056 : 0.05));
    const bottom = o.format === "vertical" ? "17%" : "7%";

    const root = document.createElement("div");
    root.setAttribute("data-hyped-captions", "");
    Object.assign(root.style, {
      position: "fixed", left: "0", right: "0", bottom, display: "flex", justifyContent: "center",
      pointerEvents: "none", zIndex: "2147483647",
    });
    const pill = document.createElement("div");
    Object.assign(pill.style, {
      display: "none", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: `0 ${Math.round(size * 0.28)}px`,
      maxWidth: o.format === "vertical" ? "84vw" : "72vw", padding: `${Math.round(size * 0.26)}px ${Math.round(size * 0.5)}px`,
      borderRadius: `${Math.round(size * 0.42)}px`, background: o.background, color: o.color,
      font: `700 ${size}px/1.2 ${o.font}`, letterSpacing: "-0.01em", textAlign: "center",
      boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
    });
    root.appendChild(pill);
    (document.body || document.documentElement).appendChild(root);

    let shown = -1;
    let spans = [];
    function render(t) {
      let index = -1;
      for (let i = 0; i < groups.length; i++) if (t >= groups[i].start && t < groups[i].end) { index = i; break; }
      if (index < 0) {
        pill.style.display = "none";
        shown = -1;
        return;
      }
      const group = groups[index];
      if (index !== shown) {
        pill.textContent = "";
        spans = group.words.map((w) => {
          const s = document.createElement("span");
          s.textContent = w.text;
          Object.assign(s.style, { display: "inline-block", padding: `0 ${Math.round(size * 0.16)}px`, borderRadius: `${Math.round(size * 0.18)}px` });
          pill.appendChild(s);
          return s;
        });
        shown = index;
      }
      pill.style.display = "inline-flex";
      // Phrase fades and rises in over its first 120 ms.
      const enter = easeOut((t - group.start) / 0.12);
      pill.style.opacity = String(0.2 + 0.8 * enter);
      pill.style.transform = `translateY(${Math.round((1 - enter) * size * 0.25)}px)`;
      group.words.forEach((w, i) => {
        const s = spans[i];
        const next = group.words[i + 1];
        const current = t >= w.start && (next ? t < next.start : t < group.end);
        const spoken = t >= w.start;
        const pop = current ? 1 + 0.06 * (1 - easeOut((t - w.start) / 0.14)) : 1;
        s.style.opacity = spoken ? "1" : "0.45";
        s.style.background = current ? o.accent : "transparent";
        s.style.color = current ? o.accentText : o.color;
        s.style.transform = `scale(${pop.toFixed(3)})`;
      });
    }
    return { render, element: root };
  }

  function cues(data) {
    const lines = (data && data.lines) || [];
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
    const find = (id) => {
      const line = lines.find((l) => l.id === id);
      if (!line) throw new Error(`HypedCaptions.cues: no line "${id}" in captions.json`);
      return line;
    };
    return {
      line(id) {
        const l = find(id);
        return { start: l.start, end: l.end };
      },
      word(id, text, nth) {
        const l = find(id);
        const want = norm(text);
        const n = (nth || 1) - 1;
        // Exact matches first, then words that start with it ("dashboard" finds "dashboards,").
        for (const test of [(w) => norm(w.text) === want, (w) => norm(w.text).startsWith(want)])
          for (const list of [l.words || [], l.spoken || []]) {
            const hit = list.filter(test)[n];
            if (hit) return { start: hit.start, end: hit.end };
          }
        throw new Error(`HypedCaptions.cues: line "${id}" has no word "${text}"${n ? ` (number ${n + 1})` : ""}`);
      },
    };
  }

  window.HypedCaptions = { create, cues };
})();
