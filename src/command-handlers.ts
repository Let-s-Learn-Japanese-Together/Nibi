import { writeJson } from './utils/databaseUtils';

// helper for greetings used by the "hello" command
function buildGreeting(target: string, style: string): string {
  const greetings: Record<string, string> = {
    morning: `Ohayo gozaimasu, ${target}-san! 🌅`,
    afternoon: `Konnichiwa, ${target}-san! ☀️`,
    evening: `Konbanwa, ${target}-san! 🌙`,
    first: `Hajimemashite, ${target}-san! Douzo yoroshiku onegaishimasu! 🙇‍♂️`,
    casual: `Genki desu ka, ${target}-san? 😊`,
  };

  if (style === 'random') {
    const list = Object.values(greetings);
    return list[Math.floor(Math.random() * list.length)];
  }
  return greetings[style] || greetings.afternoon;
}

// generic interaction response helpers
function makeResponse(content: string, ephemeral = false) {
  const res: any = { type: 4, data: { content } };
  if (ephemeral) res.data.flags = 64;
  return res;
}

export const commandHandlers: Record<string, (interaction: any) => Promise<any>> = {
  hello: async (interaction) => {
    const options = interaction.data.options || [];
    const userOption = options.find((o: any) => o.name === 'user')?.value;
    const style = options.find((o: any) => o.name === 'style')?.value || 'random';
    const target = userOption || interaction.member?.user?.username || 'there';
    const greeting = buildGreeting(target, style as string);
    return makeResponse(greeting);
  },

  'send-verification-code': async (interaction) => {
    const email = interaction.data.options?.find((o: any) => o.name === 'email')?.value;
    if (!email) {
      return makeResponse('Adresse e-mail manquante.', true);
    }

    // simple code generation
    function seededCode(str: string) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) % 1000000;
      }
      return 100000 + (hash % 900000);
    }

    const code = seededCode(email + (process.env.HASH || ''));

    // persist code by user id
    const userId = interaction.member?.user?.id || interaction.user?.id;
    await writeJson(`verification:${userId}`, { email, code });

    // NOTE: Cloudflare Workers cannot send SMTP emails directly. In
    // production you could trigger an external service or Supabase function
    // to deliver the message. Here we simply inform the user that the code
    // has been stored and should be emailed by a separate process.

    return makeResponse(
      "Votre code a été enregistré. utilisez un service externe pour l'envoyer.",
      true
    );
  },

  // other commands can be added here following the same pattern
};
