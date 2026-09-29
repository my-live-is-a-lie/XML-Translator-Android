import type { ProviderEngineType } from './translator';

const SYSTEM_INSTRUCTION = `You are an expert Android strings.xml localization engine.
Follow these strict rules for every translation:
1. Return ONLY the final translated string text. Do NOT include any metadata labels, prefixes, explanations, notes, or bracketed tags.
2. Strictly preserve all original formatting and Android syntax tokens in their exact form (printf specifiers, escape sequences, inline HTML/XML tags, resource references).
3. Use natural, concise mobile UI terminology appropriate for Android applications.
4. Preserve leading or trailing whitespace and outer quotes only if they exist in the source string.`;

function stripMetadataWrappers(text: string, sourceText: string): string {
  let cleaned = text.trim();
  const metadataRegex =
    /^\[?\s*(?:ترجمة المصطلح|ترجمة النص|ترجمة|Translation|Translated text)\s*[:：-]\s*(.*?)\s*\]?$/i;
  const match = cleaned.match(metadataRegex);
  if (match?.[1]) cleaned = match[1].trim();
  if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  if (
    cleaned.startsWith('[') &&
    cleaned.endsWith(']') &&
    !sourceText.trim().startsWith('[') &&
    !sourceText.trim().endsWith(']')
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

function mapTargetLang(targetLang: string): { base: string; google: string; deepl: string } {
  const lower = (targetLang || 'ar').toLowerCase();
  const base = lower.split('-')[0];
  const google =
    lower === 'zh-rcn' ? 'zh-CN' : lower === 'zh-rtw' ? 'zh-TW' : lower === 'pt-rbr' ? 'pt-BR' : base;
  const deepl =
    lower === 'pt-rbr' ? 'PT-BR' : lower === 'zh-rcn' ? 'ZH-HANS' : lower === 'zh-rtw' ? 'ZH-HANT' : base.toUpperCase();
  return { base, google, deepl };
}

async function tryYandex(apiKey: string, sourceText: string, baseLang: string): Promise<string> {
  const trimmed = apiKey.trim();
  const cloudRes = await fetch('https://translate.api.cloud.yandex.net/translate/v2/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: trimmed.startsWith('t1.') ? `Bearer ${trimmed}` : `Api-Key ${trimmed}`,
    },
    body: JSON.stringify({
      sourceLanguageCode: 'en',
      targetLanguageCode: baseLang,
      texts: [sourceText],
    }),
  });
  if (cloudRes.ok) {
    const data = (await cloudRes.json()) as { translations?: Array<{ text?: string }> };
    const text = data.translations?.[0]?.text;
    if (text) return stripMetadataWrappers(text, sourceText);
  }

  const v1Url = `https://translate.yandex.net/api/v1.5/tr.json/translate?key=${encodeURIComponent(
    trimmed
  )}&text=${encodeURIComponent(sourceText)}&lang=en-${encodeURIComponent(baseLang)}`;
  const v1Res = await fetch(v1Url);
  if (v1Res.ok) {
    const v1Data = (await v1Res.json()) as { text?: string[] };
    if (Array.isArray(v1Data.text) && v1Data.text[0]) {
      return stripMetadataWrappers(v1Data.text[0], sourceText);
    }
  }
  throw new Error('Yandex API key authentication failed');
}

async function tryDeepL(apiKey: string, sourceText: string, deeplTarget: string): Promise<string> {
  const trimmed = apiKey.trim();
  const isFree = trimmed.endsWith(':fx');
  const host = isFree ? 'api-free.deepl.com' : 'api.deepl.com';
  const res = await fetch(`https://${host}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${trimmed}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [sourceText],
      source_lang: 'EN',
      target_lang: deeplTarget,
    }),
  });
  if (!res.ok) throw new Error(`DeepL API HTTP ${res.status}`);
  const data = (await res.json()) as { translations?: Array<{ text?: string }> };
  const text = data.translations?.[0]?.text;
  if (!text) throw new Error('Empty DeepL translation');
  return stripMetadataWrappers(text, sourceText);
}

async function tryOpenAI(
  apiKey: string,
  sourceText: string,
  targetLang: string,
  targetLocaleName?: string,
  pluralQuantity?: string
): Promise<string> {
  const langLabel = targetLocaleName ? `${targetLocaleName} (${targetLang})` : targetLang;
  const pluralContext = pluralQuantity ? ` (CLDR plural form: ${pluralQuantity})` : '';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        {
          role: 'user',
          content: `Translate the following Android strings.xml value from English to ${langLabel}${pluralContext}. Return ONLY the translated text:\n${sourceText}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty OpenAI response');
  return stripMetadataWrappers(content, sourceText);
}

async function tryGeminiOrGoogleKey(
  apiKey: string,
  sourceText: string,
  targetLang: string,
  targetLocaleName?: string,
  baseLang?: string
): Promise<string> {
  const trimmed = apiKey.trim();
  const langLabel = targetLocaleName ? `${targetLocaleName} (${targetLang})` : targetLang;
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
      trimmed
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [
          {
            parts: [
              {
                text: `Translate the following Android strings.xml value from English to ${langLabel}. Return ONLY the translated text:\n${sourceText}`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );
  if (geminiRes.ok) {
    const gData = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = gData.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    if (text.trim()) return stripMetadataWrappers(text, sourceText);
  }

  const gUrl = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(trimmed)}`;
  const gRes = await fetch(gUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: sourceText,
      source: 'en',
      target: baseLang || 'ar',
      format: 'text',
    }),
  });
  if (gRes.ok) {
    const data = (await gRes.json()) as {
      data?: { translations?: Array<{ translatedText?: string }> };
    };
    const t = data.data?.translations?.[0]?.translatedText;
    if (t) return stripMetadataWrappers(t, sourceText);
  }
  throw new Error('Google / Gemini API key authentication failed');
}

async function tryMicrosoft(apiKey: string, sourceText: string, baseLang: string): Promise<string> {
  const msUrl = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=${encodeURIComponent(
    baseLang
  )}`;
  const msRes = await fetch(msUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey.trim(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ Text: sourceText }]),
  });
  if (!msRes.ok) throw new Error(`Microsoft Translator HTTP ${msRes.status}`);
  const msData = (await msRes.json()) as Array<{ translations?: Array<{ text?: string }> }>;
  const text = msData?.[0]?.translations?.[0]?.text;
  if (!text) throw new Error('Empty Microsoft Translator response');
  return stripMetadataWrappers(text, sourceText);
}

export async function translateWithCustomProvider(options: {
  providerType: string;
  apiKey?: string;
  sourceText: string;
  targetLang: string;
  targetLocaleName?: string;
  pluralQuantity?: string;
}): Promise<string> {
  const { providerType, apiKey, sourceText, targetLang, targetLocaleName, pluralQuantity } = options;
  const { base, deepl } = mapTargetLang(targetLang);
  const trimmed = (apiKey || '').trim();

  if (providerType === 'yandex' || providerType === 'yandex_builtin') {
    if (!trimmed) throw new Error('Missing Yandex API key');
    return tryYandex(trimmed, sourceText, base);
  }
  if (providerType === 'deepl') {
    if (!trimmed) throw new Error('Missing DeepL API key');
    return tryDeepL(trimmed, sourceText, deepl);
  }
  if (providerType === 'openai') {
    if (!trimmed) throw new Error('Missing OpenAI API key');
    return tryOpenAI(trimmed, sourceText, targetLang, targetLocaleName, pluralQuantity);
  }
  if (providerType === 'google_cloud' || providerType === 'gemini_custom' || providerType === 'gemini') {
    if (!trimmed) throw new Error('Missing Google / Gemini API key');
    return tryGeminiOrGoogleKey(trimmed, sourceText, targetLang, targetLocaleName, base);
  }
  if (providerType === 'microsoft') {
    if (!trimmed) throw new Error('Missing Microsoft Translator key');
    return tryMicrosoft(trimmed, sourceText, base);
  }

  // Auto-detect by key shape
  if (!trimmed) throw new Error('Missing API key');
  const probes: Array<() => Promise<string>> = [];
  if (trimmed.startsWith('sk-')) probes.push(() => tryOpenAI(trimmed, sourceText, targetLang, targetLocaleName, pluralQuantity));
  if (trimmed.endsWith(':fx') || trimmed.length > 20) probes.push(() => tryDeepL(trimmed, sourceText, deepl));
  if (trimmed.startsWith('AIza')) probes.push(() => tryGeminiOrGoogleKey(trimmed, sourceText, targetLang, targetLocaleName, base));
  probes.push(
    () => tryYandex(trimmed, sourceText, base),
    () => tryGeminiOrGoogleKey(trimmed, sourceText, targetLang, targetLocaleName, base),
    () => tryOpenAI(trimmed, sourceText, targetLang, targetLocaleName, pluralQuantity),
    () => tryMicrosoft(trimmed, sourceText, base)
  );

  let lastError: unknown;
  for (const probe of probes) {
    try {
      return await probe();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All provider probes failed');
}

export async function testProviderOnDevice(
  providerType: string,
  apiKey: string
): Promise<{
  success: boolean;
  matched: boolean;
  testSource: string;
  providerTranslation?: string;
  detectedType?: ProviderEngineType;
  error?: string;
}> {
  const testSource = 'Install';
  try {
    const translated = await translateWithCustomProvider({
      providerType,
      apiKey,
      sourceText: testSource,
      targetLang: 'ar',
      targetLocaleName: 'العربية',
    });
    return {
      success: true,
      matched: /تثبيت|تنصيب/.test(translated),
      testSource,
      providerTranslation: translated,
      detectedType: providerType as ProviderEngineType,
    };
  } catch (err) {
    return {
      success: false,
      matched: false,
      testSource,
      error: err instanceof Error ? err.message : 'Provider test failed',
    };
  }
}
