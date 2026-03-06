const hello = {
    data: { "options": [{ "name": "user", "description": "The user to greet", "required": false, "type": 6 }, { "type": 3, "choices": [{ "name": "Morning (Ohayo gozaimasu)", "value": "morning" }, { "name": "Afternoon (Konnichiwa)", "value": "afternoon" }, { "name": "Evening (Konbanwa)", "value": "evening" }, { "name": "First meeting (Hajimemashite)", "value": "first" }, { "name": "Casual (Genki?)", "value": "casual" }, { "name": "Random", "value": "random" }], "name": "style", "description": "Greeting style", "required": false }], "name": "hello", "description": "Greets a user in Japanese!", "type": 1 },
    async execute(interaction, env) {
        // const targetUser = interaction.options.getUser('user') || interaction.user;
        // const style = interaction.options.getString('style') || 'random';
        // const targetUser = interaction.member.user.global_name || interaction.member.user.username;
        const targetUser = interaction.data.options?.find((o) => o.name === 'user')?.value || interaction.member.user.global_name || interaction.member.user.username;
        const userFetchRawRequest = {
            method: 'GET',
            url: `https://discord.com/api/v10/users/${targetUser}`,
            headers: {
                'Authorization': `Bot ${env.BOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };
        const userResponse = await fetch(userFetchRawRequest.url, {
            method: userFetchRawRequest.method,
            headers: userFetchRawRequest.headers
        });
        if (!userResponse.ok) {
            console.error('Failed to fetch user data:', userResponse.status, await userResponse.text());
        }
        else {
            const userData = await userResponse.json();
            // console.log('Fetched user data:', userData);
            if (!interaction.data.options) {
                return { type: 4, data: { content: `Konnichiwa, ${userData.username}-san! ☀️` } };
            }
            const style = interaction.data.options.find((o) => o.name === 'style')?.value || 'random';
            const greetings = {
                morning: `Ohayo gozaimasu, ${userData.username}-san! 🌅`,
                afternoon: `Konnichiwa, ${userData.username}-san! ☀️`,
                evening: `Konbanwa, ${userData.username}-san! 🌙`,
                first: `Hajimemashite, ${userData.username}-san! Douzo yoroshiku onegaishimasu! 🙇‍♂️`,
                casual: `Genki desu ka, ${userData.username}-san? 😊`,
            };
            let greeting;
            if (style === 'random') {
                const randomGreetings = [
                    `Konnichiwa, ${userData.username}-san! ☀️`,
                    `Ohayo gozaimasu, ${userData.username}-san! 🌅`,
                    `Konbanwa, ${userData.username}-san! 🌙`,
                    `Hajimemashite, ${userData.username}-san! Douzo yoroshiku! 🙇‍♂️`,
                    `Genki desu ka, ${userData.username}-san? 😊`,
                    `Ogenki desu ka, ${userData.username}-san? 🌸`,
                    `Otsukaresama desu, ${userData.username}-san! 💪`,
                    `Arigatou gozaimasu, ${userData.username}-san! 🙏`,
                    `Sumimasen, ${userData.username}-san! Douzo yoroshiku! 😌`
                ];
                const randomIndex = Math.floor(Math.random() * randomGreetings.length);
                greeting = randomGreetings[randomIndex];
            }
            else {
                greeting = greetings[style] || greetings.afternoon;
            }
            // await interaction.reply(greeting);
            return { type: 4, data: { content: greeting } };
        }
        return { type: 4, data: { content: `Hello, ${targetUser}!` } };
    },
};
export default hello;
