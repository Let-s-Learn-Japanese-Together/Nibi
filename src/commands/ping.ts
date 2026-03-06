import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';

const ping: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong and bot latency!'),

  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({
      content: 'Pinging...',
      fetchReply: true
    });

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🏓 Pong!')
      .addFields(
        {
          name: 'Roundtrip Latency',
          value: `${sent.createdTimestamp - interaction.createdTimestamp}ms`,
          inline: true
        },
        {
          name: 'Websocket Heartbeat',
          value: `${interaction.client.ws.ping}ms`,
          inline: true
        }
      )
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};

export default ping;