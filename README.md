# Lanta Pilates App

Tablet-first Next.js web app styled to match [lantapilates.com](http://lantapilates.com/). Built for future wrapping as Android/iOS via Capacitor or similar.

**Stack:** Next.js 16, React 19, Tailwind CSS 4, Supabase, Capacitor.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on a tablet or desktop.

## Flow

1. **Home (`/`)** — Profile form (full name, age, height in cm, weight in kg) shown on every fresh app load / new tab.
2. **Session (`/session`)** — Body areas: **Need** (green) and **Avoid** (red), mutually exclusive per area.
3. **Next (`/next`)** — Placeholder third screen after body area Continue.

Profile and selections are kept in `sessionStorage` for the current tab only.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint

## Mobile apps later

This project includes a web app manifest and tablet viewport settings. To ship native apps, add [Capacitor](https://capacitorjs.com/) and point it at the built `out` folder or hosted URL.
