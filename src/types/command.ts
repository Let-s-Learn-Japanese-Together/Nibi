import { Bindings } from "hono/types";
import { Interaction } from "./Interaction";
import { InteractionResponse } from "./InteractionResponse";

export interface CommandExecute {
  execute: (
    interaction: Interaction,
    env: Bindings,
  ) => Promise<InteractionResponse>;
}

export interface Command extends CommandExecute {
  data: {
    name: string;
    description: string;
    type?: number;
    options?: unknown[];
  };
}
