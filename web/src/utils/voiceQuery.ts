/**
 * Turn what a driver said into a search query: drop "bawa saya ke", "nak pergi",
 * "navigate to"… so "Bawa saya ke Awana SkyWay" searches "Awana SkyWay".
 */
const LEAD = [
  'tolong', 'boleh', 'saya', 'aku', 'kita', 'nak', 'mahu', 'hendak', 'ingin', 'bawa', 'hantar', 'tunjuk',
  'pergi', 'gi', 'ke', 'kat', 'di', 'jom', 'navigasi', 'cari', 'cari', 'laluan',
  'please', 'take', 'me', 'navigate', 'go', 'to', 'drive', 'directions', 'find', 'route', 'show', 'the', 'way',
];
const TRAIL = ['please', 'tolong', 'sekarang', 'now', 'ya', 'ok', 'okay'];

export function cleanVoiceQuery(said: string): string {
  const words = said.trim().replace(/[.?!]+$/g, '').split(/\s+/).filter(Boolean);
  let i = 0;
  // Only strip leading filler while something remains to search for
  while (i < words.length - 1 && LEAD.includes(words[i].toLowerCase())) i++;
  let j = words.length;
  while (j - 1 > i && TRAIL.includes(words[j - 1].toLowerCase())) j--;
  return words.slice(i, j).join(' ');
}
