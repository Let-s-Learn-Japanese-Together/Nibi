import { Command } from "../types/command";

const ping: Command = {
  data: {
    name: "ping",
    description: "Replies with Pong!",
  },

  execute: async function (_interaction, _env) {
    return { type: 4, data: { content: "Pong!" } };
  },
};

// const data = ping.data.toJSON();
const execute = ping.execute;

export { execute };
