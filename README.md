# BLOM Cosmetics — Admin Dashboard

Internal back-office for the BLOM Cosmetics store: order fulfilment, product and bundle management, stock control, promotions, course bookings, customer messages and sales analytics. It works against the same Supabase database as the customer-facing storefront.

> Live production system used by store staff. The customer-facing storefront is a separate repository (`blom-cosmetics-main`).

---

## Overview

Store staff use this dashboard to run day-to-day operations for a South African professional nail-products brand: processing and dispatching orders, maintaining the catalogue, adjusting stock, running promotions, and managing course bookings sold through the storefront.

## The problem

- Staff need one place to see paid orders and move them through fulfilment to collection or delivery, with the customer notified as the status changes.
- Catalogue changes (products, variants, bundles, images, prices) must reach the live storefront without direct database edits.
- Stock must stay correct as orders are fulfilled and adjustments are made, with an audit trail of movements.
- The business needs reporting on sales, top products and revenue without exporting data by hand.

## The solution

A role-gated React dashboard backed by Netlify Functions that perform privileged database operations server-side, plus n8n webhooks that send customer notifications when an order's status changes.

## Key features

- **Orders** — order list with status and payment filters, order detail, status updates that trigger customer notifications, delivery and collection handling
- **Catalogue** — create and edit products, variants and bundles; Cloudinary image uploads; featured products; bulk archive, activate and delete
- **Stock** — stock levels, manual adjustments and a stock-movement history
- **Promotions** — coupons and time-bound specials
- **Courses** — course management and course-booking records
- **Customers** — contacts, contact-form messages and product-review moderation
- **Reporting** — sales analytics, top-selling products and finance summaries (Recharts)
- **Shipping** — shipping configuration and delivery status workflows

## Tech stack

| Area | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, TanStack Query |
| UI | Tailwind CSS, Radix UI primitives (shadcn/ui pattern), Lucide icons, Recharts |
| Backend | Netlify Functions (JavaScript and TypeScript) |
| Database and auth | Supabase (PostgreSQL, Auth, Storage) |
| Media | Cloudinary |
| Documents | pdf-lib |
| Automation | n8n webhooks |
| Container (optional) | Dockerfile producing an nginx image of the static build |

## Architecture

```
Staff browser (React SPA)
  │  Supabase Auth sign-in; access limited to users with an owner or staff role
  │  src/guards/block-supabase-rest.ts blocks direct client-side writes to Supabase
  │
  ├──► Netlify Functions (netlify/functions/)
  │       orders, products, bundles, stock, coupons, analytics, reviews, contacts
  │       run with the Supabase service-role key, server-side only
  │
  ├──► Supabase — shared database with the storefront (db/ holds SQL and migrations)
  │
  └──► n8n — order-status, delivery, review and contact notifications
```

```
src/
├── pages/          one component per dashboard screen
├── components/     feature components and ui/ primitives
├── lib/            auth context, Supabase client, helpers
├── api/  services/  hooks/  contexts/  guards/  entities/
netlify/functions/  server-side admin API
db/                 SQL scripts and migrations
scripts/            maintenance and diagnostic scripts (require env vars; never hardcode keys)
vite-plugins/       development-only Vite plugins
docs/archive/       historical working notes and one-off SQL
```

## Screenshots

Screenshots are not yet included. Capture these from a **staging or demo dataset only** — this dashboard displays customer names, addresses and order details. Save them to `docs/screenshots/`:

| File | What to capture |
|---|---|
| `dashboard.png` | Dashboard home with summary figures |
| `orders.png` | Order list with filters |
| `order-detail.png` | Order detail with the status workflow |
| `product-edit.png` | Product editor with variants and images |
| `analytics.png` | Sales analytics charts |

## Running locally

**Requirements:** Node.js 20+, npm, and the [Netlify CLI](https://docs.netlify.com/cli/get-started/) to run the functions.

```bash
npm install
cp .env.example .env     # fill in the values you need
npm run dev              # frontend only, http://localhost:5173
netlify dev              # frontend + functions, http://localhost:8888
```

Signing in requires a Supabase user with the `owner` or `staff` role. If the Supabase adapter fails to initialise, the app falls back to an in-memory mock adapter (`src/components/data/mockAdapter.jsx`).

## Quality checks

| Command | Purpose |
|---|---|
| `npm run build` | Production build |
| `npm run lint` | ESLint (React, hooks, and Node rules for functions and scripts) |

There is no automated test suite in this repository yet.

## Deployment

Deployed to Netlify (`netlify.toml`): `npm run build` publishes `dist/`, and `netlify/functions/` is deployed as serverless functions. Legacy URLs are 301-redirected to their current routes, and all other paths fall back to the SPA. A Dockerfile is also provided for serving the static build from nginx.

## What I built

I built and maintain this dashboard for the client alongside the storefront. The work here includes the order-fulfilment workflow and its notification hooks, the product, variant and bundle editors, stock-movement tracking, the analytics views, and the server-side functions that perform privileged operations against the shared Supabase database.

The project began from a generated Base44 starter template and was developed into the current application. AI coding assistants were used as development tools; integration, debugging against live services and responsibility for the production system are mine.
