/**
 * Context preserved through the ACCOUNT_AWAITING_ACTIVATION signal so the
 * activation dialog can resubmit against the same host/user without re-entering them.
 */
export interface PendingActivationContext {
  host: string;
  port: string;
  userName: string;
}

export interface LoginSuccessContext {
  hashedPassword?: string;
  missingFeatures?: string[];
}
