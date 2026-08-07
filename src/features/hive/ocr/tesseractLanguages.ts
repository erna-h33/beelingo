/**
 * Maps our internal language codes to Tesseract.js's trained-data
 * language codes. Each one is a separate ~1-15MB download, lazy-loaded
 * by tesseract.js itself from its default CDN the first time a class
 * needs it (see docs/architecture.md: "never bundled into the app
 * build"), and browser-cached after that.
 */
export const TESSERACT_LANGUAGE_CODE: Record<string, string> = {
  en: "eng",
  "pt-BR": "por",
  "pt-PT": "por",
  es: "spa",
  fr: "fra",
  de: "deu",
  it: "ita",
  nl: "nld",
  ja: "jpn",
  ko: "kor",
  "zh-Hans": "chi_sim",
  "zh-Hant": "chi_tra",
  ru: "rus",
  ar: "ara",
  hi: "hin",
}
