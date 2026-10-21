// BM / English number words → numbers, for the number guard. Mirrors ml/app/nlp/bm_parser.words_to_number.
export const UNITS: Record<string, number> = {
  kosong: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, lapan: 8, sembilan: 9,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
}
// "se-" words are complete numbers on their own.
export const WHOLE: Record<string, number> = { sepuluh: 10, sebelas: 11, seratus: 100, seribu: 1000, ten: 10, hundred: 100 }
export const NUMBER_WORDS = new Set([...Object.keys(UNITS), ...Object.keys(WHOLE), 'puluh', 'belas', 'ratus', 'ribu'])

/** "dua ratus lima puluh" → 250, "seribu dua ratus" → 1200, "dua belas" → 12; null if not all number words. */
export function wordsToNumber(words: string[]): number | null {
  let total = 0
  let chunk = 0
  let last = 0
  let seen = false
  for (const w of words) {
    if (w in UNITS) last = UNITS[w]!
    else if (w in WHOLE) {
      if (WHOLE[w] === 1000) [total, chunk, last] = [total + 1000, 0, 0]
      else chunk += WHOLE[w]!
    } else if (w === 'puluh') [chunk, last] = [chunk + (last || 1) * 10, 0]
    else if (w === 'belas') [chunk, last] = [chunk + 10 + last, 0]
    else if (w === 'ratus') [chunk, last] = [chunk + (last || 1) * 100, 0]
    else if (w === 'ribu') [total, chunk, last] = [total + (chunk + last || 1) * 1000, 0, 0]
    else return null
    seen = true
  }
  return seen ? total + chunk + last : null
}
