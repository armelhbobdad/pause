# Demo Mode Guide for Judges

> Step-by-step instructions for replicating every feature in Pause.

> **IMPORTANT — AI Provider Rate Limits:**
> Pause uses a **configurable AI provider** (`AI_MODEL` env var) for all AI features (Guardian, Knowledge Chat, ACE Learning). The default deployment uses **Zhipu GLM-4.7-Flash** (free tier), but **Google Gemini 2.5 Flash** is also supported. Each provider has its own rate limits. Each Guardian interaction triggers multiple API calls (risk assessment + streaming response + Skillbook learning), so you can realistically trigger only **~5 full Guardian flows per minute** before hitting quotas.
>
> **If the Guardian shows "Guardian unavailable" with a Manual Unlock fallback**, wait ~45 seconds and try again — the quota resets on a rolling window. The deployed app on Vercel shares the same API key across all users, so concurrent judges will deplete the quota faster.
>
> **Tip:** Space your Guardian interactions ~15-20 seconds apart for the most reliable experience. The Floating AI Chat and Dashboard features (profile switching, guided tour, history, ghost cards) do **not** count against this limit and work without any rate restrictions.

## Table of Contents

- [1. Enable Demo Mode](#1-enable-demo-mode)
- [2. Seed the Database](#2-seed-the-database)
- [3. Start the App](#3-start-the-app)
- [4. Create an Account & Sign In](#4-create-an-account--sign-in)
- [5. Floating Demo Panel](#5-floating-demo-panel)
- [6. Guided Tour](#6-guided-tour)
- [7. Floating AI Chat (Try This First!)](#7-floating-ai-chat-try-this-first)
- [8. The Three AI Tiers](#8-the-three-ai-tiers)
- [9. Walkthrough: Analyst (Auto-Approve)](#9-walkthrough-analyst-auto-approve)
- [10. Walkthrough: Negotiator (Coupon Search)](#10-walkthrough-negotiator-coupon-search)
- [11. Walkthrough: Therapist (Reflection)](#11-walkthrough-therapist-reflection)
- [12. Dashboard & History](#12-dashboard--history)
- [13. Ghost Cards](#13-ghost-cards)
- [14. Opik Observability Traces](#14-opik-observability-traces)
- [15. What Demo Mode Changes](#15-what-demo-mode-changes)
- [Appendix: Example Prompts by Tier](#appendix-example-prompts-by-tier)

---

## 1. Enable Demo Mode

In `apps/web/.env`, set:

```env
DEMO_MODE=true
NEXT_PUBLIC_DEMO_MODE=true
```

This activates:
- **Floating Demo Panel** — interactive pill in the bottom-left corner with profile switching, guided tour
- **Deterministic AI** — `temperature: 0` and `seed: 42` for reproducible outputs
- **Mock coupon provider** — returns realistic coupons without a real API
- **Shorter auto-relock timer** — card auto-locks after **15 seconds** instead of 5 minutes
- **Seed script safety gate** — allows running `db:seed:rookie` and `db:seed:pro`

## 2. Seed the Database

> **Deployed app (Vercel):** All database branches are **pre-seeded with Pro data** — you can skip this section and go straight to [Step 3](#3-start-the-app). The demo user Alex is already set up with full history, savings, and a trained Skillbook.

For **local development**, two seed profiles are available. Each creates a demo user **Alex** with card ending in **4242**.

### Option A: Rookie (Fresh User)

```bash
bun run db:seed:rookie
```

Creates:

| Entity | Details |
|--------|---------|
| User | Alex (`alex@demo.pause.app`) |
| Card | **** 4242, active |
| Skillbook | Empty (version 1) |
| History | None |

Use this to demonstrate the **first-time user experience** — the AI has no learned patterns yet.

### Option B: Pro (Experienced User)

```bash
bun run db:seed:pro
```

Creates:

| Entity | Details |
|--------|---------|
| User | Alex (`alex@demo.pause.app`, 30 days old) |
| Card | **** 4242, active, with unlock history |
| Interactions | 6 past interactions (2 analyst, 2 negotiator, 2 therapist) |
| Skillbook | 4 learned strategies (version 5) |
| Savings | $53 across 3 records |
| Ghost Card | 1 pending feedback card |

Use this to demonstrate **learning, dashboard data, ghost cards, and a trained AI**.

### Re-seeding

Running either seed command automatically **cleans existing demo data first** — it's safe to run multiple times.

## 3. Start the App

```bash
bun dev
```

Open `http://localhost:3001`. You should see the **"DEMO"** pill in the bottom-left corner on every page. The pill is **disabled** (muted, non-interactive) until you sign in and reach the dashboard.

## 4. Create an Account & Sign In

1. Click **"See Pause in Action"** on the landing page (or navigate to `/login`)
2. Click **"Try Demo as Alex"** to sign in with the pre-seeded demo account
3. You'll be redirected to the dashboard

**Recommended flow for judges:**
1. **Deployed app:** Click "Try Demo as Alex" — the Pro seed data (Alex + history) is already in the database
2. **Local:** Click "Try Demo as Alex" after running `db:seed:rookie` or `db:seed:pro`
3. Or create a fresh account — every new user starts with an empty Skillbook

## 5. Floating Demo Panel

The **DEMO** pill in the bottom-left corner is visible on every page as a branding indicator. It becomes an **interactive control panel** only on the dashboard, where a signed-in user can switch profiles and start the guided tour.

### Visibility vs. Interactivity

| Page | Pill Visible | Interactive | Why |
|------|:----------:|:-----------:|-----|
| Home (`/`) | Yes | No (disabled, muted) | No user signed in — nothing to switch |
| Login (`/login`) | Yes | No (disabled, muted) | No user signed in — nothing to switch |
| Dashboard (`/dashboard`) | Yes | **Yes** (full menu) | Signed in — profile switching + guided tour available |

On non-dashboard pages the pill appears at 60% opacity with desaturated colors, no hover effects, and no animations (pulse/shimmer). On the dashboard it's fully vibrant and clickable.

### What the Menu Shows (Dashboard)

Click the pill on the dashboard to reveal a glassmorphic menu:

| Menu Items | Details |
|-----------|---------|
| *Opposite* profile only | Already signed in — only show what you can switch to |
| Start Guided Tour | 6-step walkthrough of dashboard features |

### Profile Switching (Dashboard Only)

When signed in on the dashboard, click a profile to **instantly switch** between Rookie and Pro:

1. Click the **DEMO** pill
2. Click **"Rookie Profile"** or **"Pro Profile"**
3. A loading spinner appears while data is re-seeded
4. The dashboard reloads with the new profile data — **you stay signed in** (no re-login needed)
5. The menu now shows only the opposite profile

**What changes:**

| | Rookie | Pro |
|--|--------|-----|
| Savings | $0.00 | $53.00 |
| Interactions | 0 | 6 |
| Skillbook | Empty | 4 strategies |
| Ghost Cards | None | 1 pending |
| Good Friction Score | 0% | 83% |

### Animations (Dashboard Only)

- **Entrance pulse** — a 3-second glow animation on first dashboard load draws attention to the pill
- **Shimmer sweep** — a subtle light sweep loops across the pill surface
- **Spring menu** — the menu card appears with a spring animation and staggered item reveal
- All animations respect `prefers-reduced-motion`
- On non-dashboard pages, animations are suppressed — the pill is a static, muted badge

### Interactions

- **Click outside** closes the menu
- **Escape key** closes the menu
- **Loading state** disables all menu items during a profile switch

## 6. Guided Tour

A 6-step product tour walks judges through every key feature on the dashboard. Powered by [OnboardJS](https://github.com/AshrafElshaer/onboard-js) (headless, zero dependencies).

### How to Start

1. Sign in and navigate to the **Dashboard**
2. Click the **DEMO** pill
3. Click **"Start Guided Tour"** (only visible on the dashboard)

### Tour Steps

| Step | Feature | What It Highlights |
|------|---------|-------------------|
| 1 | Demo Panel | "Switch between profiles or start the tour from here" |
| 2 | Card Vault | "Click a card to request an unlock and trigger the AI Guardian" |
| 3 | AI Chat | "Ask questions about Pause — uses the ACE self-learning framework" |
| 4 | Interaction History | "Every Guardian decision with risk scores and outcomes" |
| 5 | Savings Tracker | "Total savings from coupons found by the Negotiator tier" |
| 6 | Ghost Cards | "Past purchases resurface for reflection — feedback trains the AI" |

### Tour Controls

- **Next / Previous** — navigate between steps
- **Close (X)** — exit the tour at any point
- **Finish** — appears on the last step to complete the tour
- **Progress dots** — visual indicator showing current position
- **Spotlight overlay** — highlights the target element with a radial gradient cutout
- Each step **auto-scrolls** the target element into view

### Design

The tour card uses a glassmorphic design matching Pause's aesthetic:
- `oklch` color space throughout
- Backdrop blur with translucent background
- Spring animations on card transitions
- Spotlight overlay dims the rest of the page

---

## 7. Floating AI Chat (Try This First!)

The floating chat bubble in the **bottom-right corner** is the fastest way to experience Pause's AI — no sign-in required.

### What It Is

A knowledge-base AI assistant powered by the **configured AI model** that answers questions about Pause, spending habits, and mindful purchasing. It runs on a separate `/api/ai/knowledge` endpoint with its own system prompt and guardrails.

### How to Use It

1. Click the **chat bubble** icon in the bottom-right corner (visible on every page)
2. Type any question and press Enter
3. Watch the AI stream a response in real-time

### Example Questions to Ask

**About Pause (product knowledge):**
```
How does Pause decide if a purchase is risky?
What are the three AI tiers?
How does the learning system work?
What happens when I choose to wait 24 hours?
```

**About spending habits (behavioral finance):**
```
Why do people make impulse purchases?
What is the 30-day rule for spending?
How can I tell the difference between a need and a want?
What's the average amount people spend on impulse buys?
```

**Guardrails in action (try these to see boundaries):**
```
Should I invest in Bitcoin?
Can you help me plan my retirement savings?
I want to buy a $500 jacket, should I?
```

The AI will politely **decline financial advice** and **redirect purchase evaluations** to the Guardian flow (Card Vault). This demonstrates responsible AI guardrails.

### Smart Availability

The chat is context-aware:

| Context | Chat Available | Why |
|---------|---------------|-----|
| Landing page (no auth) | Yes | Discovery tool for new visitors |
| Signed in, idle | Yes | Primary AI access point |
| Guardian session active | No (auto-closes) | Guardian demands full focus |
| After Guardian completes | Yes (draft restored) | Resumes where you left off |

**Demo tip:** Start typing a message in the chat, then trigger a Guardian session. The chat will auto-close and **save your draft**. After the Guardian session ends, reopen the chat — your message is restored.

### Why It's a Game Changer

- **Zero friction entry point** — judges can interact with AI immediately on the landing page
- **Demonstrates streaming** — real-time token-by-token response rendering
- **Shows guardrails** — responsible AI boundaries in action
- **Guardian-aware** — intelligent suppression during critical purchase moments
- **Accessible** — full keyboard navigation (Tab trap, Escape to close), reduced-motion support

---

## 8. The Three AI Tiers

Pause routes every purchase through a **risk assessment engine** that scores 0-100. The score determines which AI tier responds:

```
Score  0-29  →  Analyst (auto-approve, no friction)
Score 30-69  →  Negotiator (searches coupons, finds savings)
Score 70-100 →  Therapist (reflection prompts, wait option)
```

Risk factors include: purchase amount, category, time of day, user history, and spending patterns.

## 9. Walkthrough: Analyst (Auto-Approve)

**What it does:** Low-risk purchases are approved instantly with no friction.

**How to trigger it:**
1. On the home page (after sign-in), you'll see the **Card Vault** with your card
2. Click the card to **request an unlock**
3. The Guardian pulse animation plays while AI processes
4. Type a low-risk purchase like:

> Coffee subscription - $12/month

5. The Analyst tier auto-approves — the card unlocks immediately
6. A brief explanation of the auto-approval reasoning appears
7. The card **auto-relocks after 15 seconds** (vs. 5 minutes in production) — watch the countdown timer on the card

**What to observe:**
- The card transitions from locked to unlocked state
- A **15-second countdown timer** appears on the unlocked card (shortened for demo)
- No coupons or reflection prompts — just a quick approval
- The interaction is recorded in your dashboard history

## 10. Walkthrough: Negotiator (Coupon Search)

**What it does:** Medium-risk purchases trigger a coupon search. The AI finds deals before you unlock.

**How to trigger it:**
1. Request a card unlock
2. Type a medium-risk purchase like:

> Bluetooth speaker - $79

3. The Negotiator tier activates
4. Watch the **streaming tool call** — you'll see the AI invoke `search_coupons` in real-time
5. Mock coupons appear (in DEMO mode):

| Category | Example Coupons |
|----------|----------------|
| Electronics | TECH20 (20% off), ELEC10 ($10 off), PRICEMATCH ($15 off) |
| Fashion | STYLE15 (15% off), TREND5 ($5 off) |
| Other | SAVE10 ($10 off) |
| Grocery | None (auto-approve path) |

6. The AI presents the **best offer** as a Savings Ticket
7. You can choose to:
   - **Apply the deal** — card unlocks with savings recorded
   - **Skip savings** — card unlocks without the coupon
   - **Override** — dismiss the Guardian entirely

**What to observe:**
- Live tool-call streaming in the chat UI
- Savings Ticket component with coupon code and discount amount
- Savings counter updates on the dashboard

## 11. Walkthrough: Therapist (Reflection)

**What it does:** High-risk purchases trigger therapeutic reflection techniques. The AI helps you pause and think.

**How to trigger it:**
1. Request a card unlock
2. Type a high-risk purchase like:

> Designer shoes - $250

3. The Therapist tier activates
4. The AI presents a **reflection prompt** — this could be:
   - Future-self visualization ("How will you feel about this in 30 days?")
   - Cost reframe ("That's $0.68/day over a year")
   - Need vs. want analysis
   - Other evidence-based techniques
5. You can respond to the reflection or choose:
   - **Wait 24 hours** — defers the purchase, creates a Ghost Card reminder
   - **Unlock anyway** — overrides the Guardian
   - **Interactive Wizard** (for risk scores 85+) — guided step-by-step reflection

**What to observe:**
- Reflection prompts are tailored to the purchase context
- The "Wait" option always offers exactly 24 hours (per spec)
- If the Skillbook has learned strategies, they influence which technique the AI picks
- The banned-terminology filter ensures the AI never uses clinical/diagnostic language

## 12. Dashboard & History

Navigate to `/dashboard` to see:

- **Interaction History** — chronological list of all Guardian interactions with:
  - Purchase context
  - Tier used (analyst/negotiator/therapist)
  - Outcome (auto-approved, accepted, overridden, wait, abandoned)
  - Risk score
  - AI reasoning summary
- **Savings Counter** — total money saved through coupons and deferred purchases
- **Learning Visualization** — shows how the Skillbook has evolved (with Pro seed: 4 strategies, version 5)

**With Pro seed data**, you'll see 6 pre-populated interactions spanning all three tiers, $53 in savings, and a trained Skillbook.

## 13. Ghost Cards

**Ghost of Spending Past** resurfaces past purchases for reflection.

**How to see them:**
- With **Pro seed**, there's 1 pending ghost card (from a "Wireless headphones - $89" purchase 3 days ago)
- Ghost cards appear in the dashboard's **"Spending Reflections"** section
- Cards start **frosted** (blurred) by design — this is the "good friction" teaser, not a bug
- **Scroll down** to the card and it will automatically defrost with a smooth reveal animation
- Click to provide feedback: "Was it worth it?" (satisfied / regret / neutral)
- This feedback flows into the ACE learning pipeline, updating the Skillbook

**The learning loop:**
```
Purchase → Guardian Interaction → Outcome
    ↓
Days later → Ghost Card appears
    ↓
User feedback → ACE Reflector analyzes
    ↓
Skillbook updated → Better future responses
```

## 14. Opik Observability Traces

If `OPIK_API_KEY` is configured, every Guardian interaction generates full traces:

- **Trace hierarchy:** Root span → Risk Assessment → Tier Selection → LLM Streaming → Tool Calls
- **Metadata:** Interaction ID, risk score, tier, outcome, reasoning summary
- **Tags:** `["hackathon", "pause"]` on all traces
- **15 named trace types** covering all system operations

View traces at [comet.com/opik](https://www.comet.com/opik) under your project.

**What judges can observe in Opik:**
- Full reasoning chain for each purchase decision
- Token usage and latency metrics
- Strategy prediction logs (what the AI expected vs. what happened)
- Feedback scores attached to traces for quality assessment

## 15. What Demo Mode Changes

| Feature | DEMO_MODE=false | DEMO_MODE=true |
|---------|----------------|----------------|
| AI Temperature | Model default | `temperature: 0` (deterministic) |
| AI Seed | None | `seed: 42` (reproducible) |
| Coupon Provider | Real API (returns empty) | Mock coupons with realistic data |
| Auto-Relock Timer | 5 minutes (300s) | **15 seconds** (fast demo turnaround) |
| Demo Panel | Hidden | Floating "DEMO" pill on all pages; interactive (profile switching + guided tour) only on dashboard |
| Profile Switching | Unavailable | Switch between Rookie/Pro via `POST /api/demo/switch-profile` |
| Guided Tour | Unavailable | 6-step OnboardJS tour of dashboard features |
| Seed Scripts | Blocked (safety gate) | Allowed |

**Everything else works identically** — auth, database, Skillbook learning, Ghost Cards, dashboard, and Opik tracing all function the same in both modes.

---

## Appendix: Example Prompts by Tier

Use these prompts when interacting with the Guardian to trigger specific tiers:

### Low Risk (Analyst → Auto-Approve)
```
Coffee subscription - $12/month
Phone case - $15
Notebook and pens - $8
Grocery run - $45
```

### Medium Risk (Negotiator → Coupon Search)
```
Bluetooth speaker - $79
Gaming mouse - $65
Running shoes - $120
Backpack - $55
```

### High Risk (Therapist → Reflection)
```
Designer shoes - $250
New laptop - $1,200
Luxury watch - $500
Concert VIP tickets - $300
```

### Very High Risk (Therapist + Wizard, score 85+)
```
Designer handbag - $2,000
Latest iPhone Pro Max - $1,499
Spontaneous vacation booking - $3,500
```

> **Note:** Risk scores depend on multiple factors (amount, category, user history, time of day), so the same prompt may route differently for a Rookie vs. Pro user. The Pro user has history that influences scoring.

---

## Quick Reference

```bash
# Enable demo mode
echo "DEMO_MODE=true" >> apps/web/.env
echo "NEXT_PUBLIC_DEMO_MODE=true" >> apps/web/.env

# Seed fresh user
bun run db:seed:rookie

# Seed experienced user
bun run db:seed:pro

# Start app
bun dev

# Run tests (1334 tests, all passing)
bunx vitest run
```
