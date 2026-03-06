import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder, Emoji, GuildEmoji } from 'discord.js';

interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const ping: Command = {
  data: new SlashCommandBuilder()
    .setName('emoji-management')
    .setDescription('(Admin) Manage server emojis locked to specific roles')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all emojis in the server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('lock')
        .setDescription('Lock an emoji to the role (admin only)')
        .addStringOption(option =>
          option
            .setName('emoji')
            .setDescription('The emoji')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to lock the emoji to')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unlock')
        .setDescription('Unlock an emoji from the role (admin only)')
        .addStringOption(option =>
          option
            .setName('emoji')
            .setDescription('The emoji')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role the emoji is locked to (if any)')
            .setRequired(false)
        )
    ),


  async execute(interaction: ChatInputCommandInteraction) {
    console.log("Executing emoji-management command...");
    const subcommand = interaction.options.getSubcommand();
    console.log(`Subcommand: ${subcommand}`);
    const guild = interaction.client.guilds.cache.get(interaction.guildId!);
    if (!guild) {
      await interaction.reply('Guild not found.');
      return;
    }
    await guild.emojis.fetch();

    if (subcommand === 'list') {
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
          }
          );
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
    }

    if (subcommand === 'lock') {
      // Assign role to emoji, not creating emoji to guild
      try {
        if (!interaction.memberPermissions?.has('ManageEmojisAndStickers')) {
          await interaction.reply('You do not have permission to use this command.');
          return;
        }
        const emojiInput = interaction.options.getString('emoji', true);
        const emojiMatch = emojiInput.match(/<a?:\w+:(\d+)>/);
        if (!emojiMatch) {
          await interaction.reply('Invalid emoji format. Please provide a valid emoji.');
          return;
        }
        const emojiId = emojiMatch[1] as string;
        const emoji = guild.emojis.cache.get(emojiId) as GuildEmoji;
        const role = interaction.options.getRole('role', true);


        await emoji.roles.add(role.id);
        await interaction.reply(`Emoji ${emoji} locked to role <@&${role.id}>.`);
      } catch (error) {
        console.error('Error locking emoji to role:', error);
        await interaction.reply('Failed to lock emoji to role.');
      }
    }
    if (subcommand === 'unlock') {
      try {
        if (!interaction.memberPermissions?.has('ManageEmojisAndStickers')) {
          await interaction.reply('You do not have permission to use this command.');
          return;
        }
        const emojiInput = interaction.options.getString('emoji', true);
        const emojiMatch = emojiInput.match(/<a?:\w+:(\d+)>/);
        if (!emojiMatch) {
          await interaction.reply('Invalid emoji format. Please provide a valid emoji.');
          return;
        }
        const emojiId = emojiMatch[1] as string;
        const emoji = guild.emojis.cache.get(emojiId) as GuildEmoji;
        const role = interaction.options.getRole('role', false);
        if (role) {
          await emoji.roles.remove(role.id);
          await interaction.reply(`Role <@&${role.id}> removed from emoji ${emoji}.`);
        }
        else {
          await emoji.roles.set([]);
          await interaction.reply(`All roles removed from emoji ${emoji}.`);
        }
      } catch (error) {
        console.error('Error removing role from emoji:', error);
        await interaction.reply('Failed to remove role from emoji.');
      }
    }
  },
};



export default ping;