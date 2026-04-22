export type WorkOrderPriority = "urgent" | "high" | "normal" | "low";

export type WorkOrderPortal = "admin" | "team" | "client";

export type WorkOrderAssignee = {
  id: string;
  name: string;
  role: string | null;
};

export type WorkOrder = {
  id: string;
  orgId: string | null;
  number: number | null;
  title: string;
  clientName: string;
  status: string;
  priority: WorkOrderPriority;
  scheduledDate: string | null;
  dueDate: string | null;
  updatedAt: string | null;
  assignedTo: WorkOrderAssignee | null;
  templateName: string;
  reviewStatus: string;
  archivedAt: string | null;
  clientVisibleStatus: string | null;
  visibleToClient: boolean;
  visibleToTeam: boolean;
  requiresSignature: boolean;
  isOverdue: boolean;
};

export type WorkOrderMeta = {
  assignedTo?: {
    userId?: string | null;
    displayName?: string | null;
    role?: string | null;
  } | null;
  selectedTemplateLabel?: string | null;
  selectedTemplateName?: string | null;
  reviewWorkflow?: {
    status?: string | null;
  } | null;
  priority?: string | null;
  archivedAt?: string | null;
};

export type WorkOrderRow = {
  id: string;
  org_id?: string | null;
  work_order_number?: number | null;
  title?: string | null;
  client_name?: string | null;
  status?: string | null;
  scheduled_date?: string | null;
  due_date?: string | null;
  updated_at?: string | null;
  description?: string | null;
  priority?: string | null;
  assigned_to_user_id?: string | null;
  client_visible_status?: string | null;
  visible_to_client?: boolean | null;
  visible_to_team?: boolean | null;
  requires_signature?: boolean | null;
};

export type WorkOrderMemberContext = {
  userId: string;
  orgId: string | null;
  role: string | null;
};
