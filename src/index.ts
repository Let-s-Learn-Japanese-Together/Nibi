import { DatabaseUtils } from "./utils/databaseUtils";
// polyfills need to be registered before any modules that may use XMLHttpRequest
// (kuromoji's browser loader relies on it when running inside the worker bundle).
import "./utils/polyfills";

import { verifyKey } from "discord-interactions";
import { Hono } from "hono";
import { AppBindings } from "./types/bindings";

// commands imports
import dictionary from "./commands/dictionnary";
import emojiManagement from "./commands/emojiManagment";
import hello from "./commands/hello";
import listServerEmojis from "./commands/listServerEmojis";
import pronounce from "./commands/pronounce";
import sendVerificationCode, {
  seededCode,
} from "./commands/sendVerificationCode";

const app = new Hono<{ Bindings: AppBindings }>();

// Middleware: inject process.env into Hono's c.env for Vercel/Node.js runtimes
// (on Cloudflare Workers, c.env is populated automatically by the runtime)
app.use("*", async (c, next) => {
  if (!c.env || Object.keys(c.env).length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c as any).env = process.env;
  }
  await next();
});

// utility for adding/removing Discord roles from within interaction handlers
async function modifyGuildMemberRole(
  memberId: string,
  roleId: string,
  token: string,
  guildId: string,
  add: boolean = true,
) {
  const method = add ? "PUT" : "DELETE";
  const url = `https://discord.com/api/v10/guilds/${guildId}/members/${memberId}/roles/${roleId}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`Failed to ${add ? "add" : "remove"} role:`, res.status, text);
  }
}

app.post("/api/interactions", async (c) => {
  const signature = c.req.header("x-signature-ed25519");
  const timestamp = c.req.header("x-signature-timestamp");
  const body = await c.req.text();

  if (!c.env) return c.text("Environment variables not found", 500);
  const PUBLIC_KEY = c.env.PUBLIC_KEY as string;

  if (!signature || !timestamp || !PUBLIC_KEY) {
    console.warn("Missing signature, timestamp, or public key");
    if (!signature) console.warn("Missing signature");
    if (!timestamp) console.warn("Missing timestamp");
    if (!PUBLIC_KEY) console.warn("Missing public key");
    return c.text("invalid request headers", 400);
  }

  const isValid = verifyKey(body, signature, timestamp, PUBLIC_KEY);
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
    const name: string = interaction.data.name;

    switch (name) {
      case "ping": {
        return c.json({ type: 4, data: { content: "Pong!" } });
      }
      case "emoji-management":
        return c.json(await emojiManagement.execute(interaction, c.env));
      case "list-server-emojis":
        return c.json(await listServerEmojis.execute(interaction, c.env));
      case "hello":
        return c.json(await hello.execute(interaction, c.env));
      case "dictionary":
        return c.json(await dictionary.execute(interaction, c.env));
      case "pronounce":
        return c.json(await pronounce.execute(interaction, c.env));
      case "send-verification-code": {
        return c.json(await sendVerificationCode.execute(interaction, c.env));
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
      if (code == seededCode(email + c.env.EMAIL_HASH).toString()) {
        const DatabaseUtilsInstance = new DatabaseUtils({
          SUPABASE_URL: (c.env.SUPABASE_URL as string) || "",
          SUPABASE_ANON_KEY: (c.env.SUPABASE_ANON_KEY as string) || "",
        });
        let users = (await DatabaseUtilsInstance.readJson("users")) as Array<{
          id: string;
          email?: string;
        }>;

        const userIndex = users && users.findIndex((u) => u.email === email);
        if (!userIndex || userIndex === -1) {
          if (users == null) {
            console.warn(
              "No users found in database, initializing with empty array",
            );
            users = [];
          }
          users.push({ id: interaction.member.user.id, email }); // Add new user record
        } else {
          users[userIndex].email = email; // Mark user as verified by setting their email
        }
        await DatabaseUtilsInstance.writeJson("users", users);

        // add verified role to the member immediately
        try {
          const BOT_TOKEN = (c.env.BOT_TOKEN as string) || c.env.BOT_TOKEN as string || "";
          const GUILD_ID = (c.env.GUILD_ID as string) || c.env.GUILD_ID as string || "";
          const VERIFIED_ROLE_ID =
            (c.env.VERIFIED_ROLE_ID as string) || c.env.VERIFIED_ROLE_ID as string || "1427262130154901614";
          await modifyGuildMemberRole(
            interaction.member.user.id,
            VERIFIED_ROLE_ID,
            BOT_TOKEN,
            GUILD_ID,
            true,
          );
        } catch (err) {
          console.error("Error assigning verified role:", err);
        }

        return c.json({
          type: 4,
          data: {
            content:
              "Verification successful! You can now use the bot features.",
            flags: 64,
          },
        });
      } else {
        return c.json(
          {
            // type: 4,
            // data: { content: 'Invalid verification code. Please try again.', flags: 64}
          },
          400,
        );
      }
    }
  }
  return c.text("ok");
});

export default app;
