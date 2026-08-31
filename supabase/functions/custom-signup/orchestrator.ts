export interface SignupIdentityResult {
  userId: string | null;
  existing?: boolean;
  errorCode?: string;
}

export interface SignupConfirmationResult<TDelivery> {
  delivery: TDelivery | null;
  errorCode?: string;
}

export interface DurableSignupDependencies<TDelivery> {
  reserveRateLimit: () => Promise<boolean>;
  createIdentity: () => Promise<SignupIdentityResult>;
  issueConfirmation: (
    userId: string,
  ) => Promise<SignupConfirmationResult<TDelivery>>;
  reportFailure: (
    stage: "identity" | "confirmation" | "unexpected",
    code: string,
  ) => void;
}

/**
 * Runs only the durable signup steps. Mail delivery is intentionally absent:
 * callers may schedule it only after this function returns a delivery job.
 */
export async function runDurableSignup<TDelivery>(
  dependencies: DurableSignupDependencies<TDelivery>,
): Promise<TDelivery | null> {
  try {
    if (!await dependencies.reserveRateLimit()) return null;

    const identity = await dependencies.createIdentity();
    if (!identity.userId) {
      if (!identity.existing) {
        dependencies.reportFailure(
          "identity",
          identity.errorCode ?? "missing_user_id",
        );
      }
      return null;
    }

    const confirmation = await dependencies.issueConfirmation(identity.userId);
    if (!confirmation.delivery) {
      dependencies.reportFailure(
        "confirmation",
        confirmation.errorCode ?? "confirmation_unavailable",
      );
      return null;
    }

    return confirmation.delivery;
  } catch (error: unknown) {
    dependencies.reportFailure(
      "unexpected",
      error instanceof Error ? error.name : "UnknownError",
    );
    return null;
  }
}
