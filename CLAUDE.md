# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**Sightline** — a SaaS app for contractors at $30/month. Tagline: "Every job. One view."
Domain: sightline.one. Built by a 20-year-old carpenter with deep construction knowledge and no coding experience. Claude is the co-builder.

## Tech Stack

| Tool | Purpose |
|------|---------|
| Next.js | Web app framework |
| Supabase | Database + photo storage + auth |
| Vercel | Hosting |
| Claude API | Photo sorting, OCR, material estimates |
| Stripe | Payments |
| Resend | Email notifications |

## Commands

Once the Next.js project is scaffolded, standard commands will be:

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # Lint
```

## Architecture

**Jobs are the central data model.** Everything attaches to a Job:
- Job name, types (multi-select — a job can have multiple types e.g. Roofing + Electrical + Tile simultaneously), address, timeline, crew
- Photos categorized: Before / During / After / Receipts / Damages
- Materials list (estimated vs. actual used)
- Quotes sent and e-signed
- Receipts (OCR-extracted dollar amounts)
- Notes

## Year 1 Feature Roadmap

1. **Foundation (Months 1-2):** Job creation, photo upload, receipt folders
2. **Estimation Engine (Months 3-5):** Material calculator with AI cost estimation — the killer feature
3. **Quote Generator (Months 6-7):** Professional PDF quotes with client e-signature
4. **Beta Testing (Months 8-9):** 3-5 local contractors, free, brutal feedback
5. **Monetize (Months 10-12):** First paying customers

## AI Learning Loop

As jobs complete, actual vs. estimated material usage is logged. Over time, the model learns that specific contractor's market, crew speed, and supplier pricing — this is the competitive moat.

## Design Constraints

- Every action 3 taps or less
- All buttons minimum 48px tall — usable with work gloves
- High contrast, readable in direct sunlight
- Loads fast, never loses data
- Zero decorative elements
- All interactions must work on mobile tap — no hover-only states or functions

## Job Types

Job types are multi-select checkboxes, not a single dropdown. A job can have multiple types simultaneously (e.g. Roofing + Electrical + Tile). Available types: Drywall, Framing, Plumbing, Paint, Trim, Roofing, Tile, Flooring, Electrical, HVAC, Concrete, Landscaping. Store as a text array in Supabase (`text[]` column). Never use a single-select dropdown for job type.

## Collaboration Style

The user knows construction deeply but not code. Explain things in plain English, assume learning as we go. Prioritize a working product over perfection. Keep responses practical and direct.
