const DATE_PART_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function datePartFormatter(timezone: string) {
  const existing = DATE_PART_FORMATTER_CACHE.get(timezone);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  });
  DATE_PART_FORMATTER_CACHE.set(timezone, formatter);
  return formatter;
}

function partsForInstant(date: Date, timezone: string) {
  const parts = datePartFormatter(timezone).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
    hour: Number(parts.find((part) => part.type === "hour")?.value),
    minute: Number(parts.find((part) => part.type === "minute")?.value),
    second: Number(parts.find((part) => part.type === "second")?.value),
  };
}

function timezoneOffsetMs(date: Date, timezone: string) {
  const parts = partsForInstant(date, timezone);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    ) - date.getTime()
  );
}

export function localDateString(value: string | Date, timezone: string) {
  const date = typeof value === "string" ? new Date(value) : value;

  if (!Number.isFinite(date.getTime())) {
    return typeof value === "string" ? value.slice(0, 10) : "";
  }

  const parts = partsForInstant(date, timezone);
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

export function plainDateToLocalDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function localDateToPlainDate(date: Date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function todayPlainDate() {
  return localDateToPlainDate(new Date());
}

export function addDaysToPlainDate(date: string, amount: number) {
  const next = plainDateToLocalDate(date);
  next.setDate(next.getDate() + amount);
  return localDateToPlainDate(next);
}

export function zonedDateTimeToIso(
  date: string,
  time: string,
  timezone: string
) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return new Date(`${date}T${time}`).toISOString();
  }

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcMs = localAsUtc - timezoneOffsetMs(new Date(localAsUtc), timezone);
  utcMs = localAsUtc - timezoneOffsetMs(new Date(utcMs), timezone);

  return new Date(utcMs).toISOString();
}
