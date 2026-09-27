// Secrets aren't in wrangler.jsonc, so `wrangler types` can't see them. Set with `npx wrangler secret put <NAME>`.
// Set at least one. Either may be missing at runtime: an engine without its key is skipped (ENGINE / ENGINE_FALLBACK).
// Typed `string`, not optional, to match what `wrangler types` generates from .dev.vars.
interface Env {
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  /** JWK that decrypts customers' private-repo tokens. Set by `npm run repo-keys -- --production`. */
  REPO_TOKEN_PRIVATE_KEY: string;
}
declare namespace Cloudflare {
  interface Env {
    ANTHROPIC_API_KEY: string;
    OPENAI_API_KEY: string;
    REPO_TOKEN_PRIVATE_KEY: string;
  }
}
