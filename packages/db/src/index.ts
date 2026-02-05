import { neon, neonConfig } from "@neondatabase/serverless";
import { databaseUrl } from "@pause/env/server";
import { drizzle } from "drizzle-orm/neon-http";
import ws from "ws";

// biome-ignore lint/performance/noNamespaceImport: Drizzle ORM requires the full schema object
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

// To work in edge environments (Cloudflare Workers, Vercel Edge, etc.), enable querying over fetch
// neonConfig.poolQueryViaFetch = true

// databaseUrl respects DATABASE_URL_LOCAL > DATABASE_URL precedence
// This enables transparent switching between Neon Local proxy and direct cloud connection
const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });
