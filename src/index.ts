import { verifyKey } from 'discord-interactions';
import { Hono } from 'hono';
import { handle } from './command-handlers';

const app = new Hono();

app.post('/api/interactions', async (c) => {
    const signature = c.req.header('x-signature-ed25519');
    const timestamp = c.req.header('x-signature-timestamp');
    const body = await c.req.text();

    if (!c.env) return c.text('Environment variables not found', 500);

    // const PUBLIC_KEY = process.env.PUBLIC_KEY || "0b390e804e408a8d3a233a1ccf8d9cc95f36c3b44feab3a73fd931b3ce71693d";
    const PUBLIC_KEY = c.env.PUBLIC_KEY as string;

    if (!signature || !timestamp || !PUBLIC_KEY) {
        console.log('Missing signature, timestamp, or public key');
        if (!signature) console.log('Missing signature');
        if (!timestamp) console.log('Missing timestamp');
        if (!PUBLIC_KEY) console.log('Missing public key');
        console.log('Request headers:', {
            signature: signature ? '[present]' : '[missing]',
            timestamp: timestamp ? '[present]' : '[missing]',
            PUBLIC_KEY: PUBLIC_KEY ? '[present]' : '[missing]'
        });
        return c.text('invalid request headers', 400);

    }

    const isValid = verifyKey(body, signature, timestamp, PUBLIC_KEY);
    if (!isValid) {
        console.log('Invalid request signature');
        console.log('Request body:', body);
        return c.text('invalid request signature', 401);
    }

    const interaction = JSON.parse(body);
    // console.log('Received interaction', interaction);

    // Discord PING - respond with PONG
    if (interaction.type === 1) {
        return c.json({ type: 1 });
    }

    // Handle application commands
    if (interaction.type === 2) {
        const name: string = interaction.data.name;

        // // optional: initialize supabase if not already done
        // const env2 = (c.env || (process.env as any)) as Record<string, string>;
        // let supabase: SupabaseClient | undefined =
        //     env2.SUPABASE_URL && env2.SUPABASE_ANON_KEY
        //         ? createClient(env2.SUPABASE_URL, env2.SUPABASE_ANON_KEY)
        //         : undefined;

        // delegate to handler map when available
        const { execute } = await handle(name as 'dictionnary' | 'emoji-management' | 'hello' | 'info' | 'list-server-emojis' | 'ping' | 'pronounce' | 'send-verification-code');
        if (execute) {
            try {
                const result = await execute(interaction.data.options, c.env);
                return c.json(result);
            } catch (err) {
                console.error('command error', name, err);
                return c.json({ type: 4, data: { content: 'Erreur interne.', flags: 64 } });

            }
        }

        // fallback message
        return c.json({
            type: 4,
            data: { content: `Commande inconnue: ${name}` },
        });
    }

    // default fallback
    return c.text('ok');
});

export default app;