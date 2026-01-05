const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone?: string) => {
  const key = timeZone ?? "default";
  const cached = formatterCache.get(key);
  if (cached) {
    return cached;
  }
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  if (timeZone) {
    options.timeZone = timeZone;
  }
  const formatter = new Intl.DateTimeFormat("en-CA", options);
  formatterCache.set(key, formatter);
  return formatter;
};

const getZonedDateParts = (date: Date, timeZone?: string): ZonedDateParts => {
  const formatter = getFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
};

export const isValidTimeString = (value: string) => TIME_PATTERN.test(value);

export const parseTimeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
};

export const getMinutesOfDay = (date: Date, timeZone?: string) => {
  const parts = getZonedDateParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
};

export const formatDateTimeParts = (date: Date, timeZone?: string) => {
  const parts = getZonedDateParts(date, timeZone);
  return {
    date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(
      2,
      "0",
    )}`,
    time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
  };
};

export const resolveTimeZone = (timeZone?: string | null) => {
  if (!timeZone || !timeZone.trim()) {
    return undefined;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return undefined;
  }
};
