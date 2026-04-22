import type { WorkOrder, WorkOrderMemberContext, WorkOrderPortal } from "./types";

const FULL_ACCESS_ROLES = new Set([
  "owner",
  "general_manager",
  "operations_manager",
  "project_manager",
  "estimator",
  "office_admin",
  "accounting_manager",
  "field_supervisor",
]);

export function canSeeAllWorkOrders(role: string | null | undefined) {
  return FULL_ACCESS_ROLES.has(role ?? "");
}

export function filterWorkOrdersForPortal(
  workOrders: WorkOrder[],
  portal: WorkOrderPortal,
  context: WorkOrderMemberContext | null
) {
  const visible = workOrders.filter((workOrder) => !workOrder.archivedAt);

  if (portal === "client") {
    return visible.filter((workOrder) => workOrder.visibleToClient);
  }

  if (portal === "team") {
    return visible.filter(
      (workOrder) =>
        workOrder.visibleToTeam && workOrder.assignedTo?.id === context?.userId
    );
  }

  if (canSeeAllWorkOrders(context?.role)) {
    return visible;
  }

  return visible.filter((workOrder) => workOrder.assignedTo?.id === context?.userId);
}
