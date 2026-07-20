import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
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

export const auth = betterAuth({
  secret: resolveAuthSecret(),
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
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
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
