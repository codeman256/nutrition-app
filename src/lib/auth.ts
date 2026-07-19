import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db";

export const auth = betterAuth({
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
