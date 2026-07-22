import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Use BETTER_AUTH_SECRET when provided; otherwise generate one once and keep
 * it next to the database so a bare `docker run` works out of the box.
 */
function resolveAuthSecret(): string {
  const fromEnv = process.env.BETTER_AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const dataDir = path.dirname(
    path.resolve(process.env.DATABASE_PATH ?? "./data/vitaplan.db"),
  );
  const secretFile = path.join(dataDir, ".auth-secret");
  try {
    const existing = fs.readFileSync(secretFile, "utf8").trim();
    if (existing) return existing;
  } catch {
    // fall through and create it
  }
  const secret = randomBytes(32).toString("hex");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  console.log(`[vitaplan] Generated auth secret at ${secretFile}`);
  return secret;
}

// Hops between the real client and this container (typically the reverse
// proxy's docker network) that better-auth should strip from
// X-Forwarded-For when resolving a client IP for rate limiting. Without a
// trusted-proxies list, a multi-hop chain (e.g. CDN -> reverse proxy) is
// rejected outright. Defaults cover standard private ranges, which is right
// for the vast majority of reverse-proxy setups; override via
// TRUSTED_PROXIES (comma-separated IPs/CIDRs) for anything unusual.
const DEFAULT_TRUSTED_PROXIES = [
  "127.0.0.1/32",
  "::1/128",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
];

function resolveTrustedProxies(): string[] {
  const fromEnv = (process.env.TRUSTED_PROXIES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_TRUSTED_PROXIES;
}

export const auth = betterAuth({
  secret: resolveAuthSecret(),
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        // The first account created on the instance is the owner/admin. The
        // row is already inserted when this runs, so count === 1 means first.
        after: async (createdUser) => {
          const [{ n }] = await db
            .select({ n: sql<number>`count(*)` })
            .from(schema.user);
          if (Number(n) === 1) {
            await db
              .update(schema.user)
              .set({ role: "admin" })
              .where(eq(schema.user.id, createdUser.id));
          }
        },
      },
    },
  },
  // Self-hosted: the app is reached via LAN IP, hostname, or a reverse-proxy
  // domain that the operator can't know at build time. Auto-trust the
  // origin the request was actually served on (derived from the Host /
  // X-Forwarded-* headers, NOT the caller-supplied Origin header) so a
  // single-origin deployment needs zero config. A cross-site CSRF attempt
  // carries the attacker's Origin, which won't match this, so it's still
  // rejected. TRUSTED_ORIGINS only matters when the app is reached from a
  // *different* origin than the one serving it.
  trustedOrigins: (request) => {
    const configured = (process.env.TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // `request` is undefined during init / direct auth.api calls
    const host =
      request?.headers.get("x-forwarded-host") ?? request?.headers.get("host");
    if (host) {
      const proto =
        request?.headers.get("x-forwarded-proto") ??
        (process.env.USE_SECURE_COOKIES === "true" ? "https" : "http");
      const selfOrigin = `${proto}://${host}`;
      if (!configured.includes(selfOrigin)) configured.push(selfOrigin);
    }
    return configured;
  },
  advanced: {
    // Secure-only cookies break login on plain-HTTP LAN deployments (the
    // normal unraid setup). Opt in via USE_SECURE_COOKIES=true behind HTTPS.
    useSecureCookies: process.env.USE_SECURE_COOKIES === "true",
    ipAddress: {
      trustedProxies: resolveTrustedProxies(),
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
