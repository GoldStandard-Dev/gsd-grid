import {
  isOverdueWorkOrder,
  normalizePriority,
  parseWorkOrderMeta,
} from "./helpers";
import type { WorkOrder, WorkOrderRow } from "./types";

export function mapWorkOrderRow(row: WorkOrderRow): WorkOrder {
  const meta = parseWorkOrderMeta(row.description);
  const metaAssignee = meta.assignedTo ?? null;
  const assignedId = row.assigned_to_user_id ?? metaAssignee?.userId ?? null;
  const assignedName = metaAssignee?.displayName ?? (assignedId ? "Assigned" : null);
  const status = row.status ?? "Open";
  const dueDate = row.due_date ?? null;
  const archivedAt = meta.archivedAt ?? null;

  return {
    id: row.id,
    orgId: row.org_id ?? null,
    number: row.work_order_number ?? null,
    title: row.title?.trim() || "Work Order",
    clientName: row.client_name?.trim() || "Client not set",
    status,
    priority: normalizePriority(row.priority ?? meta.priority),
    scheduledDate: row.scheduled_date ?? null,
    dueDate,
    updatedAt: row.updated_at ?? null,
    assignedTo: assignedId
      ? {
          id: assignedId,
          name: assignedName || "Assigned",
          role: metaAssignee?.role ?? null,
        }
      : null,
    templateName:
      meta.selectedTemplateLabel?.trim() ||
      meta.selectedTemplateName?.trim() ||
      "General",
    reviewStatus: meta.reviewWorkflow?.status ?? "draft",
    archivedAt,
    clientVisibleStatus: row.client_visible_status ?? null,
    visibleToClient: row.visible_to_client ?? false,
    visibleToTeam: row.visible_to_team ?? true,
    requiresSignature: row.requires_signature ?? false,
    isOverdue: isOverdueWorkOrder({ dueDate, status, archivedAt }),
  };
}
