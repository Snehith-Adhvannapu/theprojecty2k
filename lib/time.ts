// Stored in UTC, shown in IST.
const base = { timeZone: "Asia/Kolkata" } as const;

export const formatIST = (d: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { ...base, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(d));

export const formatTimeIST = (d: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { ...base, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(d));

export const formatFullIST = (d: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { ...base, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(d));
