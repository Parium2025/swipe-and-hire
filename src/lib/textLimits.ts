/** Shared limits only for fields with a semantic or operational bound. */
export const TEXT_LIMITS = {
  personName: 60,
  address: 160,
  website: 200,
  phone: 30,
  bio: 1500,
  companyDescription: 3000,
  supportMessage: 5000,
} as const;
