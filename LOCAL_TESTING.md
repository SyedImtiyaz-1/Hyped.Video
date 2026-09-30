# Test Hyped on your Mac, end to end

Everything runs locally: the website, sign-in (Clerk's test instance), the database, and the render service
that makes each video in its own container. Nothing is deployed and nothing is charged except the AI model
calls on your OpenAI key.

## Before you start

1. Open **Docker Desktop** and wait until it says it's running.
2. Check the model key: `npm run keys` should show OpenAI ✓.

## Start everything

```bash
cd launchreel && npm run dev:all
```

This starts the database, the render service (http://127.0.0.1:8787) and the website (**http://localhost:3001**).
The first start builds the video container, which can take a few minutes. Leave this terminal open; press
Ctrl-C to stop.

## Test it

1. Open **http://localhost:3001** and click **Start free**. Sign up with Google or email. New local accounts get
   **50 test credits**.
2. Go to **New video** and paste a website, for example
   `https://latent-spaces.github.io/brag/examples/taxi-for-taxis/`, or a GitHub repo.
   For a private repo, paste a read-only GitHub token under the link.
3. Pick the **video type** (launch video, product demo or feature spotlight) and fill in the brief: what's new, who
   it's for, what to show, and how it should end. Choose a tone, format, length and **music**.
4. Click **Make video**. The video page updates by itself.
   - On a Mac the container runs under emulation, so a 20-second video takes about **15–30 minutes**
     (a 90-second one can take an hour). On Cloudflare it's faster.
5. When it's ready: play it, download it, copy the share text, or ask for a change in plain English.

## Handy commands

| Command | What it does |
|---|---|
| `npm run keys` | Checks the AI model keys |
| `npm run dev:credits -- you@email.com 20` | Adds 20 test credits to an account |
| `npm run dev:reset` | Wipes all local users, videos and credits for a clean test |
| `npm run measure -- --type demo https://yourproduct.com` | Makes a video straight from the terminal, without the website |

## If something goes wrong

- **"Docker isn't running":** open Docker Desktop, wait for it, and run `npm run dev:all` again.
- **The video fails with "Our AI provider had a problem":** run `npm run keys` and fix the key it flags.
- **"The local render Worker didn't start the job":** the render service isn't running; start `npm run dev:all`.
- **A port is in use (3001 or 8787):** another app is using it. Stop that app, then start again.
- **Sign-in problems:** run `clerk doctor` inside `web/`.
