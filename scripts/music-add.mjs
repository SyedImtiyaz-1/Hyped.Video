// Adds a track to Hyped's music library (runner/audio/music): copies it in, writes its beat grid and strong cues with
// brag's analyzer (librosa, run through uv), and lists it in library.json with its moods, tempo and length, where the
// runner picks each video's track from (runner/src/music.ts).
//
//   npm run music:add -- <file.mp3> --moods energetic,tech --title "Track name" --source https://ende.app/...
//
// Only add music whose license covers customers' commercial use, ads included, and that isn't in Content ID (see
// runner/audio/README.md). Sascha Ende's catalog qualifies: CC BY 4.0 with the credit waived.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MUSIC = join(ROOT, "runner/audio/music");
const ANALYZER = join(ROOT, "runner/skills/brag/scripts");
const LIBRARY = join(MUSIC, "library.json");
const MOODS = ["energetic", "tech", "corporate", "cinematic", "chill", "hiphop", "playful", "calm"];

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const input = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const moods = (flag("moods") ?? "").split(",").map((m) => m.trim()).filter(Boolean);
const title = flag("title");
const source = flag("source");
const license = flag("license") ?? "CC BY 4.0, credit waived by the composer";

if (!input || !existsSync(input) || !title || !source || !moods.length) {
  console.log('Usage: npm run music:add -- <file.mp3> --moods energetic,tech --title "Track name" --source <url> [--license "..."]');
  process.exit(1);
}
const unknown = moods.filter((m) => !MOODS.includes(m));
if (unknown.length) {
  console.log(`Unknown mood(s): ${unknown.join(", ")}. Use: ${MOODS.join(", ")}.`);
  process.exit(1);
}

// A clean, stable file name: "sascha-ende-<title>.mp3".
const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const file = `sascha-ende-${slug}${extname(input).toLowerCase() || ".mp3"}`;
const stem = file.replace(/\.[a-z0-9]+$/, "");
const target = join(MUSIC, file);
if (basename(input) !== file) copyFileSync(input, target);

execFileSync(
  "uv",
  ["run", "--quiet", "--project", ANALYZER, "python", join(ANALYZER, "analyze_music_cues.py"), target, "--output-json", join(MUSIC, "cues", `${stem}.music-cues.json`), "--output-md", join(MUSIC, "cues", `${stem}.music-cues.md`)],
  // The analyzer's Python environment lives outside the repo: runner/skills is copied into the render image as is.
  { stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, UV_PROJECT_ENVIRONMENT: join(homedir(), ".cache", "hyped-music-analyzer") } },
);
const cues = JSON.parse(readFileSync(join(MUSIC, "cues", `${stem}.music-cues.json`), "utf8"));

const library = existsSync(LIBRARY) ? JSON.parse(readFileSync(LIBRARY, "utf8")) : [];
const track = { file, title, moods, bpm: Math.round(cues.tempo), seconds: Math.round(cues.duration), source, license };
const next = [...library.filter((t) => t.file !== file), track].sort((a, b) => a.file.localeCompare(b.file));
writeFileSync(LIBRARY, `[\n${next.map((t) => `  ${JSON.stringify(t)}`).join(",\n")}\n]\n`);
console.log(`✓ ${file}: ${moods.join(", ")}, ${track.bpm} BPM, ${track.seconds}s. The library has ${next.length} tracks.`);
