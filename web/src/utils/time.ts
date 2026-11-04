/** Clock time `seconds` from now, e.g. "5:42 pm". */
export function arrivalClock(seconds: number, now = Date.now()): string {
  return new Date(now + seconds * 1000).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' });
}
