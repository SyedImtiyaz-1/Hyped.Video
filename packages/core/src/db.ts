import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** A Prisma client. On Workers, create one per request and never share it: I/O can't cross requests. */
export type Db = PrismaClient;

/**
 * Connects through a Postgres driver adapter. On Cloudflare, pass the Hyperdrive connection string
 * (Hyperdrive pools connections at the edge). In Node scripts, pass DATABASE_URL.
 */
export function createDb(connectionString: string): Db {
  // maxUses: 1 because each client lives for a single request; Hyperdrive keeps the real pool.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, maxUses: 1 }) });
}
