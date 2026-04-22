import { getUserOrgId } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { mapWorkOrderRow } from "./mappers";
import { filterWorkOrdersForPortal } from "./permissions";
import type {
  WorkOrder,
  WorkOrderMemberContext,
  WorkOrderPortal,
  WorkOrderRow,
} from "./types";

const WORK_ORDER_SELECT =
  "id, org_id, work_order_number, title, client_name, status, scheduled_date, due_date, updated_at, description, priority, assigned_to_user_id, client_visible_status, visible_to_client, visible_to_team, requires_signature";

const WORK_ORDER_FALLBACK_SELECT =
  "id, org_id, work_order_number, title, client_name, status, scheduled_date, due_date, updated_at, description, priority, client_visible_status, visible_to_client, visible_to_team, requires_signature";

function shouldRetryWithoutAssignedColumn(message: string | undefined) {
  return (message ?? "").toLowerCase().includes("assigned_to_user_id");
}

export async function getCurrentWorkOrderContext(): Promise<WorkOrderMemberContext | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const userId = authData.user.id;
  const orgId = await getUserOrgId(userId);
  if (!orgId) {
    return { userId, orgId: null, role: null };
  }

  const { data } = await supabase
    .from("org_members")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();

  return {
    userId,
    orgId,
    role: data?.role ?? null,
  };
}

async function queryWorkOrdersByOrg(orgId: string): Promise<WorkOrder[]> {
  const request = supabase
    .from("work_orders")
    .select(WORK_ORDER_SELECT)
    .eq("org_id", orgId)
    .order("work_order_number", { ascending: false })
    .limit(300);

  const { data, error } = await request;

  if (error && shouldRetryWithoutAssignedColumn(error.message)) {
    const fallback = await supabase
      .from("work_orders")
      .select(WORK_ORDER_FALLBACK_SELECT)
      .eq("org_id", orgId)
      .order("work_order_number", { ascending: false })
      .limit(300);

    if (fallback.error) throw fallback.error;
    return ((fallback.data ?? []) as WorkOrderRow[]).map(mapWorkOrderRow);
  }

  if (error) throw error;
  return ((data ?? []) as WorkOrderRow[]).map(mapWorkOrderRow);
}

async function getClientOrgIds(userId: string) {
  const { data, error } = await supabase
    .from("client_users")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw error;

  return Array.from(new Set((data ?? []).map((row) => row.org_id).filter(Boolean)));
}

export async function listWorkOrdersForPortal(portal: WorkOrderPortal) {
  const context = await getCurrentWorkOrderContext();

  if (!context) return [];

  if (portal === "client") {
    const orgIds = await getClientOrgIds(context.userId);
    const buckets = await Promise.all(orgIds.map((orgId) => queryWorkOrdersByOrg(orgId)));
    return buckets.flat().filter((workOrder) => workOrder.visibleToClient);
  }

  if (!context.orgId) return [];

  const workOrders = await queryWorkOrdersByOrg(context.orgId);
  return filterWorkOrdersForPortal(workOrders, portal, context);
}
