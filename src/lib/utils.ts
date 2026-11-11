import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Denver",
});

export function formatRange(start: string, end: string) {
  const a = dateFmt.format(new Date(start));
  const b = dateFmt.format(new Date(end));
  return a === b ? a : `${a} to ${b}`;
}

/** Collect repeated form fields (e.g. hidden inputs named "skills") */
export function getAll(fd: FormData, key: string) {
  return fd
    .getAll(key)
    .map((v) => String(v))
    .filter(Boolean);
}

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return v === null ? "" : String(v);
}

/** Build a redirect URL with an error/notice message */
export function withMessage(path: string, kind: "error" | "notice", message: string) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${kind}=${encodeURIComponent(message)}`;
}
