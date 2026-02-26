export interface SupportedLanguage {
  code: string;
  name: string;
  flag: string;
  locales: string[];
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', flag: '\u{1F1FA}\u{1F1F8}', locales: ['en', 'en-US', 'en-GB', 'en-CA', 'en-AU'] },
  { code: 'hi', name: 'Hindi', flag: '\u{1F1EE}\u{1F1F3}', locales: ['hi', 'hi-IN'] },
  { code: 'es', name: 'Spanish', flag: '\u{1F1EA}\u{1F1F8}', locales: ['es', 'es-ES', 'es-MX', 'es-419'] },
  { code: 'fr', name: 'French', flag: '\u{1F1EB}\u{1F1F7}', locales: ['fr', 'fr-FR', 'fr-CA'] },
  { code: 'de', name: 'German', flag: '\u{1F1E9}\u{1F1EA}', locales: ['de', 'de-DE', 'de-AT', 'de-CH'] },
  { code: 'it', name: 'Italian', flag: '\u{1F1EE}\u{1F1F9}', locales: ['it', 'it-IT'] },
  { code: 'pt', name: 'Portuguese', flag: '\u{1F1F5}\u{1F1F9}', locales: ['pt', 'pt-PT', 'pt-BR'] },
  { code: 'ru', name: 'Russian', flag: '\u{1F1F7}\u{1F1FA}', locales: ['ru', 'ru-RU', 'ru-UA'] },
  { code: 'ja', name: 'Japanese', flag: '\u{1F1EF}\u{1F1F5}', locales: ['ja', 'ja-JP'] },
  { code: 'ko', name: 'Korean', flag: '\u{1F1F0}\u{1F1F7}', locales: ['ko', 'ko-KR'] },
  { code: 'zh', name: 'Chinese', flag: '\u{1F1E8}\u{1F1F3}', locales: ['zh', 'zh-CN', 'zh-TW', 'zh-HK'] }
];

const LANGUAGE_MAP: Record<string, string> = SUPPORTED_LANGUAGES.reduce((acc, lang) => {
  acc[lang.code.toLowerCase()] = lang.code;
  for (const locale of lang.locales) {
    acc[locale.toLowerCase()] = lang.code;
  }
  return acc;
}, {} as Record<string, string>);

const DEFAULT_LANGUAGE = 'en';
const STORAGE_KEY = 'preferredLanguage';

export class LanguageDetector {
  static getUserPreferredLanguage(): string {
    const stored = LanguageDetector.getStoredLanguage();
    if (stored) {
      return stored;
    }

    const browserLanguage = LanguageDetector.detectBrowserLanguage();
    if (browserLanguage) {
      return browserLanguage;
    }

    return DEFAULT_LANGUAGE;
  }

  static setUserPreferredLanguage(language: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    const normalized = LanguageDetector.normalizeLanguage(language);
    if (!normalized) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch (error) {
      console.warn('Unable to persist language preference:', error);
    }
  }

  static detectBrowserLanguage(): string | null {
    if (typeof navigator === 'undefined') {
      return null;
    }

    const languages = Array.from(
      new Set<string>([
        navigator.language,
        ...(Array.isArray(navigator.languages) ? navigator.languages : [])
      ].filter(Boolean) as string[])
    );

    for (const lang of languages) {
      const normalized = LanguageDetector.normalizeLanguage(lang);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private static getStoredLanguage(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return null;
      }
      return LanguageDetector.normalizeLanguage(stored);
    } catch (error) {
      console.warn('Unable to read stored language preference:', error);
      return null;
    }
  }

  private static normalizeLanguage(language: string | null | undefined): string | null {
    if (!language) {
      return null;
    }

    const lookup = LANGUAGE_MAP[language.toLowerCase()];
    return lookup || null;
  }
}

export type { SupportedLanguage as LanguageOption };
