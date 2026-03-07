"use strict";
// using built-in fetch in Node 18+; `ts-node` will compile files on the fly.
// you can `npm install dotenv` and call `require('dotenv').config()` at top
// if you prefer loading a .env file during development.
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
const dotenv_1 = __importDefault(require("dotenv"));
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: process.cwd() + "/.env" });
const APPLICATION_ID = process.env.APP_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
// helper that loads each command module from the commands folder and returns
// an array of the raw JSON payloads (ready to POST to Discord).
async function loadCommands() {
    const commandsDir = path_1.default.join(__dirname, "commands");
    const entries = await (0, promises_1.readdir)(commandsDir);
    const commandData = [];
    for (const entry of entries) {
        if (!entry.endsWith(".ts") && !entry.endsWith(".js"))
            continue;
        const modPath = path_1.default.join(commandsDir, entry);
        // dynamic import allows ts-node to compile if running .ts
        const commandModule = await Promise.resolve(`${modPath}`).then(s => __importStar(require(s)));
        const command = commandModule.default;
        if (command && command.data && typeof command.data.toJSON === "function") {
            commandData.push(command.data.toJSON());
        }
        else {
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
        }
        else {
            // registration succeeded
        }
    }
}
register().catch(console.error);
