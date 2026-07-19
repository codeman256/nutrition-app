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
  // Self-hosted: the app can be reached via LAN IP, hostname, or a reverse
  // proxy domain. Trust whatever origin the deployment declares.
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  advanced: {
    // Secure-only cookies break login on plain-HTTP LAN deployments (the
    // normal unraid setup). Opt in via USE_SECURE_COOKIES=true behind HTTPS.
    useSecureCookies: process.env.USE_SECURE_COOKIES === "true",
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
