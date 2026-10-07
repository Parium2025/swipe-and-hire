import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('sentence punctuation in shared UI', () => {
  for (const file of ['AuthDesktop', 'AuthTablet', 'AuthMobile']) {
    it(`preserves descriptive punctuation in ${file}`, () => {
      const source = read(`src/components/${file}.tsx`);
      expect(source).toContain('Vänligen ange företagsnamn.');
      expect(source).toContain('Vänligen välj bransch.');
      expect(source).toContain('Lösenordet måste vara minst 7 tecken (bokstäver, siffror eller tecken).');
    });
  }

  it('punctuates both chat search and conversation empty descriptions, not headings', () => {
    const source = read('src/components/messages/EmptyStates.tsx');
    expect(source).toContain('Prova ett annat sökord.');
    expect(source).toContain('Starta en konversation med en kandidat eller kollega.');
    expect(source).toContain("'Inga resultat'");
    expect(source).not.toContain("'Inga resultat.'");
  });

  it('punctuates account-independent offline descriptions', () => {
    expect(read('src/hooks/useOnlineStatus.ts')).toContain('Kontrollera din internetanslutning och försök igen.');
    expect(read('src/hooks/useDeleteConversation.ts')).toContain('Anslut till internet för att radera konversationen.');
    expect(read('src/hooks/useOfflineProfileQueue.ts')).toContain('Dina köade profiländringar har sparats.');
  });

  it('punctuates both personal and colleague candidate-list descriptions', () => {
    const source = read('src/pages/myCandidates/MyCandidatesHeader.tsx');
    expect(source).toContain('dra kandidater mellan steg.');
    expect(source).toContain('du kan flytta och ta bort kandidater.');
  });
});