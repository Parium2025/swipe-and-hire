/**
 * Provider-lokal, generationsbaserad kontoauktoritet.
 *
 * Ett `user.id` räcker inte för att avgöra om ett redan startat async-svar
 * fortfarande äger vyn: samma id kan tillhöra en tidigare session (A → utloggning
 * → samma A) eller en avmonterad provider-instans. Auktoriteten är därför en
 * oföränderlig token (ägare + unik generation) som byts vid VARJE accepterad
 * kontoövergång och ogiltigförklaras vid unmount.
 *
 * Användning:
 *   const authority = useRef(createAccountAuthority()).current;
 *   const token = authority.advance(nextUserId); // synkront före setUser
 *   ...
 *   if (!authority.isCurrent(token, ownerId)) return; // efter varje await
 */
export interface AccountAuthorityToken {
  readonly ownerId: string | null;
  readonly generation: number;
}

export interface AccountAuthority {
  /** Aktuell token (ogiltig efter invalidate). */
  readonly current: AccountAuthorityToken;
  /** Byter till ny ägare och returnerar den nya, unika token. */
  advance(ownerId: string | null): AccountAuthorityToken;
  /** Gör alla utestående tokens ogiltiga (unmount/cleanup). */
  invalidate(): void;
  /** True endast för exakt aktuell, giltig token (och rätt ägare om angiven). */
  isCurrent(token: AccountAuthorityToken | null | undefined, expectedOwnerId?: string | null): boolean;
}

let generationCounter = 0;
const nextGeneration = () => (generationCounter += 1);

export function createAccountAuthority(ownerId: string | null = null): AccountAuthority {
  let current: AccountAuthorityToken = Object.freeze({ ownerId, generation: nextGeneration() });
  let valid = true;

  return {
    get current() {
      return current;
    },
    advance(nextOwnerId: string | null) {
      current = Object.freeze({ ownerId: nextOwnerId, generation: nextGeneration() });
      valid = true;
      return current;
    },
    invalidate() {
      valid = false;
    },
    isCurrent(token, expectedOwnerId) {
      if (!valid || !token) return false;
      if (token !== current) return false;
      if (expectedOwnerId !== undefined && token.ownerId !== expectedOwnerId) return false;
      return true;
    },
  };
}
