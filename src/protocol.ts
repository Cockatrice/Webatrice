export const PROTOCOL_VERSION = 14;

// Features whose support is determined by sockatrice's command/event handlers.
// Consumers spread this and add identity + policy declarations on top.
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
