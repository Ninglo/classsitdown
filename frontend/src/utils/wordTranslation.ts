import type { ListeningMaterialItem } from '../types/overview';

function uniqueWords(words: string[]): string[] {
  return [...new Set(words.map((word) => word.trim()).filter(Boolean))];
}

export function extractEnglishWords(raw: string): string[] {
  const lineTokens = raw
    .split(/[\n,;，；、]+/)
    .flatMap((chunk) => chunk.match(/[A-Za-z][A-Za-z' -]*/g) ?? [])
    .map((word) => word.trim().replace(/\s+/g, ' '));

  return uniqueWords(lineTokens);
}

async function translateViaGoogle(word: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('google translate failed');
  const payload = (await response.json()) as unknown[];
  const rows = Array.isArray(payload[0]) ? (payload[0] as unknown[]) : [];
  return rows
    .map((row) => (Array.isArray(row) ? String(row[0] ?? '') : ''))
    .join('')
    .trim();
}

async function translateViaMyMemory(word: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-CN`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('mymemory translate failed');
  const payload = (await response.json()) as {
    responseData?: { translatedText?: string };
  };
  return payload.responseData?.translatedText?.trim() ?? '';
}

async function translateViaBackend(word: string): Promise<string> {
  const response = await fetch(`/api/translate/en-zh?text=${encodeURIComponent(word)}`);
  if (!response.ok) throw new Error('backend translate failed');
  const payload = (await response.json()) as { translated?: string };
  return payload.translated?.trim() ?? '';
}

async function translateWord(word: string): Promise<string> {
  for (const translator of [translateViaBackend, translateViaGoogle, translateViaMyMemory]) {
    try {
      const translated = await translator(word);
      if (translated) return translated;
    } catch {
      // Try next provider.
    }
  }
  return '';
}

export async function buildListeningMaterials(raw: string): Promise<ListeningMaterialItem[]> {
  const words = extractEnglishWords(raw);
  const translated = await Promise.all(
    words.map(async (word, index) => ({
      id: `listen_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 5)}`,
      english: word,
      chinese: await translateWord(word),
    })),
  );
  return translated;
}
