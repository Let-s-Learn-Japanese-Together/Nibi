import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifyKey } from 'discord-interactions';
import { Hono } from 'hono';

// Provide a type for the environment variables that will be bound by Wrangler.
// Environment variables that will be bound by Wrangler.  You can also use
// `wrangler secret put` to populate each value.
// note: Cloudflare worker bindings are injected by wrangler and available via
// `process.env` at build time, or you can access `c.env` in the handler with an `any` cast.

const app = new Hono();

app.post('/interactions', async (c) => {
  const signature = c.req.header('x-signature-ed25519');
  const timestamp = c.req.header('x-signature-timestamp');
  const body = await c.req.text();

  // support both process.env (build-time) and runtime c.env
  const env = (c.env || (process.env as any)) as Record<string, string>;
  const PUBLIC_KEY = env.PUBLIC_KEY;

  if (!signature || !timestamp || !PUBLIC_KEY) {
    return c.text('invalid request headers', 400);
  }

  const isValid = verifyKey(body, signature, timestamp, PUBLIC_KEY);
  if (!isValid) {
    return c.text('invalid request signature', 401);
  }

  const interaction = JSON.parse(body);

  // Discord PING - respond with PONG
  if (interaction.type === 1) {
    return c.json({ type: 1 });
  }

  // Handle application commands
  if (interaction.type === 2) {
    const name: string = interaction.data.name;

    // optional: initialize supabase if not already done
    // optional supabase client (can also use process.env directly)
    const env2 = (c.env || (process.env as any)) as Record<string, string>;
    let supabase: SupabaseClient | undefined =
      env2.SUPABASE_URL && env2.SUPABASE_ANON_KEY
        ? createClient(env2.SUPABASE_URL, env2.SUPABASE_ANON_KEY)
        : undefined;

    switch (name) {
      case 'hello':
        return c.json({
          type: 4,
          data: { content: 'Bonjour depuis Hono et Cloudflare Workers !' },
        });
      // Add more commands here, you can use `supabase` inside handlers
      default:
        return c.json({
          type: 4,
          data: { content: `Commande inconnue: ${name}` },
        });
    }
  }

  // default fallback
  return c.text('ok');
});

export default app;