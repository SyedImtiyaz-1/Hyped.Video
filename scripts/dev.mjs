// Starts the whole platform locally for end-to-end testing:
//   the database (Docker), the render Worker (wrangler dev, runs each video in a container) and the web app.
//
//   npm run dev:all        → open http://localhost:3001, sign up, make a video
//
// Ctrl-C stops everything this script started (the database keeps running in Docker).
import { execSync, spawn } from "node:child_process";

const WEB_PORT = 3001; // 3000 is often taken by other projects
const RENDER_PORT = 8787; // must match DEV_RENDER_URL in .env
const color = { render: "\x1b[35m", web: "\x1b[36m", dev: "\x1b[33m", reset: "\x1b[0m" };
const say = (msg) => console.log(`${color.dev}[dev]${color.reset} ${msg}`);
const ok = (cmd) => {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

if (!ok("docker info")) {
  say("Docker isn't running. Open Docker Desktop, wait until it says it's running, then run this again.");
  process.exit(1);
}
if (!ok("docker compose exec -T postgres pg_isready -U launchreel")) {
  say("Starting the database…");
  execSync("docker compose up -d", { stdio: "inherit" });
  for (let i = 0; i < 30 && !ok("docker compose exec -T postgres pg_isready -U launchreel"); i++) execSync("sleep 1");
}
say("Database ready on localhost:5433.");

// Locally, each video's network proxy container outlives its render container; clear leftovers from earlier runs.
const leftovers = execSync("docker ps -aq --filter name=workerd-hyped-render").toString().trim();
if (leftovers) execSync(`docker rm -f ${leftovers.split("\n").join(" ")}`, { stdio: "ignore" });

const children = [];
function start(name, cmd, args) {
  const child = spawn(cmd, args, { cwd: new URL("..", import.meta.url), stdio: ["ignore", "pipe", "pipe"], env: process.env });
  const prefix = `${color[name]}[${name}]${color.reset} `;
  const forward = (stream, out) => {
    let buffered = "";
    stream.on("data", (chunk) => {
      buffered += chunk;
      const lines = buffered.split("\n");
      buffered = lines.pop();
      for (const line of lines) if (line.trim()) out.write(prefix + line + "\n");
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  child.on("exit", (code) => {
    say(`${name} stopped (exit ${code}).`);
    shutdown();
  });
  children.push(child);
}

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGINT");
  setTimeout(() => process.exit(0), 1500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// The container image copies runner/dist, so rebuild it first or renders run stale runner code.
say("Building the video runner…");
execSync("npm run build:runner", { stdio: "inherit" });
say("Starting the render Worker (the first start builds the video container; that can take a few minutes)…");
start("render", "npm", ["-w", "render", "run", "dev", "--", "--port", String(RENDER_PORT), "--ip", "127.0.0.1"]);
say(`Starting the web app on http://localhost:${WEB_PORT} …`);
start("web", "npm", ["-w", "web", "run", "dev", "--", "-p", String(WEB_PORT)]);
