// Exact email lookup uses the protected indexed RPC, not a scan of all accounts.
// Full pagination is retained only for scheduled account-retention processing.

type AdminClient = {
  auth: {
    admin: {
      listUsers: (params?: { page?: number; perPage?: number }) => Promise<{
        data: { users?: AuthUserLike[] } | null
        error: { message: string } | null
      }>
    }
  }
}

export interface AuthUserLike {
  id: string
  email?: string | null
  created_at?: string
  last_sign_in_at?: string | null
  email_confirmed_at?: string | null
  user_metadata?: Record<string, unknown>
}

const PER_PAGE = 1000
const MAX_PAGES = 1000 // säkerhetsspärr (≈1M konton)

/** Itererar över samtliga auth-användare, sida för sida. */
export async function forEachAuthUser(
  admin: AdminClient,
  handler: (user: AuthUserLike) => void | Promise<void>,
): Promise<void> {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) throw new Error(error.message)
    const users = data?.users ?? []
    for (const user of users) {
      await handler(user)
    }
    if (users.length < PER_PAGE) return
  }
}

/** Returnerar användaren med angiven e-post, eller null. */
export async function findUserByEmail(
  admin: {
    rpc: (name: string, args: { _email: string }) => PromiseLike<{
      data: { user_id: string }[] | null;
      error: { message: string } | null;
    }>;
    auth: { admin: { getUserById: (id: string) => Promise<{
      data: { user: AuthUserLike | null };
      error: { message: string } | null;
    }> } };
  },
  email: string,
): Promise<AuthUserLike | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const { data: matches, error: lookupError } = await admin.rpc('lookup_auth_email_for_resend', { _email: normalized });
  if (lookupError) throw new Error(lookupError.message);
  const match = matches?.[0];
  if (!match) return null;
  const { data, error } = await admin.auth.admin.getUserById(match.user_id);
  if (error) throw new Error(error.message);
  return data.user?.email?.trim().toLowerCase() === normalized ? data.user : null;
}
