import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Bindings } from 'hono/types';
import { Command } from '../types/command';
import { Interaction } from './../types/Interaction';
import { InteractionResponse } from './../types/InteractionResponse';

const listServerEmojis: Command = {
  data: new SlashCommandBuilder()
    .setName('list-server-emojis')
    .setDescription('List all emojis in the server'),

  async execute(interaction: Interaction, env: Bindings): Promise<InteractionResponse> {
    // const guild = interaction.client.guilds.cache.get(config.discord.guildId);
    // if (!guild) {
    //   await interaction.reply('Guild not found.');
    //   return;
    // }

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

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Server Emojis')
      .setTimestamp();

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

    embed.setDescription(description);

    const interactionResponse: InteractionResponse = { type: 4, data: { embeds: [embed] } };
    return interactionResponse;
  },
};

export default listServerEmojis;