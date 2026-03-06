// polyfills need to be registered before any modules that may use XMLHttpRequest
// (kuromoji's browser loader relies on it when running inside the worker bundle).
import './utils/polyfills';

import { verifyKey } from 'discord-interactions';
import { Hono } from 'hono';

// commands imports
import dictionary from './commands/dictionnary';
import emojiManagement from './commands/emojiManagment';
import hello from './commands/hello';
import listServerEmojis from './commands/listServerEmojis';
import pronounce from './commands/pronounce';
import sendVerificationCode, { seededCode } from './commands/sendVerificationCode';


const app = new Hono();

app.post('/api/interactions', async (c) => {
    const signature = c.req.header('x-signature-ed25519');
    const timestamp = c.req.header('x-signature-timestamp');
    const body = await c.req.text();

    if (!c.env) return c.text('Environment variables not found', 500);
    const PUBLIC_KEY = c.env.PUBLIC_KEY as string;

    if (!signature || !timestamp || !PUBLIC_KEY) {
        console.warn('Missing signature, timestamp, or public key');
        if (!signature) console.warn('Missing signature');
        if (!timestamp) console.warn('Missing timestamp');
        if (!PUBLIC_KEY) console.warn('Missing public key');
        // console.log('Request headers:', {
        //     signature: signature ? '[present]' : '[missing]',
        //     timestamp: timestamp ? '[present]' : '[missing]',
        //     PUBLIC_KEY: PUBLIC_KEY ? '[present]' : '[missing]'
        // });
        return c.text('invalid request headers', 400);

    }

    const isValid = verifyKey(body, signature, timestamp, PUBLIC_KEY);
    if (!isValid) {
        console.warn('Invalid request signature');
        console.warn('Request body:', body);
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

        switch (name) {
            case 'ping': {
                return c.json({ type: 4, data: { content: 'Pong!' } });
            }
            case 'emoji-management':
                return c.json(await emojiManagement.execute(interaction, c.env));
            case 'list-server-emojis':
                return c.json(await listServerEmojis.execute(interaction, c.env));
            case 'hello': 
                return c.json(await hello.execute(interaction, c.env));
            case 'dictionary':
                return c.json(await dictionary.execute(interaction, c.env));
            case 'pronounce':
                return c.json(await pronounce.execute(interaction, c.env));
            case 'send-verification-code': {
                return c.json(await sendVerificationCode.execute(interaction, c.env));
            }
            default:
                console.warn('Unknown command received:', name);
                return c.json({
                    type: 4,
                    data: { content: `Unknown command: ${name}` }
                });
        }
    }

    // Modal submit - just acknowledge for now
    if (interaction.type === 5) {
        console.log('Received modal submit interaction');
        if (interaction.data.custom_id.startsWith('verify_code_modal:')) {
            const email = interaction.data.custom_id.split(':')[1];
            const code = interaction.data.components[0].components[0].value;
            if(code == seededCode(email + c.env.EMAIL_HASH).toString()) {
                return c.json({
                    type: 4,
                    data: { content: 'Verification successful! You can now use the bot features.', flags: 64}
                });
            } else {
                return c.json({
                    type: 4,
                    data: { content: 'Invalid verification code. Please try again.', flags: 64}
                 });
            }
        }
    }
    return c.text('ok');
});

export default app;