"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: process.cwd() + "/.env" });
exports.config = {
    discord: {
        token: process.env.BOT_TOKEN,
        clientId: process.env.APP_ID || "1343500351575425065",
        guildId: process.env.GUILD_ID || "1427259865121820716",
    },
    email: {
        host: process.env.EMAIL_HOST || "ssl0.ovh.net",
        port: parseInt(process.env.EMAIL_PORT || "465"),
        secure: process.env.EMAIL_SECURE === "true" || true, // true for 465, false for other ports
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD,
        from: process.env.EMAIL_FROM,
    },
    hash: process.env.HASH || "default_salt",
    environment: process.env.NODE_ENV || "development",
};
// Validate required environment variables
if (!exports.config.discord.token) {
    throw new Error("BOT_TOKEN is required");
}
if (!exports.config.discord.clientId) {
    throw new Error("APP_ID is required");
}
if (!exports.config.email.user) {
    throw new Error("EMAIL_USER is required");
}
if (!exports.config.email.password) {
    throw new Error("EMAIL_PASSWORD is required");
}
if (!exports.config.email.from) {
    throw new Error("EMAIL_FROM is required");
}
