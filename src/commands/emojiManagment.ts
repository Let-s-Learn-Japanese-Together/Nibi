import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/command';

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


  async execute(interaction, env) {
    console.log("Executing emoji-management command...");
    const subcommand = interaction.data.options?.find((o: any) => o.type === 1)?.name;
    console.log(`Subcommand: ${subcommand}`);
    const guild = interaction.guild_id;
    if (!guild) {
      return { type: 4, data: { content: 'Guild not found.' } };
    }

    // await guild.emojis.fetch();
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
    console.log(`Fetched ${emojis.length} emojis from guild ${guild}`);


    if (subcommand === 'list') {
      const publicEmojis: string[] = [];
      const roleGroups: Map<string, string[]> = new Map();
      emojis.forEach((emoji: any) => {
        const emojiDisplay = `${emoji}`;
        if (!emoji.roles || emoji.roles.length === 0) {
          publicEmojis.push(emojiDisplay);
        } else {
          emoji.roles.forEach((role: any) => {
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

      // await interaction.reply({ content: '', embeds: [embed] });
      return { type: 4, data: { embeds: [embed] } };
    }

    // Member permissions check for lock/unlock subcommands
    // fetching member permissions requires additional API call, so we do it only for lock/unlock
    if (subcommand === 'lock' || subcommand === 'unlock') {
      const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${interaction.member.user.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      const memberData = await memberResponse.json();
      const permissions = BigInt(memberData.permissions);
      const manageEmojisPermission = BigInt(0x40000);
      if ((permissions & manageEmojisPermission) === BigInt(0)) {
        return { type: 4, data: { content: 'You do not have permission to use this command.' } };
      }

      if (subcommand === 'lock') {
        // Assign role to emoji, not creating emoji to guild
        try {
          // const emojiInput = interaction.options.getString('emoji', true);
          const emojiInputOption = interaction.data.options?.find((o: any) => o.name === 'emoji');
          if (!emojiInputOption || typeof emojiInputOption.value !== 'string') {
            return { type: 4, data: { content: 'Emoji option is required and must be a string.' } };
          }
          const emojiMatch = emojiInputOption.value.match(/<a?:\w+:(\d+)>/);
          if (!emojiMatch) {
            return { type: 4, data: { content: 'Invalid emoji format. Please provide a valid emoji.' } };
          }
          const emojiId = emojiMatch[1] as string;
          // const emoji = guild.emojis.cache.get(emojiId) as GuildEmoji;
          // const role = interaction.options.getRole('role', true);


          // await emoji.roles.add(role.id);
          // await interaction.reply(`Emoji ${emoji} locked to role <@&${role.id}>.`);


          //patch emoji via fetch since discord.js doesn't support modifying emoji roles directly
          const role = interaction.data.options?.find((o: any) => o.name === 'role' && o.type === 8);
          if (!role) {
            return { type: 4, data: { content: 'Role option is required.' } };
          }
          const patchRequest = {
            method: 'PATCH',
            url: `https://discord.com/api/v10/guilds/${guild}/emojis/${emojiId}`,
            headers: {
              'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              roles: [role.value]
            })
          };
          const patchResponse = await fetch(patchRequest.url, {
            method: patchRequest.method,
            headers: patchRequest.headers,
            body: patchRequest.body
          });
          if (!patchResponse.ok) {
            throw new Error(`Failed to lock emoji to role: ${patchResponse.status} ${patchResponse.statusText}`);
          }
          return { type: 4, data: { content: `Emoji <:${emojiId}> locked to role <@&${role.value}>.` } };
        } catch (error) {
          console.error('Error locking emoji to role:', error);
          return { type: 4, data: { content: 'Failed to lock emoji to role.' } };
        }
      }
      if (subcommand === 'unlock') {
        try {
          const emojiInputOption = interaction.data.options?.find((o: any) => o.name === 'emoji');
          if (!emojiInputOption || typeof emojiInputOption.value !== 'string') {
            return { type: 4, data: { content: 'Emoji option is required and must be a string.' } };
          }
          const emojiMatch = emojiInputOption.value.match(/<a?:\w+:(\d+)>/);
          if (!emojiMatch) {
            return { type: 4, data: { content: 'Invalid emoji format. Please provide a valid emoji.' } };
          }
          const emojiId = emojiMatch[1] as string;
          const role = interaction.data.options?.find((o: any) => o.name === 'role' && o.type === 8);
          if (role) {
            //patch emoji via fetch since discord.js doesn't support modifying emoji roles directly
            const patchRequest = {
              method: 'PATCH',
              url: `https://discord.com/api/v10/guilds/${guild}/emojis/${emojiId}`,
              headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                roles: role.value
              })
            };
            const patchResponse = await fetch(patchRequest.url, {
              method: patchRequest.method,
              headers: patchRequest.headers,
              body: patchRequest.body
            });
            if (!patchResponse.ok) {
              throw new Error(`Failed to unlock emoji from role: ${patchResponse.status} ${patchResponse.statusText}`);
            }
            return { type: 4, data: { content: `Emoji <:${emojiId}> unlocked from role <@&${role.value}>.` } };
          }
          else {
            //patch emoji via fetch since discord.js doesn't support modifying emoji roles directly
            const patchRequest = {
              method: 'PATCH',
              url: `https://discord.com/api/v10/guilds/${guild}/emojis/${emojiId}`,
              headers: {
                'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                roles: []
              })
            };
            const patchResponse = await fetch(patchRequest.url, {
              method: patchRequest.method,
              headers: patchRequest.headers,
              body: patchRequest.body
            });
            if (!patchResponse.ok) {
              throw new Error(`Failed to remove all roles from emoji: ${patchResponse.status} ${patchResponse.statusText}`);
            }
            return { type: 4, data: { content: `All roles removed from emoji <:${emojiId}>.` } };
          }
        } catch (error) {
          console.error('Error removing role from emoji:', error);
          return { type: 4, data: { content: 'Failed to remove role from emoji.' } };
        }
      }
    }

    return { type: 4, data: { content: 'Invalid subcommand.' } };
  }
};



export default ping;