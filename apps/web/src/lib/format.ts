const DEFAULT_LOCALE = "en";
const rtf = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: "auto" });

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffSeconds = Math.round((date.getTime() - now) / 1000);

  const absDiff = Math.abs(diffSeconds);

  if (absDiff < MINUTE) {
    return rtf.format(diffSeconds, "second");
  }
  if (absDiff < HOUR) {
    return rtf.format(Math.round(diffSeconds / MINUTE), "minute");
  }
  if (absDiff < DAY) {
    return rtf.format(Math.round(diffSeconds / HOUR), "hour");
  }
  return rtf.format(Math.round(diffSeconds / DAY), "day");
}
