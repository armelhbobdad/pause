# @pause/api

**Type-safe tRPC router and procedures for the Pause application.**

## Overview

This package initializes [tRPC](https://trpc.io/) with typed context and exports router factories and procedure builders used by the web app's API routes.

## Usage

```typescript
import { router, publicProcedure, protectedProcedure } from "@pause/api";

const appRouter = router({
  // Unauthenticated
  health: publicProcedure.query(() => ({ ok: true })),

  // Requires session — throws UNAUTHORIZED if missing
  profile: protectedProcedure.query(({ ctx }) => {
    return ctx.session.user;
  }),
});
```

## Exports

| Export | Description |
|--------|-------------|
| `t` | Initialized tRPC instance with `Context` |
| `router` | Router factory (`t.router`) |
| `publicProcedure` | Unauthenticated procedure |
| `protectedProcedure` | Authenticated procedure — validates session, throws `UNAUTHORIZED` if absent |

## Dependencies

- `@pause/auth` — Session validation
- `@pause/db` — Database access
- `@pause/env` — Environment configuration
- `@trpc/server` — tRPC core
