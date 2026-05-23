export const PROTOCOL_VERSION = 14;

// See .github/instructions/sockatrice.instructions.md#protocol-version-and-feature-flags.
export const SOCKATRICE_FEATURES = [
  'client_id',
  'client_ver',
  'feature_set',
  'room_chat_history',
  'client_warnings',
  'forgot_password',
  'idle_client',
  'mod_log_lookup',
  'user_ban_history',
  'websocket',
] as const;
