import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/command';

const hello: Command = {
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Greets a user in Japanese!')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to greet')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('style')
        .setDescription('Greeting style')
        .setRequired(false)
        .addChoices(
          { name: 'Morning (Ohayo gozaimasu)', value: 'morning' },
          { name: 'Afternoon (Konnichiwa)', value: 'afternoon' },
          { name: 'Evening (Konbanwa)', value: 'evening' },
          { name: 'First meeting (Hajimemashite)', value: 'first' },
          { name: 'Casual (Genki?)', value: 'casual' },
          { name: 'Random', value: 'random' }
        )
    ),

  async execute(interaction, env) {
    // const targetUser = interaction.options.getUser('user') || interaction.user;
    // const style = interaction.options.getString('style') || 'random';

    const targetUser = interaction.member.user.global_name || interaction.member.user.username;
    if (!interaction.data.options) {
      return { type: 4, data: { content: `Konnichiwa, ${targetUser}-san! ☀️` } };
    }
    const styleOption = interaction.data.options.find((o: any) => o.name === 'style');
    const style = interaction.data.options.find((o: any) => o.name === 'style')?.value || 'random';

    const greetings = {
      morning: `Ohayo gozaimasu, ${targetUser}-san! 🌅`,
      afternoon: `Konnichiwa, ${targetUser}-san! ☀️`,
      evening: `Konbanwa, ${targetUser}-san! 🌙`,
      first: `Hajimemashite, ${targetUser}-san! Douzo yoroshiku onegaishimasu! 🙇‍♂️`,
      casual: `Genki desu ka, ${targetUser}-san? 😊`,
    };

    let greeting: string;
    if (style === 'random') {
      const randomGreetings = [
        `Konnichiwa, ${targetUser}-san! ☀️`,
        `Ohayo gozaimasu, ${targetUser}-san! 🌅`,
        `Konbanwa, ${targetUser}-san! 🌙`,
        `Hajimemashite, ${targetUser}-san! Douzo yoroshiku! 🙇‍♂️`,
        `Genki desu ka, ${targetUser}-san? 😊`,
        `Ogenki desu ka, ${targetUser}-san? 🌸`,
        `Otsukaresama desu, ${targetUser}-san! 💪`,
        `Arigatou gozaimasu, ${targetUser}-san! 🙏`,
        `Sumimasen, ${targetUser}-san! Douzo yoroshiku! 😌`
      ];
      const randomIndex = Math.floor(Math.random() * randomGreetings.length);
      greeting = randomGreetings[randomIndex]!;
    } else {
      greeting = greetings[style as keyof typeof greetings] || greetings.afternoon;
    }

    // await interaction.reply(greeting);
    return { type: 4, data: { content: greeting } };
  },
};

export default hello;
