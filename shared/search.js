// Name search used by the API (Citas and Clientes): accents and word order do not matter.

// Every accented form a plain letter may have in a name (upper case too, so it never
// depends on how the database folds case outside ASCII).
const VARIANTS = {
  a: 'aáàäâã',
  e: 'eéèëê',
  i: 'iíìïî',
  o: 'oóòöôõ',
  u: 'uúùüû',
  n: 'nñ',
  c: 'cç',
};

const MAX_WORDS = 6;

// A name may be stored with decomposed accents («i» + U+0301): any combining mark may follow a letter.
const COMBINING_MARKS = `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]*`;

export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lower case without accents: «María Peña» -> «maria pena». */
export function foldText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function letterPattern(letter) {
  const variants = VARIANTS[letter];
  if (!variants) return escapeRegex(letter);
  return `[${variants}${variants.toUpperCase()}]${COMBINING_MARKS}`;
}

/**
 * One regular expression source per word of the query. Each one finds its word with or
 * without accents, so «maria rodriguez» finds «María José Rodríguez» and «Rodríguez María».
 * Use every pattern with the case-insensitive flag, all of them required.
 */
export function nameSearchPatterns(query) {
  return foldText(query)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_WORDS)
    .map((word) => Array.from(word).map(letterPattern).join(''));
}
