import { Command } from "../types/command";
import { InteractionResponse } from "../types/InteractionResponse";

const info: Command = {
  data: { name: "info", description: "Get bot information", type: 1 },

  async execute(): Promise<InteractionResponse> {
    // const client = interaction.client;

    // // Calculate system statistics
    // const memoryUsage = process.memoryUsage();
    // const totalChannels = client.channels.cache.size;
    // const textChannels = client.channels.cache.filter(ch => ch.type === 0).size;
    // const voiceChannels = client.channels.cache.filter(ch => ch.type === 2).size;
    // const ping = client.ws.ping;

    // // Calculate total member count
    // const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

    // const embed = new EmbedBuilder()
    //   .setColor(0x5865F2)
    //   .setTitle('📊 Bot Statistics')
    //   .setThumbnail(client.user?.displayAvatarURL() || null)
    //   .addFields(
    //     // General information
    //     { name: '🤖 Bot Name', value: client.user?.tag || 'Unknown', inline: true },
    //     { name: '🆔 Bot ID', value: client.user?.id || 'Unknown', inline: true },
    //     { name: '📅 Created', value: client.user?.createdAt.toDateString() || 'Unknown', inline: true },

    //     // Server and user statistics
    //     { name: '🏠 Servers', value: `${client.guilds.cache.size.toLocaleString()}`, inline: true },
    //     { name: '👥 Cached Users', value: `${client.users.cache.size.toLocaleString()}`, inline: true },
    //     { name: '👤 Total Members', value: `${totalMembers.toLocaleString()}`, inline: true },

    //     // Channel statistics
    //     { name: '📺 Total Channels', value: `${totalChannels.toLocaleString()}`, inline: true },
    //     { name: '💬 Text Channels', value: `${textChannels.toLocaleString()}`, inline: true },
    //     { name: '🔊 Voice Channels', value: `${voiceChannels.toLocaleString()}`, inline: true },

    //     // Performance
    //     { name: '⏰ Uptime', value: formatUptime(client.uptime || 0), inline: true },
    //     { name: '📡 WebSocket Ping', value: `${ping}ms`, inline: true },
    //     { name: '🏓 API Ping', value: 'Calculating...', inline: true },

    //     // Memory and system
    //     { name: '💾 RAM Usage', value: `${formatMemory(memoryUsage.heapUsed)} / ${formatMemory(memoryUsage.heapTotal)}`, inline: true },
    //     { name: '💻 Node.js', value: process.version, inline: true },
    //     { name: '📦 Discord.js', value: require('discord.js').version || '14.x', inline: true }
    //   )
    //   .setFooter({ text: `Requested by ${interaction.user.tag} • Powered by Discord.js & TypeScript` })
    //   .setTimestamp();

    // // Send initial embed
    // const reply = await interaction.reply({ embeds: [embed], fetchReply: true });

    // // Calculate API ping and update the embed
    // const apiPing = reply.createdTimestamp - interaction.createdTimestamp;

    // const updatedEmbed = EmbedBuilder.from(embed)
    //   .setFields(embed.data.fields?.map(field =>
    //     field.name === '🏓 API Ping'
    //       ? { ...field, value: `${apiPing}ms` }
    //       : field
    //   ) || []);

    // await interaction.editReply({ embeds: [updatedEmbed] });

    //WIP command
    return {
      type: 4,
      data: {
        content:
          "This command is still a work in progress. Stay tuned for updates!",
      },
    };
  },
};

export default info;
