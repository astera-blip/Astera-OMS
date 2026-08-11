const TAIPEI_OFFSET_MINUTES = 8 * 60;
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Campaign authoring uses Taipei time (UTC+8), while stored values are UTC ISO strings.
 * This avoids relying on the browser, Node process, or Vercel region timezone.
 */
export function campaignDateTimeLocalToUtc(value: string) {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error("Invalid campaign datetime");
  }

  const [, year, month, day, hour, minute] = match;
  const utcMillis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute) - TAIPEI_OFFSET_MINUTES,
  );
  const date = new Date(utcMillis);

  if (
    date.getTime() !== utcMillis
    || !isValidTaipeiDateParts(date, Number(year), Number(month), Number(day), Number(hour), Number(minute))
  ) {
    throw new Error("Invalid campaign datetime");
  }

  return date.toISOString();
}

export function campaignDateTimeToLocalInput(value: string) {
  const date = parseCampaignDateTime(value);
  const taipeiMillis = date.getTime() + TAIPEI_OFFSET_MINUTES * 60 * 1000;
  const taipei = new Date(taipeiMillis);

  return [
    taipei.getUTCFullYear().toString().padStart(4, "0"),
    (taipei.getUTCMonth() + 1).toString().padStart(2, "0"),
    taipei.getUTCDate().toString().padStart(2, "0"),
  ].join("-") + `T${taipei.getUTCHours().toString().padStart(2, "0")}:${taipei.getUTCMinutes().toString().padStart(2, "0")}`;
}

export function parseCampaignDateTime(value: string) {
  const trimmed = value.trim();
  if (LOCAL_DATE_TIME_PATTERN.test(trimmed)) {
    return new Date(campaignDateTimeLocalToUtc(trimmed));
  }

  const date = new Date(trimmed);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid campaign datetime");
  }

  return date;
}

export function formatCampaignDateTime(value: string) {
  const date = parseCampaignDateTime(value);
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isValidTaipeiDateParts(
  utcDate: Date,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const taipei = new Date(utcDate.getTime() + TAIPEI_OFFSET_MINUTES * 60 * 1000);

  return (
    taipei.getUTCFullYear() === year
    && taipei.getUTCMonth() + 1 === month
    && taipei.getUTCDate() === day
    && taipei.getUTCHours() === hour
    && taipei.getUTCMinutes() === minute
  );
}
