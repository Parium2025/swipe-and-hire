/**
 * RED → GREEN: provider-lokal, generationsbaserad kontoauktoritet.
 *
 * En modulglobal `user.id`-sträng räcker inte: den kan inte skilja på
 *  - A → B (id skiljer, men pre-commit-fönstret saknar auktoritet),
 *  - A → utloggning → samma A (samma id, ny session),
 *  - en avmonterad provider vars svar landar efter att en ny provider med
 *    samma A-id monterats.
 *
 * Auktoriteten måste därför vara en oföränderlig token (ägare + generation)
 * som är unik per övergång och per provider-instans.
 */
import { describe, it, expect } from 'vitest';
import { createAccountAuthority } from '@/lib/accountAuthority';

describe('createAccountAuthority', () => {
  it('ger ny generation vid varje övergång — även till samma ägare', () => {
    const authority = createAccountAuthority();
    const a1 = authority.advance('A');
    const a2 = authority.advance('A');

    expect(a1.ownerId).toBe('A');
    expect(a2.ownerId).toBe('A');
    expect(a2.generation).not.toBe(a1.generation);
    expect(authority.isCurrent(a1)).toBe(false);
    expect(authority.isCurrent(a2)).toBe(true);
  });

  it('avvisar token efter A → B, inklusive före commit av B', () => {
    const authority = createAccountAuthority();
    const tokenA = authority.advance('A');
    authority.advance('B');

    expect(authority.isCurrent(tokenA)).toBe(false);
    expect(authority.isCurrent(tokenA, 'A')).toBe(false);
  });

  it('avvisar token efter A → utloggning → samma A', () => {
    const authority = createAccountAuthority();
    const tokenA = authority.advance('A');
    authority.advance(null);
    const tokenA2 = authority.advance('A');

    expect(authority.isCurrent(tokenA)).toBe(false);
    expect(authority.isCurrent(tokenA2)).toBe(true);
  });

  it('två provider-instanser med samma ägare delar aldrig auktoritet', () => {
    const first = createAccountAuthority();
    const second = createAccountAuthority();
    const tokenFirst = first.advance('A');
    const tokenSecond = second.advance('A');

    expect(second.isCurrent(tokenFirst)).toBe(false);
    expect(first.isCurrent(tokenSecond)).toBe(false);
    expect(second.isCurrent(tokenSecond)).toBe(true);
  });

  it('invalidate (unmount) gör alla tokens ogiltiga', () => {
    const authority = createAccountAuthority();
    const token = authority.advance('A');
    authority.invalidate();

    expect(authority.isCurrent(token)).toBe(false);
    expect(authority.isCurrent(authority.current)).toBe(false);
  });

  it('kräver exakt ägarmatchning när förväntad ägare anges', () => {
    const authority = createAccountAuthority();
    const token = authority.advance('A');

    expect(authority.isCurrent(token, 'A')).toBe(true);
    expect(authority.isCurrent(token, 'B')).toBe(false);
    expect(authority.isCurrent(null)).toBe(false);
    expect(authority.isCurrent(undefined)).toBe(false);
  });
});
