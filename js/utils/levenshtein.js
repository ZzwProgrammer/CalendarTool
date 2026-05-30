/**
 * Levenshtein Edit Distance Utilities
 * For fuzzy matching of voice recognition text against intent keywords.
 */

/**
 * Compute Levenshtein (edit) distance between two strings.
 * Uses two-row optimization for O(n) space.
 * @param {string} a
 * @param {string} b
 * @returns {number} Edit distance (0 = identical)
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the longer string for memory optimization
  if (a.length < b.length) {
    [a, b] = [b, a];
  }

  const aLen = a.length;
  const bLen = b.length;

  let prevRow = new Array(bLen + 1);
  let currRow = new Array(bLen + 1);

  for (let j = 0; j <= bLen; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= aLen; i++) {
    currRow[0] = i;
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,      // insertion
        prevRow[j] + 1,          // deletion
        prevRow[j - 1] + cost    // substitution
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[bLen];
}

/**
 * Normalized similarity score between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number} Similarity in [0, 1], where 1 = identical
 */
export function levenshteinSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Find the best fuzzy match for `needle` within `haystack`
 * using a sliding window of needle.length.
 * @param {string} needle   - Short keyword to find (e.g., "添加")
 * @param {string} haystack - Full voice command text
 * @param {number} [threshold=0.6] - Minimum similarity to count as match
 * @returns {{ similarity: number, matched: boolean }}
 */
export function fuzzyContains(needle, haystack, threshold = 0.6) {
  if (haystack.includes(needle)) {
    return { similarity: 1.0, matched: true };
  }

  if (needle.length > haystack.length) {
    return { similarity: 0, matched: false };
  }

  let bestSimilarity = 0;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    const window = haystack.slice(i, i + needle.length);
    const sim = levenshteinSimilarity(needle, window);
    if (sim > bestSimilarity) {
      bestSimilarity = sim;
    }
    if (bestSimilarity === 1.0) break;
  }

  return {
    similarity: bestSimilarity,
    matched: bestSimilarity >= threshold
  };
}

/**
 * Find the best matching keyword from a candidate list within a text.
 * @param {string[]} keywords - Candidate keywords
 * @param {string} text       - Voice command text
 * @returns {{ keyword: string, similarity: number }}
 */
export function bestFuzzyMatch(keywords, text) {
  let best = { keyword: '', similarity: 0 };
  for (const kw of keywords) {
    const result = fuzzyContains(kw, text);
    if (result.similarity > best.similarity) {
      best = { keyword: kw, similarity: result.similarity };
    }
  }
  return best;
}
