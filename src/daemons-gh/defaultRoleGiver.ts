import { config } from "../config";

import dotenv from "dotenv";
dotenv.config({ path: process.cwd() + "/.env" });

const BOT_TOKEN = process.env.BOT_TOKEN || config.discord.token;
const GUILD_ID = process.env.GUILD_ID || config.discord.guildId;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN env var is required");
if (!GUILD_ID) throw new Error("GUILD_ID env var is required");

async function fetchAllGuildMembers(): Promise<any[]> {
  const members: any[] = [];
  let after: string | undefined;
  while (true) {
    const params = new URLSearchParams({ limit: "1000" });
    if (after) params.set("after", after);
    const url = `https://discord.com/api/v10/guilds/${GUILD_ID}/members?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch members: ${res.status}`);
    }
    const data = (await res.json()) as any[];
    members.push(...data);
    if (data.length < 1000) break;
    after = data[data.length - 1].user.id;
  }
  return members;
}

async function addRole(memberId: string, roleId: string) {
  const url = `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${memberId}/roles/${roleId}`;
  await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  });
}

(async () => {
  try {
    const staffLabelRoleId = process.env.STAFF_ROLE_ID || "1427323094737096775";
    const normalLabelRoleId =
      process.env.NORMAL_ROLE_ID || "1427323203105325267";
    const graduationLabelRoleId =
      process.env.GRAD_ROLE_ID || "1427323151422849096";
    const botRoleId = process.env.BOT_ROLE_ID || "1427262077025783919";

    const members = await fetchAllGuildMembers();

    for (const m of members) {
      if (m.user?.bot) {
        if (!m.roles.includes(botRoleId)) {
          try {
            await addRole(m.user.id, botRoleId);
            console.log(`Added bot role to ${m.user.id}`);
          } catch (error) {
            console.error(`Failed to add bot role to ${m.user.id}`, error);
          }
        }
      }

      for (const roleId of [
        normalLabelRoleId,
        staffLabelRoleId,
        graduationLabelRoleId,
      ]) {
        if (!m.roles.includes(roleId)) {
          try {
            await addRole(m.user.id, roleId);
            console.log(`Added ${roleId} to ${m.user.id}`);
          } catch (error) {
            console.error(`Failed to add ${roleId} to ${m.user.id}`, error);
          }
        }
      }
    }
  } catch (e) {
    console.error("defaultRoleGiver failed", e);
    process.exit(1);
  }
})();
