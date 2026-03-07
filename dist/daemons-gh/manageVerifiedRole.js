"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const databaseUtils_1 = require("../utils/databaseUtils");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: process.cwd() + '/.env' });
// The Github Action must set these secrets or env vars
const BOT_TOKEN = process.env.BOT_TOKEN || config_1.config.discord.token;
const GUILD_ID = process.env.GUILD_ID || config_1.config.discord.guildId;
const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID || "1427262130154901614";
if (!BOT_TOKEN)
    throw new Error("BOT_TOKEN env var is required");
if (!GUILD_ID)
    throw new Error("GUILD_ID env var is required");
const db = new databaseUtils_1.DatabaseUtils({
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
});
async function fetchAllGuildMembers() {
    const members = [];
    let after;
    while (true) {
        const params = new URLSearchParams({ limit: "1000" });
        if (after)
            params.set("after", after);
        const url = `https://discord.com/api/v10/guilds/${GUILD_ID}/members?${params}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bot ${BOT_TOKEN}` },
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch members: ${res.status} ${res.statusText}`);
        }
        const data = (await res.json());
        members.push(...data);
        if (data.length < 1000)
            break;
        after = data[data.length - 1].user.id;
    }
    return members;
}
async function addRole(memberId, roleId) {
    const url = `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${memberId}/roles/${roleId}`;
    await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bot ${BOT_TOKEN}` },
    });
}
async function removeRole(memberId, roleId) {
    const url = `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${memberId}/roles/${roleId}`;
    await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bot ${BOT_TOKEN}` },
    });
}
(async () => {
    try {
        const users = (await db.readJson("users")) || [];
        const members = await fetchAllGuildMembers();
        for (const m of members) {
            const userRecord = users.find(u => u.id === m.user.id);
            const hasRole = Array.isArray(m.roles) && m.roles.includes(VERIFIED_ROLE_ID);
            if (userRecord && userRecord.email) {
                if (!hasRole) {
                    console.log(`adding verified role to ${m.user.id}`);
                    await addRole(m.user.id, VERIFIED_ROLE_ID).catch(console.error);
                }
            }
            else {
                if (hasRole) {
                    console.log(`removing verified role from ${m.user.id}`);
                    await removeRole(m.user.id, VERIFIED_ROLE_ID).catch(console.error);
                }
            }
        }
    }
    catch (e) {
        console.error("manageVerifiedRole failed", e);
        process.exit(1);
    }
})();
