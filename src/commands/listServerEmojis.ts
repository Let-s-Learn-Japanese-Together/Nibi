import { Bindings } from 'hono/types';
import { Command } from '../types/command';
import { Interaction } from './../types/Interaction';
import { InteractionResponse } from './../types/InteractionResponse';

const listServerEmojis: Command = {
  data: { name: 'list-server-emojis', description: 'List all server emojis grouped by their role restrictions', type: 1 },

  async execute(interaction: Interaction, env: Bindings): Promise<InteractionResponse> {
    const guild = interaction.guild_id;
    const rawRequest = {
      method: 'GET',
      url: `https://discord.com/api/v10/guilds/${guild}/emojis`,
      headers: {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await fetch(rawRequest.url, {
      method: rawRequest.method,
      headers: rawRequest.headers
    });

    const emojis = await response.json();

    const publicEmojis: string[] = [];
    const roleGroups: Map<string, string[]> = new Map();

    emojis.forEach((emoji: { roles: any[]; }) => {
      const emojiDisplay = `${emoji}`;

      if (!emoji.roles || emoji.roles.length === 0) {
        publicEmojis.push(emojiDisplay);
      } else {
        emoji.roles.forEach((role: { id: string; }) => {
          if (!roleGroups.has(role.id)) {
            roleGroups.set(role.id, []);
          }
          roleGroups.get(role.id)!.push(emojiDisplay);
        });
      }
    });

    let description = '';

    if (publicEmojis.length > 0) {
      description += `**Public emojis:**\n${publicEmojis.join(' ')}\n\n`;
    }

    roleGroups.forEach((emojis, roleId) => {
      description += `**<@&${roleId}>**\n${emojis.join(' ')}\n\n`;
    });

    if (description === '') {
      description = 'No emojis found.';
    }

    return {
      type: 4,
      data: {
        embeds: [{
          color: 0x00FF00,
          title: 'Server Emojis',
          description: description,
          timestamp: new Date().toISOString()
        }]
      }
    };
  },
};

export default listServerEmojis;
