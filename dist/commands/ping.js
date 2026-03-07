"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = void 0;
const ping = {
    data: {
        name: "ping",
        description: "Replies with Pong!",
    },
    execute: async function () {
        return { type: 4, data: { content: "Pong!" } };
    },
};
// const data = ping.data.toJSON();
const execute = ping.execute;
exports.execute = execute;
