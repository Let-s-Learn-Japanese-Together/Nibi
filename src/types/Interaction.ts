export interface Interaction {
    id: string;
    application_id: string;
    type: number;
    data: {
        id: string;
        name: string;
        type: number;
        options?: Array<Record<string, unknown>>;
    };
    guild: {
        id: string;
        locale: string;
        features: string[];
    };
    guild_id: string;
    channel: {
        id: string;
        type: number;
        name: string;
        guild_id: string;
        position: number;
        nsfw: boolean;
        rate_limit_per_user: number;
        topic: string | null;
        parent_id: string;
        permissions: string;
        flags: number;
        last_message_id?: string;
    };
    channel_id: string;
    member: {
        user: {
            id: string;
            username: string;
            global_name: string;
            avatar: string;
            discriminator: string;
            public_flags: number;
        };
        roles: string[];
        joined_at: string;
        mute: boolean;
        deaf: boolean;
        permissions: string;
        premium_since: string | null;
        pending: boolean;
        nick: string | null;
    };
    user?: Record<string, unknown>;
    token: string;
    version: number;
    app_permissions: string;
    locale: string;
    guild_locale: string;
    entitlements: Record<string, unknown>[];
    authorizing_integration_owners: Record<string, string>;
    context: number;
    attachment_size_limit: number;
    entitlement_sku_ids: unknown[];
}