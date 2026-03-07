import { Command } from "../types/command";

const emojiManagement: Command = {
  data: {
    name: "emoji-management",
    description: "(Admin) Manage server emojis locked to specific roles",
    type: 1,
    options: [
      {
        type: 1,
        name: "list",
        description: "List all emojis in the server",
      },
      {
        type: 1,
        name: "lock",
        description: "Lock an emoji to the role (admin only)",
        options: [
          {
            type: 3,
            name: "emoji",
            description: "The emoji",
            required: true,
          },
          {
            type: 8,
            name: "role",
            description: "The role to lock the emoji to",
            required: true,
          },
        ],
      },
      {
        type: 1,
        name: "unlock",
        description: "Unlock an emoji from the role (admin only)",
        options: [
          {
            type: 3,
            name: "emoji",
            description: "The emoji",
            required: true,
          },
          {
            type: 8,
            name: "role",
            description: "The role the emoji is locked to (if any)",
            required: false,
          },
        ],
      },
    ],
  },

  async execute(interaction, env) {
    const subcommand = interaction.data.options?.find(
      (o: Record<string, unknown>) => o.type === 1,
    )?.name;

    const guild = interaction.guild_id;
    if (!guild) {
      return { type: 4, data: { content: "Guild not found." } };
    }

    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guild}/emojis`,
      {
        method: "GET",
        headers: {
          Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
    const emojis = await response.json();

    if (subcommand === "list") {
      const publicEmojis: string[] = [];
      const roleGroups: Map<string, string[]> = new Map();
      emojis.forEach((emoji: { name: string; id: string; roles: string[] }) => {
        const emojiDisplay = `${emoji}`;
        if (!emoji.roles || emoji.roles.length === 0) {
          publicEmojis.push(emojiDisplay);
        } else {
          emoji.roles.forEach((role: string) => {
            if (!roleGroups.has(role)) {
              roleGroups.set(role, []);
            }
            roleGroups.get(role)!.push(emojiDisplay);
          });
        }
      });

      let description = "";
      if (publicEmojis.length > 0) {
        description += `**Public emojis:**\n${publicEmojis.join(" ")}\n\n`;
      }
      roleGroups.forEach((emojis, roleId) => {
        description += `**<@&${roleId}>**\n${emojis.join(" ")}\n\n`;
      });
      if (description === "") {
        description = "No emojis found.";
      }

      return {
        type: 4,
        data: {
          embeds: [
            {
              color: 0x00ff00,
              title: "Server Emojis",
              description: description,
              timestamp: new Date().toISOString(),
            },
          ],
        },
      };
    }

    if (subcommand === "lock" || subcommand === "unlock") {
      const memberResponse = await fetch(
        `https://discord.com/api/v10/guilds/${guild}/members/${interaction.member.user.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      );
      const memberData = await memberResponse.json();
      const permissions = BigInt(memberData.permissions);
      const manageEmojisPermission = BigInt(0x40000);
      if ((permissions & manageEmojisPermission) === BigInt(0)) {
        return {
          type: 4,
          data: { content: "You do not have permission to use this command." },
        };
      }

      if (subcommand === "lock") {
        try {
          const emojiInputOption = interaction.data.options?.find(
            (o: Record<string, unknown>) => o.name === "emoji",
          );
          if (!emojiInputOption || typeof emojiInputOption.value !== "string") {
            return {
              type: 4,
              data: {
                content: "Emoji option is required and must be a string.",
              },
            };
          }
          const emojiMatch = emojiInputOption.value.match(/<a?:\w+:(\d+)>/);
          if (!emojiMatch) {
            return {
              type: 4,
              data: {
                content: "Invalid emoji format. Please provide a valid emoji.",
              },
            };
          }
          const emojiId = emojiMatch[1] as string;
          const role = interaction.data.options?.find(
            (o: Record<string, unknown>) => o.name === "role" && o.type === 8
          );
          if (!role) {
            return { type: 4, data: { content: "Role option is required." } };
          }

          const patchResponse = await fetch(
            `https://discord.com/api/v10/guilds/${guild}/emojis/${emojiId}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ roles: [role.value] }),
            },
          );
          if (!patchResponse.ok) {
            throw new Error(
              `Failed to lock emoji to role: ${patchResponse.status} ${patchResponse.statusText}`,
            );
          }
          return {
            type: 4,
            data: {
              content: `Emoji <:${emojiId}> locked to role <@&${role.value}>.`,
            },
          };
        } catch (error) {
          console.error("Error locking emoji to role:", error);
          return {
            type: 4,
            data: { content: "Failed to lock emoji to role." },
          };
        }
      }

      if (subcommand === "unlock") {
        try {
          const emojiInputOption = interaction.data.options?.find(
            (o: Record<string, unknown>) => o.name === "emoji",
          );
          if (!emojiInputOption || typeof emojiInputOption.value !== "string") {
            return {
              type: 4,
              data: {
                content: "Emoji option is required and must be a string.",
              },
            };
          }
          const emojiMatch = emojiInputOption.value.match(/<a?:\w+:(\d+)>/);
          if (!emojiMatch) {
            return {
              type: 4,
              data: {
                content: "Invalid emoji format. Please provide a valid emoji.",
              },
            };
          }
          const emojiId = emojiMatch[1] as string;
          const role = interaction.data.options?.find(
            (o: Record<string, unknown>) => o.name === "role" && o.type === 8
          );

          const rolesArray = role ? [role.value] : [];
          const patchResponse = await fetch(
            `https://discord.com/api/v10/guilds/${guild}/emojis/${emojiId}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ roles: rolesArray }),
            },
          );
          if (!patchResponse.ok) {
            throw new Error(
              `Failed to update emoji roles: ${patchResponse.status} ${patchResponse.statusText}`,
            );
          }
          const message = role
            ? `Emoji <:${emojiId}> unlocked from role <@&${role.value}>.`
            : `All roles removed from emoji <:${emojiId}>.`;
          return { type: 4, data: { content: message } };
        } catch (error) {
          console.error("Error removing role from emoji:", error);
          return {
            type: 4,
            data: { content: "Failed to remove role from emoji." },
          };
        }
      }
    }

    return { type: 4, data: { content: "Invalid subcommand." } };
  },
};

export default emojiManagement;
