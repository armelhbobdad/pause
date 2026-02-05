# pause

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Self, TRPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **tRPC** - End-to-end type-safe APIs
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses Neon serverless PostgreSQL with Drizzle ORM.

### Quick Start (Local Development)

1. **Get a Neon API key** from [console.neon.tech](https://console.neon.tech) → Account Settings → API Keys

2. **Create local environment file:**
   ```bash
   cp .env.local.example apps/web/.env.local
   # Edit apps/web/.env.local and add your NEON_API_KEY
   ```

3. **Start the local database proxy:**
   ```bash
   bun run dev:db
   ```

4. **Verify connection:**
   ```bash
   bun run db:studio   # Opens Drizzle Studio
   ```

### Database Commands

| Command | Description |
|---------|-------------|
| `bun run dev:db` | Start Neon Local proxy (Docker) |
| `bun run dev:db:stop` | Stop the proxy |
| `bun run db:push` | Push schema changes |
| `bun run db:studio` | Open Drizzle Studio |


Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the fullstack application.

## Project Structure

```
pause/
├── apps/
│   └── web/         # Fullstack application (Next.js)
├── packages/
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run check-types`: Check TypeScript types across all apps
- `bun run dev:db`: Start Neon Local database proxy
- `bun run dev:db:stop`: Stop Neon Local proxy
- `bun run dev:db:logs`: View proxy container logs
- `bun run db:push`: Push schema changes to database
- `bun run db:studio`: Open database studio UI
