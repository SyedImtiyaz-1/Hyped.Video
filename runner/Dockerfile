# Render container for one video job, built on Cloudflare's Sandbox base image
# (Ubuntu 22.04, Node 22, linux/amd64, Sandbox control server on port 3000).
# The tag must match the @cloudflare/sandbox version in ../render/package.json exactly.
# Built and pushed by `wrangler deploy` from ../render. Build context: this folder.
FROM docker.io/cloudflare/sandbox:0.12.10

# What brag-slim reaches for: FFmpeg, Python, git, fonts. Chromium comes from Playwright below.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg python3 python3-numpy git fonts-dejavu-core fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Headless Chromium plus its system libraries, at a fixed path the agent can find.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx -y playwright@1.55.0 install --with-deps chromium && chmod -R a+rx /ms-playwright

# The OpenAI engine: the Codex CLI. npm pulls in its native linux-x64 binary as an optional dependency.
RUN npm install -g --no-audit --no-fund @openai/codex@0.157.1

# The job runner: the Claude Agent SDK, our bundled entry point, and the brag skills.
WORKDIR /app
COPY package.container.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY dist/run-job.mjs ./dist/run-job.mjs
COPY skills ./skills

# The agent runs as an unprivileged user (Claude Code also refuses to bypass permissions as root).
# CODEX_HOME must exist before Codex starts.
RUN useradd --create-home agent && mkdir -p /workspace /home/agent/.codex && chown agent:agent /workspace /home/agent/.codex

# Model calls go to http://anthropic.internal and http://openai.internal/v1, virtual hosts the render
# Worker answers with the real API key added. No key and no extra certificate setup are needed in this image.

# Keep the base image's ENTRYPOINT: the Sandbox control server must keep running.
