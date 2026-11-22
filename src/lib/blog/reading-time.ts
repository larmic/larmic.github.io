// Lesezeit eines Posts aus der Wortzahl des Markdown-Texts (Fließtext, Überschriften, Code).
// Guard: Ein Post über der Obergrenze bricht den Build ab, damit jede Folge in eine Kaffeepause passt.

export const WORDS_PER_MINUTE = 200;
export const MAX_MINUTES = 6;
export const MAX_WORDS = WORDS_PER_MINUTE * MAX_MINUTES;

/** Wörter im Markdown: Stücke mit mindestens einem Buchstaben oder einer Ziffer. Zaun-Zeilen und Link-Ziele zählen nicht. */
export function countWords(markdown: string): number {
  const text = markdown.replace(/^\s*(`{3,}|~{3,}).*$/gm, '').replace(/\]\([^)]*\)/g, ']');
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** Minuten bei 200 Wörtern pro Minute, kaufmännisch gerundet, mindestens 1 */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Bricht ab, wenn der Post länger ist als die Obergrenze */
export function assertReadable(id: string, words: number, maxWords = MAX_WORDS): void {
  if (words > maxWords)
    throw new Error(
      `Blog: ${id} hat ${words} Wörter, erlaubt sind ${maxWords} (${maxWords / WORDS_PER_MINUTE} Min. Lesezeit). ` +
        'Den Post kürzen oder in zwei Teile schneiden.',
    );
}
