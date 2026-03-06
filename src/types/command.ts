import { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import { Bindings } from 'hono/types';
import { Interaction } from './Interaction';
import { InteractionResponse } from './InteractionResponse';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: Interaction, env: Bindings) => Promise<InteractionResponse>;
}