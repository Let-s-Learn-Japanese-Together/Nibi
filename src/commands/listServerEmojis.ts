import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import { config } from '../config';

const ping: Command = {
  data: new SlashCommandBuilder()
    .setName('list-server-emojis')
    .setDescription('List all emojis in the server'),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.client.guilds.cache.get(config.discord.guildId);
    if (!guild) {
      await interaction.reply('Guild not found.');
      return;
    }

    await guild.emojis.fetch();
    
    const publicEmojis: string[] = [];
    const roleGroups: Map<string, string[]> = new Map();

    guild.emojis.cache.forEach(emoji => {
      const emojiDisplay = `${emoji}`;
      
      if (!emoji.roles || emoji.roles.cache.size === 0) {
        publicEmojis.push(emojiDisplay);
      } else {
        emoji.roles.cache.forEach(role => {
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

    await interaction.reply({ content: '', embeds: [embed] });
  },
};

export default ping;