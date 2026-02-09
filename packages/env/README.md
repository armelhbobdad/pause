# @pause/env

**Zod-validated environment variable management with server/client separation.**

## Overview

This package uses [`@t3-oss/env-nextjs`](https://env.t3.gg/) to validate environment variables at build time and runtime, ensuring the app never starts with missing or malformed configuration.

## Subpath Exports

| Import | Content |
|--------|---------|
| `@pause/env/server` | Server-only variables + helper functions |
| `@pause/env/web` | Client-safe `NEXT_PUBLIC_*` variables |

## Server Variables (`@pause/env/server`)

```typescript
import { env } from "@pause/env/server";

env.DATABASE_URL;              // string (required)
env.BETTER_AUTH_SECRET;        // string, min 32 chars (required)
env.GOOGLE_GENERATIVE_AI_API_KEY; // string (required)
env.DEMO_MODE;                 // "true" | "false" (default: "false")
env.OPIK_API_KEY;              // string (optional in dev, required in prod)
```

**Helper exports:**

| Export | Description |
|--------|-------------|
| `databaseUrl` | Resolved: `DATABASE_URL_LOCAL ?? DATABASE_URL` |
| `corsOrigin` | Resolved: `CORS_ORIGIN ?? https://${VERCEL_URL}` (or `BETTER_AUTH_URL` fallback) |

### Full Server Variable List

| Variable | Validation | Default |
|----------|-----------|---------|
| `DATABASE_URL` | `z.string().min(1)` | — |
| `DATABASE_URL_DIRECT` | `z.string().optional()` | — |
| `DATABASE_URL_UNPOOLED` | `z.string().optional()` | — |
| `DATABASE_URL_LOCAL` | `z.string().optional()` | — |
| `NEON_API_KEY` | `z.string().optional()` | — |
| `BETTER_AUTH_SECRET` | `z.string().min(32)` | — |
| `BETTER_AUTH_URL` | `z.string().url()` | — |
| `CORS_ORIGIN` | `z.string().url().optional()` | — |
| `VERCEL_URL` | `z.string().optional()` | — |
| `VERCEL_ENV` | `z.enum(["production","preview","development"]).optional()` | — |
| `NODE_ENV` | `z.enum(["development","production","test"])` | `"development"` |
| `OPIK_API_KEY` | `z.string().optional()` | — |
| `OPIK_PROJECT_NAME` | `z.string().optional()` | `"pause"` |
| `OPIK_WORKSPACE` | `z.string().optional()` | — |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `z.string().min(1)` | — |
| `REFERRAL_THRESHOLD` | `z.coerce.number().int().min(1).optional()` | `3` |
| `DEMO_MODE` | `z.enum(["true","false"])` | `"false"` |

## Client Variables (`@pause/env/web`)

```typescript
import { env } from "@pause/env/web";

env.NEXT_PUBLIC_DEMO_MODE; // "true" | "false" (default: "false")
```

## Adding a New Variable

1. **Define the schema** in `packages/env/src/server.ts` (or `web.ts` for client vars)
2. **Add to `.env.example`** at `apps/web/.env.example`
3. **Register in `turbo.json`** under `build.env` so Turborepo includes it in cache keys
4. **Use it** via `import { env } from "@pause/env/server"`

## DEMO_MODE

When `DEMO_MODE=true`:
- Guardian AI returns deterministic responses
- Coupon search uses mock data with guaranteed results
- Seed scripts populate pre-built interaction history

The client-side equivalent `NEXT_PUBLIC_DEMO_MODE` controls the `DemoBadge` UI indicator.
