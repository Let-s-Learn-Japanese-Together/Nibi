/** Environment variable bindings available via `c.env` in Hono handlers. */
export interface AppBindings {
  PUBLIC_KEY: string;
  BOT_TOKEN: string;
  DISCORD_BOT_TOKEN?: string;
  APP_ID: string;
  GUILD_ID: string;
  VERIFIED_ROLE_ID?: string;

  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;

  EMAIL_USER: string;
  EMAIL_PASSWORD: string;
  EMAIL_HOST: string;
  EMAIL_PORT: string | number;
  EMAIL_SECURE: string;
  EMAIL_FROM: string;
  EMAIL_HASH: string;
  EMAIL_TLS_INSECURE?: string;
  ENVIRONMENT?: string;

  [key: string]: unknown;
}
