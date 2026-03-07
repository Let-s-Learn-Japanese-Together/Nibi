# Nibi – Discord bot using interaction endpoint (Hono + Wrangler)


[![npm version](https://img.shields.io/npm/v/nibi)](https://www.npmjs.com/package/nibi)
[![license](https://img.shields.io/github/license/Let-s-Learn-Japanese-Together/Nibi)](https://github.com/Let-s-Learn-Japanese-Together/Nibi/blob/main/LICENSE)


A lightweight example of a **Discord bot that doesn’t use a websocket**. All functionality is driven by slash commands received through a single HTTP endpoint. The server is written with **Hono**, and the example deployment target is a **Cloudflare Worker** via Wrangler, but any Hono‑compatible host (Vercel, Deno Deploy, etc.) will work.

Optionally, Supabase is used as a simple key/value store.

---

## 📑 Table of contents

1. [Key concepts](#-key-concepts)
2. [Project layout](#-project-layout)
3. [Installation](#-installation)
4. [Environment & secrets](#-environment--secrets)
5. [Supabase setup (optional)](#-supabase-setup-optional)
6. [Registering commands](#-registering-commands)
7. [Local development](#-local-development)
8. [Deployment](#-deployment)
9. [Handling interactions](#-handling-interactions)
10. [Periodic tasks via GitHub Actions](#-periodic-tasks-via-github-actions)
11. [Notes](#-notes)

---

## ⚙️ Key concepts

- **No persistent connection** – Discord posts interaction payloads to your endpoint on every command.
- **Hono framework** handles routing and signature verification in a small bundle.
- **Cloudflare Worker** is the reference deployment, but the code is portable to any serverless environment that supports Hono.
- **Supabase (optional)** provides a `kv` table for storage; the bot itself has no hard dependency on it.

---

## 📁 Project layout

```
Nibi/
├─ src/
│  ├─ index.ts            # entry point + interaction handler
│  ├─ register-commands.ts# CLI script to register slash commands
│  ├─ command-handlers.ts # mapping name → response function
│  ├─ commands/           # one file per slash command
│  ├─ daemons-gh/         # GitHub‑Actions scripts (periodic tasks)
│  └─ utils/              # helpers (Supabase, mail, Sheets, …)
├─ dist/                  # compiled output (ignored by VCS)
├─ package.json
├─ tsconfig.json
├─ wrangler.toml          # Worker configuration
├─ .env.example           # environment variable template
└─ README.md              # you are here
```

---

## 🛠 Installation

```bash
cd path/to/Nibi
npm install
```

Copy `.env.example` to `.env` or define the variables as Wrangler secrets.

Required environment variables:

```ini
PUBLIC_KEY=…           # Discord application public key (for signature verification)
BOT_TOKEN=…
APP_ID=…

# optional email configuration for `sendVerificationCode` command
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=username
EMAIL_PASSWORD=password
EMAIL_FROM="noreply@example.com"
EMAIL_TLS_INSECURE=false

# Supabase (only if you use it)
SUPABASE_URL=…
SUPABASE_ANON_KEY=…
```

> **Supabase note:** you must create a `public.kv` table and adjust row‑level security (RLS) so the anon key can write. See the next section for details.

### 🛡 Environment variables & secrets

For production, store sensitive values as Wrangler secrets:

```bash
wrangler secret put PUBLIC_KEY
wrangler secret put BOT_TOKEN
wrangler secret put APP_ID
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
```

Values in `[vars]` within `wrangler.toml` are visible in plaintext—avoid putting secrets there.

---

## 💾 Supabase setup (optional)

The helper functions in `src/utils/databaseUtils.ts` expect a table with the following schema:

```sql
create table if not exists public.kv (
  key text primary key,
  value jsonb
);
```

If RLS is enabled (the default), allow anonymous writes:

```sql
-- disable RLS
alter table public.kv disable row level security;

-- or grant anon key
alter table public.kv enable row level security;
create policy anon_rw on public.kv for all using (true);
```

Without this, writes fail with `new row violates row-level security policy for table "kv"`.

---

## 🧩 Registering commands

Commands live in `src/commands`. Each file exports a `Command` object. They are only loaded by the registration script and never executed in the worker.

To upload the definitions to Discord:

```bash
npm run register-commands
```

See `src/commands/hello.ts` for an example.

---

## 📡 Local development

```bash
npm run build   # compile TypeScript
npm run dev     # launch local worker
```

Wrangler will print a temporary URL (typically `http://localhost:8787`). Copy that into the Discord application’s **Interactions Endpoint** configuration. Discord validates every request with a PING.

---

## 📦 Deployment

```bash
npm run build
npm run deploy
```

Update the Discord app with the deployed Worker URL.

---

## 📖 Handling interactions

`src/index.ts` verifies the signature and handles PING. It delegates command processing to `commandHandlers`:

```ts
switch(name){
  case 'hello':
    return c.json({type:4,data:{content:'Bonjour!'}});
  // …
}
```

Each handler returns a JSON payload compliant with Discord’s API (type 4 for a response). Use `databaseUtils`, mail helpers, etc., as needed. No `discord.js` dependency is required.

---

## 🤖 Periodic tasks via GitHub Actions

Former daemons were rewritten as GitHub workflows that run on cron schedules and call the Discord API via `fetch`.

Workflows & scripts:

| Workflow             | File                                       | Cron default   |
|---------------------|--------------------------------------------|----------------|
| manage_verified_role | `.github/workflows/manage_verified_role.yml` | every 5 min    |
| verify_graduations   | `.github/workflows/verify_graduations.yml`  | every 15 min   |
| default_role_giver   | `.github/workflows/default_role_giver.yml`  | hourly         |

**Required GitHub secrets:**

- `BOT_TOKEN`, `GUILD_ID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (if using Supabase)
- Optional overrides: `CHAT_CHANNEL_ID`, `VERIFIED_ROLE_ID`, `STAFF_ROLE_ID`, `NORMAL_ROLE_ID`,
  `GRAD_ROLE_ID`, `BOT_ROLE_ID`.

Workflows install dependencies then run the corresponding TypeScript script with `ts-node`. They can also be triggered manually from the **Actions** tab.

---

## 📝 Notes

- **Interaction endpoint only** – no websocket = no presence, messages, or other events. Everything happens through slash commands.
- Code is portable to any environment supporting Hono.
- Remove `@supabase/supabase-js` if you don’t need storage.
- Wrangler 3+ handles TypeScript compilation automatically; the `dist` folder is merely conventional.

---

🎉 With this architecture, your bot is lightweight, easy to deploy and works anywhere Hono runs. Happy
coding!
