# @pause/auth

**Better Auth configuration for the Pause application.**

## Overview

This package configures [Better Auth](https://www.better-auth.com/) with Drizzle ORM as the database adapter, providing email/password authentication and session management.

## Usage

```typescript
import { auth } from "@pause/auth";
```

The `auth` instance is pre-configured with:

- **Database adapter** — Drizzle ORM (PostgreSQL via `@pause/db`)
- **Email/password** — Enabled by default
- **CORS** — Origin resolved from `@pause/env/server` (`CORS_ORIGIN` or `VERCEL_URL` fallback)
- **Next.js cookies** — Plugin for server-side session access

## How It Works in the App

The web app uses `@pause/auth` in two places:

1. **API route** (`apps/web/src/app/api/auth/[...all]/route.ts`) — Handles auth endpoints (sign-in, sign-up, session)
2. **Server components / route handlers** — `auth.api.getSession()` retrieves the current session from request headers

## Subpath Exports

| Import | Content |
|--------|---------|
| `@pause/auth` | Configured `auth` instance |
| `@pause/auth/*` | Direct access to source files (e.g., `@pause/auth/client`) |

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `BETTER_AUTH_SECRET` | Yes | Session encryption secret (32+ characters) |
| `BETTER_AUTH_URL` | Yes | Base callback URL (`http://localhost:3001` in dev) |
| `CORS_ORIGIN` | No | Custom CORS origin (falls back to `VERCEL_URL`) |

## Dependencies

- `@pause/db` — Database client and schema
- `@pause/env` — Environment variable validation
- `better-auth` — Authentication framework
