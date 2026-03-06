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
        'Authorization': `Bot ${env.BOT_TOKEN}`,
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

    emojis.forEach((emoji: any) => {
      const emojiDisplay = `<:${emoji.name}:${emoji.id}>`;

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
