// Private-repo access tokens are encrypted in the customer's browser, and only the render Worker can decrypt
// them, right before it downloads the repo. The web app, the database and logs only ever hold ciphertext, and
// the agent's container never gets the token at all: the render Worker downloads the code and hands over files.
//
// Scheme (ECIES-style): a fresh ECDH P-256 key pair per token agrees a secret with the render Worker's public
// key, HKDF-SHA-256 turns it into an AES-256-GCM key, and the ciphertext is bound to the customer's user id
// (GCM additional data), so a ciphertext copied onto another account in the database won't decrypt.
// Web Crypto only: the same code runs in the browser (encrypt) and in the Worker (decrypt).

export type SealedToken = { v: 1; kid: string; epk: string; iv: string; ct: string };

/** A P-256 ECDH key as JWK, with our key id (the private key also has `d`). */
export type RepoTokenJwk = JsonWebKey & { kid: string };

const CURVE = { name: "ECDH", namedCurve: "P-256" } as const;
const INFO = new TextEncoder().encode("launchreel/repo-token/v1");
const additionalData = (userId: string) => new TextEncoder().encode(`repo-token:v1:${userId}`);

const toB64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

/** Base64 → a plain ArrayBuffer, the one buffer type every Web Crypto typing accepts. */
function fromB64(text: string): ArrayBuffer {
  const binary = atob(text);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

/** The key id is our label, not key material: keep it out of the import. */
function jwkForImport({ kid: _kid, ...jwk }: RepoTokenJwk): JsonWebKey {
  return jwk;
}

// `public` is the standard Web Crypto name. Cloudflare's type definitions spell it `$public`, so the type is
// loosened here for both environments; the runtime takes `public` (checked in workerd).
const ecdh = (key: CryptoKey) => ({ name: "ECDH", public: key }) as unknown as Parameters<SubtleCrypto["deriveBits"]>[0];

async function aesKey(shared: ArrayBuffer, epk: ArrayBuffer, usage: "encrypt" | "decrypt") {
  const secret = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: epk, info: INFO }, secret, { name: "AES-GCM", length: 256 }, false, [usage]);
}

/** Browser side: encrypt a token so that only the holder of the private key can read it. */
export async function sealToken(token: string, userId: string, publicKey: RepoTokenJwk): Promise<SealedToken> {
  const server = await crypto.subtle.importKey("jwk", jwkForImport(publicKey), CURVE, false, []);
  const ephemeral = (await crypto.subtle.generateKey(CURVE, true, ["deriveBits"])) as CryptoKeyPair;
  const shared = await crypto.subtle.deriveBits(ecdh(server), ephemeral.privateKey, 256);
  const epk = (await crypto.subtle.exportKey("raw", ephemeral.publicKey)) as ArrayBuffer;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(shared, epk, "encrypt");
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: additionalData(userId) }, key, new TextEncoder().encode(token));
  return { v: 1, kid: publicKey.kid, epk: toB64(epk), iv: toB64(iv), ct: toB64(ct) };
}

/** Render Worker side. Throws if the ciphertext was tampered with, belongs to another user, or used another key. */
export async function openToken(sealed: SealedToken, userId: string, privateKey: RepoTokenJwk): Promise<string> {
  if (sealed.kid !== privateKey.kid) throw new Error(`Token was sealed with key ${sealed.kid}, but this server has ${privateKey.kid}`);
  const own = await crypto.subtle.importKey("jwk", jwkForImport(privateKey), CURVE, false, ["deriveBits"]);
  const epk = fromB64(sealed.epk);
  const theirs = await crypto.subtle.importKey("raw", epk, CURVE, false, []);
  const shared = await crypto.subtle.deriveBits(ecdh(theirs), own, 256);
  const key = await aesKey(shared, epk, "decrypt");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(sealed.iv), additionalData: additionalData(userId) }, key, fromB64(sealed.ct));
  return new TextDecoder().decode(plain);
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Server-side check of what the browser sent: a well-formed envelope, never a raw token. */
export function parseSealedToken(value: unknown): SealedToken | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const ok =
    v.v === 1 &&
    typeof v.kid === "string" && /^[\w-]{1,40}$/.test(v.kid) &&
    typeof v.epk === "string" && B64.test(v.epk) && v.epk.length === 88 && // 65-byte uncompressed P-256 point
    typeof v.iv === "string" && B64.test(v.iv) && v.iv.length === 16 && // 12 bytes
    typeof v.ct === "string" && B64.test(v.ct) && v.ct.length >= 24 && v.ct.length <= 2000;
  return ok ? { v: 1, kid: v.kid as string, epk: v.epk as string, iv: v.iv as string, ct: v.ct as string } : null;
}

/** What the customer sees for a saved token, e.g. "github_pat…9f2c". Never enough to use it. */
export function tokenHint(token: string): string {
  const kind = token.startsWith("github_pat_") ? "github_pat" : token.startsWith("ghp_") ? "ghp" : "token";
  return `${kind}…${token.slice(-4)}`;
}
