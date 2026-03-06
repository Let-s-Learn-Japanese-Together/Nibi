export interface InteractionResponse {
  type: number;
  data?: {
    content?: string;
    embeds?: any[];
    flags?: number;
    components?: any[];
    custom_id?: string;
    title?: string;
  };
}