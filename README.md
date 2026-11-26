# PortaGov Frontend

The PortaGov citizen services platform: government services online for Liberia and Liberians abroad. Citizens apply from home, pay by mobile money, track every step, and collect at a county centre or a Liberian embassy.

Mantra: Citizens. Services. Connected.

## What is in here

One routed app in `src/portagov/App.tsx`, with:

- Public landing, ministries and their services, service guides with fees in USD and LRD, and a 154 currency fee converter
- Citizen portal: applications, document wallet, appointments, payments, receipts, family applications, complaints and appeals
- Institution portal: inbox and work list for released applications
- Platform portal: release queue with automatic or manual release, staff and help desk, feature toggles, institution onboarding
- Business and NGO portal, county agents, diaspora and embassy pickup
- Sign in with "I'm new here" first time profile and "I'm not new here" returning sign in, phone country pickers, county, district and community cascades for all 73 Liberian districts, 12 character passwords with uppercase, lowercase, number and symbol, review and exact signature match
- Floating assistant that answers from the real service catalogue and knowledge base, in Liberian English on request, and routes unanswered questions to the right desk as a ticket

## Tech stack

- Next.js 14, React 18, TypeScript, Tailwind CSS 3
- Data lives in the browser (localStorage, key `portagov-db-v1`), with an in memory copy when storage is unavailable. There is no server database on the free tier. Every citizen's data stays on their own device.
- The live API base is set by `NEXT_PUBLIC_API_URL` (currently the Render backend at `https://eliberia-backend.onrender.com`). The assistant, rewrite and ticket summary run locally from the service catalogue, never from a model.

## Getting started

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## Branding

PortaGov, navy `#0A2A5E`, gold `#D9A821`, white. The logo artwork in `src/portagov/assets.ts` is the exact chosen PortaGov badge. Do not redraw it.
