# Render container for one video job, built on Cloudflare's Sandbox base image
# (Ubuntu 22.04, Node 22, linux/amd64, Sandbox control server on port 3000).
# The tag must match the @cloudflare/sandbox version in ../render/package.json exactly.
# Built and pushed by `wrangler deploy` from ../render. Build context: this folder.
FROM docker.io/cloudflare/sandbox:0.12.10

# What brag-slim reaches for: FFmpeg, Python, git, fonts. Chromium comes from Playwright below.
# Inter is the fallback typeface for scenes when a product's own web fonts can't be downloaded.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg python3 python3-numpy git fonts-dejavu-core fonts-noto-color-emoji fonts-inter \
    && rm -rf /var/lib/apt/lists/*

# Headless Chromium plus its system libraries, at a fixed path the agent can find.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx -y playwright@1.55.0 install --with-deps chromium && chmod -R a+rx /ms-playwright

# The OpenAI engine: the Codex CLI. npm pulls in its native linux-x64 binary as an optional dependency.
RUN npm install -g --no-audit --no-fund @openai/codex@0.157.1

# "Behind you" reel captions: the speaker's mask (tools/segment.py) from MediaPipe's selfie multiclass segmenter
# (Apache-2.0) on LiteRT, CPU only, in a Python environment of its own (LiteRT needs a newer NumPy than Ubuntu's).
# The model is pinned by version and checksum.
RUN apt-get update && apt-get install -y --no-install-recommends python3-venv && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/segment \
    && /opt/segment/bin/pip install --no-cache-dir ai-edge-litert==2.2.0 \
    && mkdir -p /app/models \
    && /opt/segment/bin/python -c "import urllib.request; urllib.request.urlretrieve('https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite', '/app/models/selfie_multiclass_256x256.tflite')" \
    && echo "c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0  /app/models/selfie_multiclass_256x256.tflite" | sha256sum -c -

# The job runner: the Claude Agent SDK, our bundled entry points (the runner, the voice tool and the reel editor), and the
# brag skills.
WORKDIR /app
COPY package.container.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY dist/run-job.mjs dist/voice.mjs dist/reel.mjs ./dist/
COPY skills ./skills
# Licensed music (CC BY 4.0, credit waived) and sound effects (CC0) for the agent and the reel editor: see audio/README.md.
COPY audio ./audio
# The caption overlay the agent loads in voiceover scenes (copied into each workspace as .hyped/captions.js).
COPY tools ./tools

# The agent runs as an unprivileged user (Claude Code also refuses to bypass permissions as root).
# CODEX_HOME must exist before Codex starts.
RUN useradd --create-home agent && mkdir -p /workspace /home/agent/.codex && chown agent:agent /workspace /home/agent/.codex

# Model calls go to http://anthropic.internal and http://openai.internal/v1, virtual hosts the render
# Worker answers with the real API key added. No key and no extra certificate setup are needed in this image.

# Keep the base image's ENTRYPOINT: the Sandbox control server must keep running.
