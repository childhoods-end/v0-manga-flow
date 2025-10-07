// Plan limits
export const PLAN_LIMITS = {
  free: {
    maxProjects: parseInt(process.env.FREE_TIER_MAX_PROJECTS || '3'),
    maxPagesPerProject: parseInt(process.env.FREE_TIER_MAX_PAGES_PER_PROJECT || '50'),
    maxConcurrentJobs: parseInt(process.env.FREE_TIER_MAX_CONCURRENT_JOBS || '2'),
    creditsPerMonth: 100,
  },
  pro: {
    maxProjects: 50,
    maxPagesPerProject: 500,
    maxConcurrentJobs: 10,
    creditsPerMonth: 1000,
  },
  enterprise: {
    maxProjects: -1, // unlimited
    maxPagesPerProject: -1,
    maxConcurrentJobs: 50,
    creditsPerMonth: 10000,
  },
}

// OCR confidence threshold
export const OCR_CONFIDENCE_THRESHOLD = 0.7

// Translation providers
export const TRANSLATION_PROVIDERS = ['claude', 'openai', 'deepl'] as const
export type TranslationProvider = typeof TRANSLATION_PROVIDERS[number]

// OCR providers
export const OCR_PROVIDERS = ['tesseract', 'google-vision'] as const
export type OCRProvider = typeof OCR_PROVIDERS[number]

// Supported languages
export const SUPPORTED_LANGUAGES = {
  ja: 'Japanese',
  en: 'English',
  zh: 'Chinese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
}

// Job retry configuration
export const JOB_RETRY_CONFIG = {
  maxAttempts: 3,
  delayMs: 2000,
  backoff: true,
}

// Content ratings
export const CONTENT_RATINGS = {
  general: { minAge: 0, label: 'General Audiences' },
  teen: { minAge: 13, label: 'Teen (13+)' },
  mature: { minAge: 16, label: 'Mature (16+)' },
  explicit: { minAge: 18, label: 'Explicit (18+)' },
}

// Admin email list
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean)
