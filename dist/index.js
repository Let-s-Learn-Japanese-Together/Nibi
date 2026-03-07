"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const databaseUtils_1 = require("./utils/databaseUtils");
// polyfills need to be registered before any modules that may use XMLHttpRequest
// (kuromoji's browser loader relies on it when running inside the worker bundle).
require("./utils/polyfills");
const discord_interactions_1 = require("discord-interactions");
const hono_1 = require("hono");
// commands imports
const dictionnary_1 = __importDefault(require("./commands/dictionnary"));
const emojiManagment_1 = __importDefault(require("./commands/emojiManagment"));
const hello_1 = __importDefault(require("./commands/hello"));
const listServerEmojis_1 = __importDefault(require("./commands/listServerEmojis"));
const pronounce_1 = __importDefault(require("./commands/pronounce"));
const sendVerificationCode_1 = __importStar(require("./commands/sendVerificationCode"));
const app = new hono_1.Hono();
app.post("/api/interactions", async (c) => {
    const signature = c.req.header("x-signature-ed25519");
    const timestamp = c.req.header("x-signature-timestamp");
    const body = await c.req.text();
    if (!c.env)
        return c.text("Environment variables not found", 500);
    const PUBLIC_KEY = c.env.PUBLIC_KEY;
    if (!signature || !timestamp || !PUBLIC_KEY) {
        console.warn("Missing signature, timestamp, or public key");
        if (!signature)
            console.warn("Missing signature");
        if (!timestamp)
            console.warn("Missing timestamp");
        if (!PUBLIC_KEY)
            console.warn("Missing public key");
        return c.text("invalid request headers", 400);
    }
    const isValid = (0, discord_interactions_1.verifyKey)(body, signature, timestamp, PUBLIC_KEY);
    if (!isValid) {
        console.warn("Invalid request signature");
        console.warn("Request body:", body);
        return c.text("invalid request signature", 401);
    }
    const interaction = JSON.parse(body);
    // Discord PING - respond with PONG
    if (interaction.type === 1) {
        return c.json({ type: 1 });
    }
    // Handle application commands
    if (interaction.type === 2) {
        const name = interaction.data.name;
        switch (name) {
            case "ping": {
                return c.json({ type: 4, data: { content: "Pong!" } });
            }
            case "emoji-management":
                return c.json(await emojiManagment_1.default.execute(interaction, c.env));
            case "list-server-emojis":
                return c.json(await listServerEmojis_1.default.execute(interaction, c.env));
            case "hello":
                return c.json(await hello_1.default.execute(interaction, c.env));
            case "dictionary":
                return c.json(await dictionnary_1.default.execute(interaction, c.env));
            case "pronounce":
                return c.json(await pronounce_1.default.execute(interaction, c.env));
            case "send-verification-code": {
                return c.json(await sendVerificationCode_1.default.execute(interaction, c.env));
            }
            default:
                console.warn("Unknown command received:", name);
                return c.json({
                    type: 4,
                    data: { content: `Unknown command: ${name}` },
                });
        }
    }
    // Modal submit - just acknowledge for now
    if (interaction.type === 5) {
        if (interaction.data.custom_id.startsWith("verify_code_modal:")) {
            const email = interaction.data.custom_id.split(":")[1];
            const code = interaction.data.components[0].components[0].value;
            if (code == (0, sendVerificationCode_1.seededCode)(email + c.env.EMAIL_HASH).toString()) {
                const DatabaseUtilsInstance = new databaseUtils_1.DatabaseUtils({
                    SUPABASE_URL: c.env.SUPABASE_URL || "",
                    SUPABASE_ANON_KEY: c.env.SUPABASE_ANON_KEY || "",
                });
                let users = (await DatabaseUtilsInstance.readJson("users"));
                const userIndex = users && users.findIndex((u) => u.email === email);
                if (!userIndex || userIndex === -1) {
                    if (users == null) {
                        console.warn("No users found in database, initializing with empty array");
                        users = [];
                    }
                    users.push({ id: interaction.member.user.id, email }); // Add new user record
                }
                else {
                    users[userIndex].email = email; // Mark user as verified by setting their email
                }
                await DatabaseUtilsInstance.writeJson("users", users);
                return c.json({
                    type: 4,
                    data: {
                        content: "Verification successful! You can now use the bot features.",
                        flags: 64,
                    },
                });
            }
            else {
                return c.json({
                // type: 4,
                // data: { content: 'Invalid verification code. Please try again.', flags: 64}
                }, 400);
            }
        }
    }
    return c.text("ok");
});
exports.default = app;
