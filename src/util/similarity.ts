/** Tokenize to lowercase word tokens. */
function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

/** Cosine similarity over term-frequency vectors (bag of words). 0..1. */
export function tokenSetCosine(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 && tb.length === 0) return 1;
  if (ta.length === 0 || tb.length === 0) return 0;
  const fa = freq(ta);
  const fb = freq(tb);
  let dot = 0;
  for (const [term, ca] of fa) {
    const cb = fb.get(term);
    if (cb) dot += ca * cb;
  }
  const mag = (m: Map<string, number>) =>
    Math.sqrt([...m.values()].reduce((s, v) => s + v * v, 0));
  const denom = mag(fa) * mag(fb);
  return denom === 0 ? 0 : dot / denom;
}

function freq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}
