import { fold } from './textIndex'

/**
 * IS THIS A NAME WORTH PUTTING IN FRONT OF EVERY OTHER BOOKSHOP?
 *
 * The barcode half of this question is answered in features/stock/barcode.ts by
 * `contributableKey`: a real manufacturer's GTIN, never an in-store code. This
 * is the other half, and until now there wasn't one — any string of one to
 * eighty characters went in. So "aaa", "test", "xxx", "sans nom", "123456" and
 * a phone number typed into the name field were all offered to the catalogue as
 * the definitive name of a barcode every bookshop in the country scans.
 *
 * WHY A HEURISTIC AND NOT A MODEL. This runs inside the save of a product, on a
 * machine that is offline for hours at a time, in a dialog the owner is trying
 * to close. It has to answer in microseconds without a network. That rules out
 * asking anything clever, and it turns out not to matter: junk names are junk in
 * a small number of recognisable ways, and the ways they are junk are the same
 * in every shop.
 *
 * WHY IT CAN AFFORD TO BE STRICT — this is the important part. REJECTING COSTS
 * THE SHOP NOTHING. The product is created exactly as before, with exactly that
 * name, on that shop's own shelf; all that is withheld is the offer to name the
 * code for everybody else. A false rejection loses one contribution out of
 * thousands. A false acceptance puts a wrong name on a national barcode and
 * hands it to shops that have no idea where it came from. Those are not
 * comparable, so every rule below leans the same way: when unsure, keep it.
 *
 * WHAT THIS IS NOT. It is not the last gate. Contributions land in the shop's
 * own subtree and reach /catalog only through `catalog:harvest`, which a person
 * runs — and which re-checks these same rules rather than trusting what the
 * browser sent (cli/lib.mjs). This is the cheap filter that keeps the harvest
 * worth reading.
 */

/**
 * A name longer than this is not a title, it is somebody's note to himself
 * ("Cahier 96p — commande Mme Ben Salah, à rappeler jeudi"). Kept in step with
 * the same cap in lib/catalog.ts and cli/lib.mjs.
 */
export const MAX_NAME = 80

/** Latin with its accents, and Arabic. What this shop's labels are written in. */
const LETTER = /[a-z\u00C0-\u024F\u0600-\u06FF\u0750-\u077F]/i
const LATIN_LETTER = /[a-z\u00C0-\u024F]/i
const LATIN_VOWEL = /[aeiouy\u00C0-\u00C6\u00C8-\u00CF\u00D2-\u00D6\u00D9-\u00DC\u00E0-\u00E6\u00E8-\u00EF\u00F2-\u00F6\u00F9-\u00FC]/i

/**
 * Names that mean "I had to type something".
 *
 * Folded before lookup, so accents and Arabic spelling variants collapse — see
 * lib/textIndex. Whole-name matches only: "Test" is junk, "Cahier de test de
 * français" is a real product on a real shelf.
 */
const PLACEHOLDER = new Set(
  [
    'test', 'tests', 'testing', 'essai', 'demo', 'sample', 'exemple', 'temp', 'tmp',
    'aaa', 'aaaa', 'abc', 'abcd', 'abcde', 'asdf', 'qwerty', 'azerty', 'aze', 'qsd',
    'xxx', 'xxxx', 'xyz', 'zzz', 'blabla', 'bla',
    'produit', 'produits', 'article', 'articles', 'item', 'items', 'product',
    'nouveau', 'nouveau produit', 'nouvel article', 'new', 'new product',
    'sans nom', 'sansnom', 'noname', 'no name', 'nom', 'name', 'inconnu', 'unknown',
    'divers', 'autre', 'autres', 'truc', 'machin', 'chose', 'rien',
    'na', 'n/a', 'nd', '???', '..', '...', '-', '--',
    // The same handful as a Tunisian shop actually types them.
    'تجربة', 'منتج', 'سلعة', 'بدون اسم', 'بدون', 'جديد', 'شيء',
  ].map(fold),
)

/**
 * The name to contribute, or null to keep it to this shop.
 *
 * Returns the cleaned name rather than a boolean so the caller cannot check one
 * string and store a different one — the whitespace collapse below is part of
 * the answer, not a detail.
 */
export function contributableName(raw: unknown): string | null {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ')

  // Nothing, or a paragraph. The long end is the owner's private note.
  if (name === '' || name.length > MAX_NAME) return null

  // Three letters is "BIC". Two is a size, a shelf reference or a slip of the
  // keyboard, and none of those name a barcode.
  const letters = [...name].filter((ch) => LETTER.test(ch)).length
  if (letters < 3) return null

  // "I had to type something."
  if (PLACEHOLDER.has(fold(name))) return null

  /*
    A run of seven digits or more is a phone number, an order reference or the
    barcode typed back into the name field. Seven, not eight: a Tunisian phone
    number is eight digits and the shop writes them with and without spaces.
    Real names carry short numbers — "Cahier 96 pages", "Sec 4 T2", "A4 80g".
  */
  if (/[0-9]{7,}/.test(name)) return null

  /*
    Mostly punctuation. Counted against the non-space length, so "Bic (bleu)"
    and "Sec 4 - Maths T2 (sc. exp)" — which are what real names look like in
    this shop — stay well clear, while "***", "///" and "?!?!" do not.
  */
  const solid = name.replace(/\s/g, '')
  const wordish = [...solid].filter((ch) => LETTER.test(ch) || /[0-9]/.test(ch)).length
  if (wordish * 2 < solid.length) return null

  // "aaaa", "zzzz", "hmmmm". Letters only: "10000" is a quantity, not a mash.
  if (/([a-z\u00C0-\u024F])\1{3,}/i.test(name)) return null

  /*
    Keyboard mashing, which is the one kind of junk that gets past everything
    above: "sdfghjk" has letters, no repeats, no digits and is not on any list.
    A Latin word of six letters or more with no vowel in it is not a word.

    Applied ONLY to tokens that are entirely Latin letters — an Arabic name
    writes no short vowels at all and would fail this test on every word, and a
    token like "T2" or "96p" is not a word being tested.
  */
  for (const token of name.split(/[^\p{L}]+/u)) {
    if (token.length < 6) continue
    if (![...token].every((ch) => LATIN_LETTER.test(ch))) continue
    if (!LATIN_VOWEL.test(token)) return null
  }

  return name
}
