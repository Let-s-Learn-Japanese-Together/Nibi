// using built-in fetch in Node 18+; `ts-node` will compile files on the fly.
// you can `npm install dotenv` and call `require('dotenv').config()` at top
// if you prefer loading a .env file during development.

import dotenv from "dotenv";
import { readdir } from "fs/promises";
import path from "path";
import { Command } from "./types/command";
dotenv.config({ path: process.cwd() + "/.env" });

const APPLICATION_ID = process.env.APP_ID as string;
const BOT_TOKEN = process.env.BOT_TOKEN as string;

// helper that loads each command module from the commands folder and returns
// an array of the raw JSON payloads (ready to POST to Discord).
async function loadCommands() {
  const commandsDir = path.join(__dirname, "commands");
  const entries = await readdir(commandsDir);
  const commandData: Command[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".ts") && !entry.endsWith(".js")) continue;
    const modPath = path.join(commandsDir, entry);
    // dynamic import allows ts-node to compile if running .ts
    const commandModule = await import(modPath);
    const command = commandModule.default;
    if (command && command.data && typeof command.data.toJSON === "function") {
      commandData.push(command.data.toJSON());
    } else {
      console.warn("Skipping invalid command file", entry);
    }
  }

  return commandData;
}

async function register() {
  if (!APPLICATION_ID || !BOT_TOKEN) {
    console.error("APP_ID and BOT_TOKEN must be set");
    process.exit(1);
  }

  const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

  const commands = await loadCommands();
  if (commands.length === 0) {
    console.warn("No commands found in src/commands");
    return;
  }

  for (const command of commands) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Failed to register", command.data.name, res.status, text);
    } else {
      // registration succeeded
    }
  }
}

register().catch(console.error);
