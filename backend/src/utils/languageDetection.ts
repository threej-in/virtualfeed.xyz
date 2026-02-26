import { logger } from '../services/logger';

// Language detection patterns
const LANGUAGE_PATTERNS = {
  // Hindi and related languages
  hindi: {
    patterns: [
      /[\u0900-\u097F]/, // Devanagari script
      /\b(है|हैं|का|की|के|में|पर|से|को|और|या|लेकिन|कि|जो|क्या|कौन|कहाँ|कब|कैसे|क्यों)\b/,
      /\b(नहीं|हाँ|बिल्कुल|ज़रूर|शायद|बहुत|थोड़ा|कम|ज्यादा|अच्छा|बुरा|बड़ा|छोटा)\b/
    ],
    keywords: ['hindi', 'hindustani', 'urdu', 'punjabi', 'gujarati', 'marathi', 'bengali']
  },
  
  // Arabic and related languages
  arabic: {
    patterns: [
      /[\u0600-\u06FF]/, // Arabic script
      /[\u0750-\u077F]/, // Arabic Supplement
      /[\u08A0-\u08FF]/, // Arabic Extended-A
      /\b(ال|في|من|إلى|على|هذا|هذه|التي|الذي|كان|ليس|أو|و|لكن|إذا|عندما|كيف|لماذا|أين|متى)\b/
    ],
    keywords: ['arabic', 'urdu', 'persian', 'farsi', 'hebrew']
  },
  
  // Chinese languages
  chinese: {
    patterns: [
      /[\u4E00-\u9FFF]/, // CJK Unified Ideographs
      /[\u3400-\u4DBF]/, // CJK Unified Ideographs Extension A
      /\b(的|是|在|有|和|了|我|你|他|她|它|我们|你们|他们|这个|那个|什么|怎么|为什么|哪里|什么时候)\b/
    ],
    keywords: ['chinese', 'mandarin', 'cantonese', 'simplified', 'traditional']
  },
  
  // Japanese
  japanese: {
    patterns: [
      /[\u3040-\u309F]/, // Hiragana
      /[\u30A0-\u30FF]/, // Katakana
      /[\u4E00-\u9FFF]/, // Kanji
      /\b(は|が|を|に|へ|で|と|から|まで|より|の|に|も|や|か|が|けど|でも|そして|それから)\b/
    ],
    keywords: ['japanese', 'nihongo']
  },
  
  // Korean
  korean: {
    patterns: [
      /[\uAC00-\uD7AF]/, // Hangul Syllables
      /[\u1100-\u11FF]/, // Hangul Jamo
      /[\u3130-\u318F]/, // Hangul Compatibility Jamo
      /\b(은|는|이|가|을|를|에|에서|로|으로|와|과|하고|그리고|하지만|그런데|그래서|왜냐하면|어디|언제|어떻게|왜)\b/
    ],
    keywords: ['korean', 'hangul']
  },
  
  // Russian and Cyrillic
  russian: {
    patterns: [
      /[\u0400-\u04FF]/, // Cyrillic
      /\b(и|в|на|с|по|для|от|до|из|за|под|над|между|через|вокруг|внутри|снаружи|вверху|внизу|спереди|сзади)\b/
    ],
    keywords: ['russian', 'ukrainian', 'belarusian', 'bulgarian', 'serbian']
  },
  
  // Spanish
  spanish: {
    patterns: [
      /\b(el|la|los|las|un|una|unos|unas|y|o|pero|si|no|que|como|cuando|donde|por|para|con|sin|sobre|bajo|entre|detrás|delante|encima|debajo)\b/
    ],
    keywords: ['spanish', 'español', 'castellano', 'latino']
  },
  
  // French
  french: {
    patterns: [
      /\b(le|la|les|un|une|des|et|ou|mais|si|non|que|comme|quand|où|pour|avec|sans|sur|sous|entre|derrière|devant|dessus|dessous)\b/
    ],
    keywords: ['french', 'français', 'francais']
  },
  
  // German
  german: {
    patterns: [
      /\b(der|die|das|ein|eine|und|oder|aber|wenn|nicht|wie|wann|wo|für|mit|ohne|auf|unter|zwischen|hinter|vor|über|unter)\b/
    ],
    keywords: ['german', 'deutsch']
  },
  
  // Portuguese
  portuguese: {
    patterns: [
      /\b(o|a|os|as|um|uma|uns|umas|e|ou|mas|se|não|que|como|quando|onde|para|com|sem|sobre|sob|entre|atrás|na frente|em cima|embaixo)\b/
    ],
    keywords: ['portuguese', 'português', 'portugues']
  },
  
  // Italian
  italian: {
    patterns: [
      /\b(il|la|i|gli|le|un|una|e|o|ma|se|non|che|come|quando|dove|per|con|senza|su|sotto|tra|dietro|davanti|sopra|sotto)\b/
    ],
    keywords: ['italian', 'italiano']
  }
};

// Common English words to help identify English content
const ENGLISH_WORDS = [
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall'
];

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  detectedBy: 'patterns' | 'keywords' | 'fallback';
}

export class LanguageDetector {
  static normalizeVideoLanguageFilter(language: string | undefined | null): string | undefined {
    if (!language) return undefined;

    const normalized = language.toLowerCase().trim();
    if (!normalized || normalized === 'all') return 'all';

    const map: Record<string, string> = {
      en: 'english',
      english: 'english',
      hi: 'hindi',
      hindi: 'hindi',
      ar: 'arabic',
      arabic: 'arabic',
      zh: 'chinese',
      chinese: 'chinese',
      ja: 'japanese',
      japanese: 'japanese',
      ko: 'korean',
      korean: 'korean',
      ru: 'russian',
      russian: 'russian',
      es: 'spanish',
      spanish: 'spanish',
      fr: 'french',
      french: 'french',
      de: 'german',
      german: 'german',
      pt: 'portuguese',
      portuguese: 'portuguese',
      it: 'italian',
      italian: 'italian',
    };

    return map[normalized] || 'english';
  }

  /**
   * Detect the primary language of text content
   */
  static detectLanguage(text: string): LanguageDetectionResult {
    if (!text || text.trim().length === 0) {
      return { language: 'unknown', confidence: 0, detectedBy: 'fallback' };
    }

    const normalizedText = text.toLowerCase().trim();
    let bestMatch: LanguageDetectionResult = { language: 'unknown', confidence: 0, detectedBy: 'fallback' };

    // Check for specific language patterns
    for (const [language, config] of Object.entries(LANGUAGE_PATTERNS)) {
      let score = 0;
      let patternMatches = 0;
      let keywordMatches = 0;

      // Check pattern matches
      for (const pattern of config.patterns) {
        if (pattern.test(normalizedText)) {
          patternMatches++;
          score += 10; // High weight for script detection
        }
      }

      // Check keyword matches
      for (const keyword of config.keywords) {
        if (normalizedText.includes(keyword)) {
          keywordMatches++;
          score += 5; // Medium weight for keyword matches
        }
      }

      // Calculate confidence based on matches
      const confidence = Math.min(100, score);
      
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          language,
          confidence,
          detectedBy: patternMatches > 0 ? 'patterns' : keywordMatches > 0 ? 'keywords' : 'fallback'
        };
      }
    }

    // If no specific language detected, check for English
    if (bestMatch.language === 'unknown') {
      const englishWords = ENGLISH_WORDS.filter(word => 
        normalizedText.includes(` ${word} `) || 
        normalizedText.startsWith(`${word} `) || 
        normalizedText.endsWith(` ${word}`)
      );
      
      if (englishWords.length > 0) {
        bestMatch = {
          language: 'english',
          confidence: Math.min(100, englishWords.length * 5),
          detectedBy: 'keywords'
        };
      }
    }

    return bestMatch;
  }

  /**
   * Detect language from video metadata (title, description, tags)
   */
  static detectVideoLanguage(videoData: {
    title?: string;
    description?: string;
    tags?: string[];
  }): LanguageDetectionResult {
    const textToAnalyze = [
      videoData.title || '',
      videoData.description || '',
      ...(videoData.tags || [])
    ].join(' ');

    return this.detectLanguage(textToAnalyze);
  }

  /**
   * Get browser language from Accept-Language header
   */
  static getBrowserLanguage(acceptLanguage: string): string {
    if (!acceptLanguage) return 'en';

    // Parse Accept-Language header
    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const [language, quality = '1'] = lang.trim().split(';q=');
        return {
          language: language.split('-')[0], // Get primary language code
          quality: parseFloat(quality)
        };
      })
      .sort((a, b) => b.quality - a.quality);

    return languages[0]?.language || 'en';
  }

  /**
   * Map browser language to supported video languages
   */
  static mapBrowserLanguageToVideoLanguage(browserLang: string): string {
    const languageMap: { [key: string]: string } = {
      'en': 'english',
      'hi': 'hindi',
      'ar': 'arabic',
      'zh': 'chinese',
      'ja': 'japanese',
      'ko': 'korean',
      'ru': 'russian',
      'es': 'spanish',
      'fr': 'french',
      'de': 'german',
      'pt': 'portuguese',
      'it': 'italian',
      'ur': 'hindi', // Urdu videos often mixed with Hindi
      'bn': 'hindi', // Bengali often mixed with Hindi content
      'pa': 'hindi', // Punjabi often mixed with Hindi content
      'gu': 'hindi', // Gujarati often mixed with Hindi content
      'mr': 'hindi', // Marathi often mixed with Hindi content
      'fa': 'arabic', // Persian/Farsi
      'he': 'arabic', // Hebrew
      'uk': 'russian', // Ukrainian
      'be': 'russian', // Belarusian
      'bg': 'russian', // Bulgarian
      'sr': 'russian', // Serbian
    };

    return languageMap[browserLang] || 'english';
  }
} 
