const { SlashCommandBuilder } = require('discord.js');

console.log(JSON.stringify(new SlashCommandBuilder()
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
    )
    .toJSON()));