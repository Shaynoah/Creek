# Creek Fresh

A modern React-based water sale management system with beautiful water-themed animations and styling.

## Features

- **User Login**: Simple name-based login (no password required)
- **Admin Login**: Secure username and password authentication
- **Water-themed UI**: Beautiful animations and water-inspired design
- **Responsive Design**: Works on all device sizes

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will start on `http://localhost:5173`

### Build

```bash
npm run build
```

## Supabase Setup

This app now supports Supabase persistence with localStorage fallback.

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Create a `.env` file in the project root with:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4. Restart the dev server.

If env vars are missing, the app continues using localStorage only.

## Tech Stack

- React 18
- Vite
- CSS3 with animations
- Supabase (Postgres + JS client)