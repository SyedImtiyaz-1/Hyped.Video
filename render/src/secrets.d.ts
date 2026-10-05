// Secrets aren't in wrangler.jsonc, so `wrangler types` can't see them. Set with `npx wrangler secret put <NAME>`.
// Each quality tier needs its engine's key (STANDARD_ENGINE, STUDIO_ENGINE): a tier without one fails with a 401, refunded.
// Typed `string`, not optional, to match what `wrangler types` generates from .dev.vars.
interface Env {
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  /** JWK that decrypts customers' private-repo tokens. Set by `npm run repo-keys -- --production`. */
  REPO_TOKEN_PRIVATE_KEY: string;
  /** Local development only (render/.dev.vars): lets `next dev` start renders. Never set in production. */
  DEV_START_TOKEN: string;
  /** Stock B-roll in reels (`npm run pexels-key`). Without it, reels have no B-roll. */
  PEXELS_API_KEY?: string;
}
declare namespace Cloudflare {
  interface Env {
    ANTHROPIC_API_KEY: string;
    OPENAI_API_KEY: string;
    REPO_TOKEN_PRIVATE_KEY: string;
    DEV_START_TOKEN: string;
    PEXELS_API_KEY?: string;
  }
}
