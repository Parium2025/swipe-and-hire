/** Shared limits for short, single-line identity and title fields. */
export const TEXT_LIMITS = {
  jobTitle: 160,
  templateName: 100,
  personName: 60,
  companyName: 120,
  location: 120,
  address: 160,
  website: 200,
  phone: 30,
  bio: 1500,
  companyDescription: 3000,
  supportMessage: 5000,
} as const;
