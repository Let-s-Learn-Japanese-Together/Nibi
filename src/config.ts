import dotenv from "dotenv";
dotenv.config({path: process.cwd() + '/.env'});

export const config = {
  discord: {
    token: process.env.BOT_TOKEN as string,
    clientId: process.env.APP_ID as string || "1343500351575425065",
    guildId: process.env.GUILD_ID as string || '1427259865121820716',
  },
  email: {
    host: process.env.EMAIL_HOST || 'ssl0.ovh.net',
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: process.env.EMAIL_SECURE === 'true' || true, // true for 465, false for other ports
    user: process.env.EMAIL_USER as string,
    password: process.env.EMAIL_PASSWORD as string,
    from: process.env.EMAIL_FROM as string,
  },
  hash: process.env.HASH || 'default_salt',
  environment: process.env.NODE_ENV || 'development',
};

// Validate required environment variables
if (!config.discord.token) {
  throw new Error('BOT_TOKEN is required');
}

if (!config.discord.clientId) {
  throw new Error('APP_ID is required');
}

if (!config.email.user) {
  throw new Error('EMAIL_USER is required');
}

if (!config.email.password) {
  throw new Error('EMAIL_PASSWORD is required');
}

if (!config.email.from) {
  throw new Error('EMAIL_FROM is required');
}