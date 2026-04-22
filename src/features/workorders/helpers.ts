import type { WorkOrderMeta, WorkOrderPriority } from "./types";

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseWorkOrderMeta(description: string | null | undefined): WorkOrderMeta {
  const parsed = safeJsonParse<WorkOrderMeta | null>(description, null);
  return parsed && typeof parsed === "object" ? parsed : {};
}

export function normalizePriority(value: string | null | undefined): WorkOrderPriority {
  if (value === "urgent" || value === "high" || value === "low") return value;
  return "normal";
}

export function isClosedWorkOrderStatus(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase();
  return ["closed", "complete", "completed", "canceled", "cancelled"].includes(normalized);
}

export function isOverdueWorkOrder(params: {
  dueDate: string | null;
  status: string;
  archivedAt: string | null;
}) {
  if (!params.dueDate || params.archivedAt || isClosedWorkOrderStatus(params.status)) {
    return false;
  }

  const due = new Date(params.dueDate);
  if (Number.isNaN(due.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return due < today;
}

export function formatMobileDate(value: string | null | undefined) {
  if (!value) return "No date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function isToday(value: string | null | undefined) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function isNeedsReviewStatus(reviewStatus: string | null | undefined) {
  return ["submitted_for_review", "in_review"].includes((reviewStatus ?? "").toLowerCase());
}
