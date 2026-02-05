import { db } from "@pause/db";
// biome-ignore lint/performance/noNamespaceImport: Drizzle adapter requires the full schema object
import * as schema from "@pause/db/schema/auth";
import { corsOrigin } from "@pause/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",

    schema,
  }),
  trustedOrigins: [corsOrigin],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
});
