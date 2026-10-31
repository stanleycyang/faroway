/** Render supplied duration units without leaking floating-point fractions into cards. */
export function durationLabel(value: string): string {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\s*$/i.exec(value);
  if (!match) return value;
  const minutes = Number(match[1]) * (/^h/i.test(match[2]) ? 60 : 1);
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 1) return 'Less than 1 min';
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${hours} hr${remainder ? ` ${remainder} min` : ''}`;
}
