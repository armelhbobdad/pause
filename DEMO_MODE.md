# Demo Mode Guide for Judges

> Step-by-step instructions for replicating every feature in Pause.

## Table of Contents

- [1. Enable Demo Mode](#1-enable-demo-mode)
- [2. Seed the Database](#2-seed-the-database)
- [3. Start the App](#3-start-the-app)
- [4. Create an Account & Sign In](#4-create-an-account--sign-in)
- [5. Floating AI Chat (Try This First!)](#5-floating-ai-chat-try-this-first)
- [6. The Three AI Tiers](#6-the-three-ai-tiers)
- [7. Walkthrough: Analyst (Auto-Approve)](#7-walkthrough-analyst-auto-approve)
- [8. Walkthrough: Negotiator (Coupon Search)](#8-walkthrough-negotiator-coupon-search)
- [9. Walkthrough: Therapist (Reflection)](#9-walkthrough-therapist-reflection)
- [10. Dashboard & History](#10-dashboard--history)
- [11. Ghost Cards](#11-ghost-cards)
- [12. Opik Observability Traces](#12-opik-observability-traces)
- [13. What Demo Mode Changes](#13-what-demo-mode-changes)
- [Appendix: Example Prompts by Tier](#appendix-example-prompts-by-tier)

---

## 1. Enable Demo Mode

In `apps/web/.env`, set:

```env
DEMO_MODE=true
```

This activates:
- **"DEMO" badge** — small pill in the bottom-left corner of every page
- **Deterministic AI** — `temperature: 0` and `seed: 42` for reproducible outputs
- **Mock coupon provider** — returns realistic coupons without a real API
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

Open `http://localhost:3001`. You should see the **"DEMO"** badge in the bottom-left corner.

## 4. Create an Account & Sign In

1. Click **"See Pause in Action"** on the landing page (or navigate to `/login`)
2. If using seed data, sign in with:
   - Email: `alex@demo.pause.app`
   - Password: *(set during account creation — seeds don't set a password, so create an account first, then re-seed)*

**Recommended flow for judges:**
1. **Deployed app:** Create an account at `/login` — the Pro seed data (Alex + history) is already in the database
2. **Local:** Create a fresh account, then run `db:seed:rookie` or `db:seed:pro` to populate demo data
3. Or simply use the app as-is — every new user starts with an empty Skillbook

## 5. Floating AI Chat (Try This First!)

The floating chat bubble in the **bottom-right corner** is the fastest way to experience Pause's AI — no sign-in required.

### What It Is

A knowledge-base AI assistant powered by **Gemini 2.5 Flash** that answers questions about Pause, spending habits, and mindful purchasing. It runs on a separate `/api/ai/knowledge` endpoint with its own system prompt and guardrails.

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

## 6. The Three AI Tiers

Pause routes every purchase through a **risk assessment engine** that scores 0-100. The score determines which AI tier responds:

```
Score  0-29  →  Analyst (auto-approve, no friction)
Score 30-69  →  Negotiator (searches coupons, finds savings)
Score 70-100 →  Therapist (reflection prompts, wait option)
```

Risk factors include: purchase amount, category, time of day, user history, and spending patterns.

## 7. Walkthrough: Analyst (Auto-Approve)

**What it does:** Low-risk purchases are approved instantly with no friction.

**How to trigger it:**
1. On the home page (after sign-in), you'll see the **Card Vault** with your card
2. Click the card to **request an unlock**
3. The Guardian pulse animation plays while AI processes
4. Type a low-risk purchase like:

> Coffee subscription - $12/month

5. The Analyst tier auto-approves — the card unlocks immediately
6. A brief explanation of the auto-approval reasoning appears

**What to observe:**
- The card transitions from locked to unlocked state
- No coupons or reflection prompts — just a quick approval
- The interaction is recorded in your dashboard history

## 8. Walkthrough: Negotiator (Coupon Search)

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

## 9. Walkthrough: Therapist (Reflection)

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

## 10. Dashboard & History

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

## 11. Ghost Cards

**Ghost of Spending Past** resurfaces past purchases for reflection.

**How to see them:**
- With **Pro seed**, there's 1 pending ghost card (from a "Wireless headphones - $89" purchase 3 days ago)
- Ghost cards appear in the dashboard's ghost card feed
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

## 12. Opik Observability Traces

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

## 13. What Demo Mode Changes

| Feature | DEMO_MODE=false | DEMO_MODE=true |
|---------|----------------|----------------|
| AI Temperature | Model default | `temperature: 0` (deterministic) |
| AI Seed | None | `seed: 42` (reproducible) |
| Coupon Provider | Real API (returns empty) | Mock coupons with realistic data |
| UI Badge | Hidden | "DEMO" pill in bottom-left corner |
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

# Seed fresh user
bun run db:seed:rookie

# Seed experienced user
bun run db:seed:pro

# Start app
bun dev

# Run tests (1309 tests, all passing)
bun test
```
