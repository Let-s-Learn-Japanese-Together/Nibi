export interface InteractionResponse {
  type: number;
  data?: {
    content?: string;
    embeds?: any[];
    flags?: number;
  };
}