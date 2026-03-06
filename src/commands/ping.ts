import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/command';
import { InteractionResponse } from '../types/InteractionResponse';

const ping: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong and bot latency!'),

  async execute(interaction, env) {
    // const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    // const send = new Date();

    // const embed = new EmbedBuilder()
    //   .setColor(0x00FF00)
    //   .setTitle('🏓 Pong!')
    //   .addFields(
    //     {
    //       name: 'Roundtrip Latency',
    //       value: `${send.getTime() - interaction.createdTimestamp}ms`,
    //       inline: true
    //     },
    //     {
    //       name: 'Websocket Heartbeat',
    //       value: `${interaction.client.ws.ping}ms`,
    //       inline: true
    //     }
    //   )
    //   .setTimestamp();

    // await interaction.editReply({ content: '', embeds: [embed] });
    // return { type: 4, data: { embeds: [embed] } };
    return { type: 4, data: { content: 'Pong!' } } as InteractionResponse;
  },
};

export default ping;