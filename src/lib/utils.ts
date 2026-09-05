import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function formatShortDate(value: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function relativeTime(value: string) {
  const delta = new Date(value).getTime() - Date.now();
  const minutes = Math.round(delta / 60_000);
  if (Math.abs(minutes) < 60)
    return new Intl.RelativeTimeFormat().format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24)
    return new Intl.RelativeTimeFormat().format(hours, "hour");
  return new Intl.RelativeTimeFormat().format(Math.round(hours / 24), "day");
}
