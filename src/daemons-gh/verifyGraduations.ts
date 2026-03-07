import { config } from "../config";
import { Lesson } from "../types/lesson";
import { DatabaseUtils } from "../utils/databaseUtils";
import fetchGoogleSheet from "../utils/fetchGoogleSheet";

import dotenv from "dotenv";
dotenv.config({ path: process.cwd() + "/.env" });

const BOT_TOKEN = process.env.BOT_TOKEN || config.discord.token;
const GUILD_ID = process.env.GUILD_ID || config.discord.guildId;
const CHAT_CHANNEL_ID = process.env.CHAT_CHANNEL_ID || "1427338649372201000";

if (!BOT_TOKEN) throw new Error("BOT_TOKEN env var is required");
if (!GUILD_ID) throw new Error("GUILD_ID env var is required");

const db = new DatabaseUtils({
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
});

interface GuildMember {
  user: { id: string; bot?: boolean };
  roles: string[];
}

async function fetchAllGuildMembers(): Promise<GuildMember[]> {
  const members: GuildMember[] = [];
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
    const data = (await res.json()) as GuildMember[];
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

async function removeRole(memberId: string, roleId: string) {
  const url = `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${memberId}/roles/${roleId}`;
  await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  });
}

(async () => {
  try {
    const lessons: Lesson[] = (await db.readJson("lessons")) || [];
    const users: Array<{ id: string; email?: string }> =
      (await db.readJson("users")) || [];

    let rolesToAdd: {
      ratio: number;
      role: string;
      userId: string;
      lesson: string;
      lessonIndex: number;
    }[] = [];

    for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex++) {
      const lesson = lessons[lessonIndex];
      if (!lesson || !lesson.id) continue;
      try {
        const sheetData = await fetchGoogleSheet(lesson.id);
        if (!sheetData || sheetData.length === 0) continue;
        const rolesToPush = sheetData
          .map((row: Record<string, string | number>) => {
            const user = users.find((u) => u.email === row.email);
            if (user) {
              return {
                ratio: row.ratio as number,
                role: lesson.role_id as string,
                lesson: lesson.label,
                userId: user.id,
                lessonIndex,
              };
            }
            return null;
          })
          .filter(
            (
              u,
            ): u is {
              ratio: number;
              role: string;
              lesson: string;
              userId: string;
              lessonIndex: number;
            } => !!u,
          );
        rolesToAdd = [...rolesToAdd, ...rolesToPush];
      } catch (error) {
        console.error(`Error fetching sheet for lesson ${lesson.id}:`, error);
        continue;
      }
    }

    const uniqueRolesToAdd: typeof rolesToAdd = [];
    const seen = new Map<string, number>();
    for (const entry of rolesToAdd) {
      const key = `${entry.userId}-${entry.role}`;
      if (!seen.has(key) || seen.get(key)! < entry.ratio) {
        seen.set(key, entry.ratio);
        const existingIndex = uniqueRolesToAdd.findIndex(
          (e) => e.userId === entry.userId && e.role === entry.role,
        );
        if (existingIndex !== -1) {
          uniqueRolesToAdd[existingIndex] = entry;
        } else {
          uniqueRolesToAdd.push(entry);
        }
      }
    }

    const members = await fetchAllGuildMembers();

    const hasAllPreviousRoles = (member: GuildMember, lessonIndex: number) => {
      if (lessonIndex === 0) return true;
      for (let i = 0; i < lessonIndex; i++) {
        const previousLesson = lessons[i];
        if (!previousLesson || !previousLesson.role_id) continue;
        if (!member.roles.includes(previousLesson.role_id)) {
          return false;
        }
      }
      return true;
    };

    for (const entry of uniqueRolesToAdd) {
      const member = members.find((m) => m.user.id === entry.userId);
      if (!member) {
        console.warn(`Member with ID ${entry.userId} not found`);
        continue;
      }

      const hasPrerequisites = hasAllPreviousRoles(member, entry.lessonIndex);

      if (entry.ratio >= 0.8 && hasPrerequisites) {
        if (!member.roles.includes(entry.role)) {
          try {
            await addRole(entry.userId, entry.role);
            if (CHAT_CHANNEL_ID) {
              await fetch(
                `https://discord.com/api/v10/channels/${CHAT_CHANNEL_ID}/messages`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bot ${BOT_TOKEN}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    content: `🎉 Congratulations <@${entry.userId}> for completing the graduation ${entry.lesson} and earning the role <@&${entry.role}>!`,
                    allowed_mentions: { users: [], roles: [] },
                  }),
                },
              );
            }
          } catch (error) {
            console.error(
              `Failed to add role ${entry.role} to ${entry.userId}:`,
              error,
            );
          }
        }
      } else {
        if (member.roles.includes(entry.role)) {
          try {
            await removeRole(entry.userId, entry.role);
            if (!hasPrerequisites) {
              // prerequisites missing, nothing to log
            }
          } catch (error) {
            console.error(
              `Failed to remove role ${entry.role} from ${entry.userId}:`,
              error,
            );
          }
        }
      }
    }
  } catch (e) {
    console.error("verifyGraduations failed", e);
    process.exit(1);
  }
})();
