// Hitta en auth-användare via e-post – med korrekt paginering.
//
// `auth.admin.listUsers()` returnerar som standard endast de 50 första
// användarna. Att söka i den listan fungerar därför bara i ett nystartat
// projekt: så fort användarantalet växer "försvinner" befintliga konton,
// vilket bryter t.ex. återsändning av bekräftelsemejl och admin-radering.
// Den här hjälparen bläddrar igenom alla sidor tills träff eller slut.

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
  admin: AdminClient,
  email: string,
): Promise<AuthUserLike | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) throw new Error(error.message)
    const users = data?.users ?? []
    const match = users.find((u) => u.email?.toLowerCase() === normalized)
    if (match) return match
    if (users.length < PER_PAGE) return null
  }
  return null
}
