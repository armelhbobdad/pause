import { neon, neonConfig } from "@neondatabase/serverless";
import { databaseUrl } from "@pause/env/server";
import { drizzle } from "drizzle-orm/neon-http";
import ws from "ws";

// biome-ignore lint/performance/noNamespaceImport: Drizzle ORM requires the full schema object
// biome-ignore lint/style/noExportedImports: schema is used locally for drizzle() and re-exported for API package
import * as schema from "./schema";

// Configure for Node.js WebSocket support
neonConfig.webSocketConstructor = ws;

// Detect Neon Local proxy (localhost connection)
const isLocalProxy = databaseUrl.includes("localhost");

if (isLocalProxy) {
  // Neon Local proxy requires HTTP mode with specific endpoint
  // See: https://github.com/neondatabase/neon_local
  neonConfig.fetchEndpoint = (host) => {
    const protocol = host === "localhost" ? "http" : "https";
    const port = host === "localhost" ? 5432 : 443;
    return `${protocol}://${host}:${port}/sql`;
  };
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineConnect = false;
}

// databaseUrl respects DATABASE_URL_LOCAL > DATABASE_URL precedence
// This enables transparent switching between Neon Local proxy and direct cloud connection
const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });

export { schema };
