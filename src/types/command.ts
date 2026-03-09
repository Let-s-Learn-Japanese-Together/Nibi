import { AppBindings } from "./bindings";
import { Interaction } from "./Interaction";
import { InteractionResponse } from "./InteractionResponse";

export interface CommandExecute {
  execute: (
    interaction: Interaction,
    env: AppBindings,
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
