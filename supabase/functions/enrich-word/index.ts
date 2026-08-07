// enrich-word
//
// Enriches a brand-new Hive word: DeepL for translation, Wikidata's
// Lexeme data for word type / gender / plural. Stateless -- no DB
// access, just external lookups; the client does the actual insert
// with whatever fields come back (or fills them in manually if this
// function is unavailable or a lookup fails, per the "never block
// creation" rule in docs/architecture.md).
//
// Deploy: paste this file's contents into a new Edge Function named
// "enrich-word" in the Supabase dashboard (Edge Functions -> Deploy a
// new function), then set DEEPL_API_KEY as a secret (Edge Functions ->
// Manage secrets, or Project Settings -> Edge Functions). Works fine
// without a DeepL key too -- translation is just skipped and the
// Wikidata lookup still runs on its own.
//
// This is intentionally a single self-contained file (no imports from a
// _shared/ folder) so it can be pasted into the dashboard's function
// editor directly -- no CLI or personal access token required to deploy.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Wikidata language Q-ids for the 15 supported languages (best-effort --
// pt-BR/pt-PT and zh-Hans/zh-Hant share one Wikidata language item,
// since Wikidata's lexeme system doesn't distinguish those variants).
const WIKIDATA_LANGUAGE_QID: Record<string, string> = {
  en: "Q1860",
  "pt-BR": "Q5146",
  "pt-PT": "Q5146",
  es: "Q1321",
  fr: "Q150",
  de: "Q188",
  it: "Q652",
  nl: "Q7411",
  ja: "Q5287",
  ko: "Q9176",
  "zh-Hans": "Q7850",
  "zh-Hant": "Q7850",
  ru: "Q7737",
  ar: "Q13955",
  hi: "Q1568",
};

// Common Wikidata lexicalCategory Q-ids -> word type. Not exhaustive --
// an unrecognized category is simply left blank (teacher fills it in).
const WORD_TYPE_BY_QID: Record<string, string> = {
  Q1084: "noun",
  Q24905: "verb",
  Q34698: "adjective",
  Q380057: "adverb",
  Q36224: "pronoun",
  Q4833830: "preposition",
  Q36484: "conjunction",
  Q83034: "interjection",
  Q63116: "numeral",
  Q576271: "determiner",
};

// P5185 (grammatical gender) claim value -> gender.
const GENDER_BY_QID: Record<string, string> = {
  Q499327: "masculine",
  Q1775415: "feminine",
  Q1775461: "neuter",
  Q1305037: "common",
};

const PLURAL_FEATURE_QID = "Q146786";

interface EnrichRequest {
  word: string;
  learningLanguageCode: string;
  deeplSourceCode?: string | null;
  deeplTargetCode?: string | null;
}

interface EnrichResult {
  translation: string | null;
  translationSource: "deepl" | "none";
  wordType: string | null;
  gender: string | null;
  plural: string | null;
  lexicalSource: "wikidata" | "none";
  enrichmentStatus: "success" | "partial" | "failed";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const body: EnrichRequest = await req.json();
    const word = body.word?.trim();
    if (!word) {
      return jsonResponse({ error: "word is required" }, 400);
    }

    const [translationOutcome, lexicalOutcome] = await Promise.allSettled([
      translateWord(word, body.deeplSourceCode, body.deeplTargetCode),
      lookupLexicalInfo(word, body.learningLanguageCode),
    ]);

    const translation =
      translationOutcome.status === "fulfilled" ? translationOutcome.value : null;
    const lexical = lexicalOutcome.status === "fulfilled" ? lexicalOutcome.value : null;

    const result: EnrichResult = {
      translation,
      translationSource: translation ? "deepl" : "none",
      wordType: lexical?.wordType ?? null,
      gender: lexical?.gender ?? null,
      plural: lexical?.plural ?? null,
      lexicalSource: lexical ? "wikidata" : "none",
      enrichmentStatus:
        translation && lexical ? "success" : translation || lexical ? "partial" : "failed",
    };

    return jsonResponse(result, 200);
  } catch (error) {
    console.error("enrich-word error", error);
    return jsonResponse({ error: "enrichment failed" }, 500);
  }
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function translateWord(
  word: string,
  sourceCode?: string | null,
  targetCode?: string | null,
): Promise<string | null> {
  const apiKey = Deno.env.get("DEEPL_API_KEY");
  if (!apiKey || !sourceCode || !targetCode) return null;

  try {
    const response = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [word],
        source_lang: sourceCode,
        target_lang: targetCode,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.translations?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

async function lookupLexicalInfo(
  word: string,
  learningLanguageCode: string,
): Promise<{ wordType: string | null; gender: string | null; plural: string | null } | null> {
  const languageQid = WIKIDATA_LANGUAGE_QID[learningLanguageCode];
  if (!languageQid) return null;

  try {
    const searchUrl = new URL("https://www.wikidata.org/w/api.php");
    searchUrl.search = new URLSearchParams({
      action: "wbsearchentities",
      search: word,
      language: "en",
      type: "lexeme",
      limit: "10",
      format: "json",
    }).toString();
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) return null;
    const searchData = await searchResponse.json();
    const candidateIds: string[] = (searchData?.search ?? []).map((r: { id: string }) => r.id);
    if (candidateIds.length === 0) return null;

    const entitiesUrl = new URL("https://www.wikidata.org/w/api.php");
    entitiesUrl.search = new URLSearchParams({
      action: "wbgetentities",
      ids: candidateIds.join("|"),
      format: "json",
    }).toString();
    const entitiesResponse = await fetch(entitiesUrl);
    if (!entitiesResponse.ok) return null;
    const entitiesData = await entitiesResponse.json();
    // deno-lint-ignore no-explicit-any
    const entities = Object.values(entitiesData?.entities ?? {}) as any[];
    if (entities.length === 0) return null;

    // Prefer a lexeme matching the target language; fall back to the
    // first candidate if none match exactly (still often useful).
    const lexeme = entities.find((e) => e.language === languageQid) ?? entities[0];
    if (!lexeme) return null;

    const wordType = WORD_TYPE_BY_QID[lexeme.lexicalCategory] ?? null;

    const genderQid = lexeme.claims?.P5185?.[0]?.mainsnak?.datavalue?.value?.id;
    const gender = genderQid ? GENDER_BY_QID[genderQid] ?? null : null;

    // deno-lint-ignore no-explicit-any
    const pluralForm = (lexeme.forms ?? []).find((f: any) =>
      (f.grammaticalFeatures ?? []).includes(PLURAL_FEATURE_QID),
    );
    const isoGuess = learningLanguageCode.split("-")[0];
    const representations = pluralForm?.representations ?? {};
    const plural =
      representations[isoGuess]?.value ?? (Object.values(representations)[0] as { value?: string } | undefined)?.value ?? null;

    if (!wordType && !gender && !plural) return null;
    return { wordType, gender, plural };
  } catch {
    return null;
  }
}
