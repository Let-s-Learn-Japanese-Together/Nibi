import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ModalBuilder } from 'discord.js';
import { Command } from '../types/command';
import { config } from '../config';
import { sendTemplateEmail } from '../utils/sendEmail';
import { readJson, writeJson } from '../utils/databaseUtils';
import { LLJTUser } from '../types/user';

const ping: Command = {
    data: new SlashCommandBuilder()
        .setName('send-verification-code')
        .setDescription('Send you a verification code through your mailbox to confirm this is you')
        .addStringOption(option =>
            option
                .setName('email')
                .setDescription('The email address to send the verification code to')
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const email = interaction.options.getString('email', true);
        // validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            await interaction.reply({ content: 'Please provide a valid email address.', ephemeral: true });
            return;
        }
        // Generate a deterministic 6-digit code based on the email
        function seededCode(email: string): number {
            let hash = 0;
            for (let i = 0; i < email.length; i++) {
                hash = (hash * 31 + email.charCodeAt(i)) % 1000000;
            }
            // Ensure it's a 6-digit code
            return 100000 + (hash % 900000);
        }
        const verificationCode = seededCode(email + config.hash);

        sendTemplateEmail(
            email,
            'Your Verification Code',
            'verificationCode',
            {
                username: interaction.user.displayName || interaction.user.username,
                verificationCode: verificationCode.toString()
            }
        ).then(() => {
            // Create a modal to verify the code
            const { TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
            const codeInput = new TextInputBuilder()
                .setCustomId('verification_code')
                .setLabel('Enter the 6-digit verification code')
                .setStyle(TextInputStyle.Short)
                .setMinLength(6)
                .setMaxLength(6)
                .setPlaceholder('123456')
                .setRequired(true);

            const actionRow = new ActionRowBuilder().addComponents(codeInput);

            const modal = new ModalBuilder()
                .setCustomId(`verify_code_${email}`)
                .setTitle('Verify Your Email')
                .addComponents(actionRow);

            // Show the modal to the user
            interaction.showModal(modal);

            interaction.client.on('interactionCreate', async (modalInteraction) => {
                if (!modalInteraction.isModalSubmit()) return;
                if (modalInteraction.customId === `verify_code_${email}`) {
                    const userCode = modalInteraction.fields.getTextInputValue('verification_code');
                    if (userCode === verificationCode.toString()) {
                        const users: LLJTUser[] = await readJson<LLJTUser[]>('./databases/users.json');
                        const userId = interaction.user.id;
                        let user = users.find(u => u.id === userId);
                        if (!user) {
                            const userToPush = {
                                id: userId,
                                email
                            };
                            users.push(userToPush as LLJTUser);
                            user = userToPush as LLJTUser;
                        }
                        user.email = email;
                        writeJson('./databases/users.json', users);
                        await modalInteraction.reply({ content: '✅ Verification successful! This email is now linked to your account.', ephemeral: true });
                    } else {
                        await modalInteraction.reply({ content: '❌ Incorrect code. Please try again.', ephemeral: true });
                    }
                }
            })

        }).catch(error => {
            console.error('Error sending verification code email:', error);
            interaction.reply({ content: 'Failed to send verification code. Please try again later.', ephemeral: true });
        });
    },
};

export default ping;