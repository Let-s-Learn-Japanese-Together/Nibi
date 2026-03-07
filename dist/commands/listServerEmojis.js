"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const listServerEmojis = {
    data: { name: 'list-server-emojis', description: 'List all server emojis grouped by their role restrictions', type: 1 },
    async execute(interaction, env) {
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
        const publicEmojis = [];
        const roleGroups = new Map();
        emojis.forEach((emoji) => {
            const emojiDisplay = `<:${emoji.name}:${emoji.id}>`;
            if (!emoji.roles || emoji.roles.length === 0) {
                publicEmojis.push(emojiDisplay);
            }
            else {
                emoji.roles.forEach((role) => {
                    if (!roleGroups.has(role)) {
                        roleGroups.set(role, []);
                    }
                    roleGroups.get(role).push(emojiDisplay);
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
exports.default = listServerEmojis;
