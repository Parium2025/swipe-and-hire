import { beforeEach, describe, expect, it } from 'vitest';
import { companyCardsReady, readCompanyCardCache, readCompanyOwnerCache } from '../companyCardCache';

describe('complete account-scoped company cards', () => {
  const key = 'parium-company-cards:v2:account-a';
  const card = { id: 'owner', name: 'Company', jobCount: 14, avgRating: 3.7, reviewCount: 3, selectedNames: ['Company'] };
  beforeEach(() => localStorage.clear());

  it.each([null, [], 'old format', { Company: { ...card, avgRating: '3.7' } }, { Company: { ...card, selectedNames: {} } }, { Company: { ...card, jobCount: -1 } }])('removes malformed cached values %j', (value) => {
    localStorage.setItem(key, JSON.stringify(value));
    expect(readCompanyCardCache(key)).toEqual({});
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('restores complete data only for the active account and accepts confirmed zero jobs', () => {
    localStorage.setItem(key, JSON.stringify({ Company: card, Closed: { ...card, jobCount: 0 } }));
    expect(readCompanyCardCache(key).Company).toEqual(card);
    expect(readCompanyCardCache(key).Closed.jobCount).toBe(0);
    expect(readCompanyCardCache('parium-company-cards:v2:account-b')).toEqual({});
  });

  it('does not accept a rating count without its average', () => {
    localStorage.setItem(key, JSON.stringify({ Company: { ...card, avgRating: undefined } }));
    expect(readCompanyCardCache(key)).toEqual({});
  });

  it('validates the canonical owner map', () => {
    localStorage.setItem('owners', JSON.stringify({ colleague: '' }));
    expect(readCompanyOwnerCache('owners')).toEqual({});
    expect(localStorage.getItem('owners')).toBeNull();
    localStorage.setItem('owners', JSON.stringify({ colleague: 'owner' }));
    expect(readCompanyOwnerCache('owners')).toEqual({ colleague: 'owner' });
  });

  it('waits for every independent fetch instead of trusting positive job counts', () => {
    expect(companyCardsReady(false, true, true, true)).toBe(true);
    expect(companyCardsReady(true, true, true, true)).toBe(false);
    expect(companyCardsReady(false, false, true, true)).toBe(false);
    expect(companyCardsReady(false, true, false, true)).toBe(false);
    expect(companyCardsReady(false, true, true, false)).toBe(false);
  });
});