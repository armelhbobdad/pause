# @pause/db

**Drizzle ORM schema and Neon PostgreSQL client for the Pause application.**

## Overview

This package defines the database schema, manages migrations, and exports a configured Drizzle ORM client connected to [Neon](https://neon.tech/) serverless PostgreSQL.

## Schema

### Enums

| Enum | Values |
|------|--------|
| `interactionTierEnum` | `analyst`, `negotiator`, `therapist` |
| `interactionStatusEnum` | `pending`, `completed`, `feedback_received`, `learning_complete` |
| `interactionOutcomeEnum` | `accepted`, `overridden`, `abandoned`, `timeout`, `auto_approved`, `break_glass`, `wait`, `wizard_bookmark`, `wizard_abandoned` |
| `cardStatusEnum` | `active`, `locked`, `removed` |
| `ghostCardStatusEnum` | `pending`, `viewed`, `feedback_given` |
| `satisfactionFeedbackEnum` | `worth_it`, `regret_it`, `not_sure` |

### Tables

| Table | Purpose |
|-------|---------|
| `user` | User accounts (id, name, email, image) |
| `session` | Auth sessions with token + expiry |
| `account` | OAuth/credential provider accounts |
| `verification` | Email verification tokens |
| `skillbook` | ACE Skillbook per user (JSONB skills + version) |
| `card` | Payment cards with lock/unlock status |
| `interaction` | Guardian interactions (risk score, tier, outcome, reasoning) |
| `savings` | Coupons/savings attached to interactions |
| `ghostCard` | "Ghost of Spending Past" delayed feedback entries |

## Usage

```typescript
// Database client
import { db } from "@pause/db";

// Schema types and tables
import { interaction, card, skillbook } from "@pause/db/schema";

// Query example
import { eq } from "drizzle-orm";

const results = await db
  .select()
  .from(interaction)
  .where(eq(interaction.userId, userId));
```

## Subpath Exports

| Import | Content |
|--------|---------|
| `@pause/db` | Drizzle client (`db`) + re-exported `schema` |
| `@pause/db/schema` | All table definitions and enums |

## Migration Workflow

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema directly (dev only, no migration file)
bun run db:push

# Open Drizzle Studio
bun run db:studio
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon pooled connection string |
| `DATABASE_URL_LOCAL` | No | Overrides DATABASE_URL for local dev |

The resolved URL is computed by `@pause/env/server` as `DATABASE_URL_LOCAL ?? DATABASE_URL`.
