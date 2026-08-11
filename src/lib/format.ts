import { format, formatDistanceToNowStrict } from "date-fns";

/** e.g. "Aug 10, 2026" */
export function formatDate(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy");
}

/** e.g. "Aug 10, 2026, 2:35 PM" */
export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy, h:mm a");
}

/** e.g. "3d" / "2h" / "5m ago" */
export function formatRelative(date: Date | string): string {
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
}
