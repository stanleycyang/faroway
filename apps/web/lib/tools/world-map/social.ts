// Pre-filled text + intent URLs for sharing a world map on common platforms.

export function socialShareText(
  name: string,
  totalVisited: number,
  continentsVisited: number,
): string {
  if (totalVisited === 0) {
    return `${name}'s World Map — pin every country you've visited. Free, private, no sign-up.`;
  }
  const countryWord = totalVisited === 1 ? "country" : "countries";
  const continentWord = continentsVisited === 1 ? "continent" : "continents";
  return `I've been to ${totalVisited} ${countryWord} across ${continentsVisited} ${continentWord} 🌍 — here's my world map:`;
}

export function twitterIntent(url: string, text: string): string {
  const params = new URLSearchParams({ text, url });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function threadsIntent(text: string, url: string): string {
  // Threads takes a single "text" field; include the URL inline so the
  // preview unfurl still works.
  const params = new URLSearchParams({ text: `${text}\n\n${url}` });
  return `https://www.threads.net/intent/post?${params.toString()}`;
}

export function smsIntent(text: string, url: string): string {
  // `sms:` URLs on iOS prefer `&body=`, Android prefers `?body=` — modern
  // clients accept both when a separator is explicit.
  const body = `${text}\n\n${url}`;
  return `sms:?&body=${encodeURIComponent(body)}`;
}
