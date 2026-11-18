/**
 * Does this search text read like a question for the trip assistant rather
 * than a place name? ("Nak ke kedai makan paling best di KL", "cara paling
 * murah ke KLIA?") Place names are short and rarely use these words.
 */
const CUES = /\b(nak|hendak|mahu|macam ?mana|camne|cmne|cara|paling|best|terbaik|sedap|murah|cepat|berapa|bila|pukul|boleh|cadang|syor|patut|perlu|naik apa|how|what|which|where|when|cheapest|fastest|best|should|recommend|good|near me|dekat sini)\b/i;

export function looksLikeQuestion(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return false;
  if (t.includes('?')) return true;
  const words = t.split(/\s+/).length;
  return words >= 4 && CUES.test(t);
}
