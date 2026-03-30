// Re-export role/permission types from permissions.ts (single source of truth)
export type { UserRole, Permission } from "../lib/permissions";
export { ROLE_PERMISSIONS, hasPermission } from "../lib/permissions";

// ============================================================
// ENUM TYPES (mirror DB enums)
// ============================================================
export type MemberStatus = "active" | "invited" | "inactive";
export type WoStatus = "new" | "scheduled" | "in_progress" | "blocked" | "completed" | "canceled";
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type TimeOffStatus = "pending" | "approved" | "denied";
export type TimeOffType = "pto" | "sick" | "unpaid";
export type EmployeeStatus = "active" | "inactive" | "terminated";
export type PricingMode = "matrix" | "unit" | "flat" | "labor" | "material" | "formula";
export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";
export type PortalStatus = "pending" | "active" | "revoked";

// ============================================================
// DATABASE ROW TYPES
// ============================================================

export type Organization = {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type OrgMember = {
  id: string;
  org_id: string;
  user_id: string;
  role: import("../lib/permissions").UserRole;
  status: MemberStatus;
  display_name: string | null;
  email: string | null;
  created_at: string;
};

export type OrgInvite = {
  id: string;
  org_id: string;
  invited_by_user_id: string | null;
  email: string;
  role: import("../lib/permissions").UserRole;
  token: string;
  status: InviteStatus;
  expires_at: string;
  created_at: string;
};

export type OrganizationSettings = {
  org_id: string;
  company_name: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  address_search: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  logo_url: string | null;
  tax_rate: number;
  default_deposit: number;
  invoice_prefix: string;
  payment_terms: string | null;
  invoice_show_company_address: boolean;
  invoice_show_payment_terms: boolean;
  invoice_show_due_date: boolean;
  default_template: string;
  workorder_show_measurements: boolean;
  workorder_enable_invoice_conversion: boolean;
  workorder_include_signature: boolean;
  brand_theme: string;
  notify_new_work_orders: boolean;
  notify_invoice_reminders: boolean;
  notify_team_activity: boolean;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkOrder = {
  id: string;
  org_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: WoStatus;
  template_name: string | null;
  assigned_to_user_id: string | null;
  created_by_user_id: string | null;
  review_workflow: ReviewWorkflow | null;
  grid_data: GridData | null;
  scope_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewStatus = "draft" | "submitted_for_review" | "in_review" | "priced";

export type ReviewWorkflow = {
  status: ReviewStatus;
  submittedAt?: string;
  submittedBy?: string;
  reviewStartedAt?: string;
  reviewStartedBy?: string;
  completedAt?: string;
  completedBy?: string;
  note?: string;
};

export type GridRow = {
  id: string;
  type: "measured" | "labor" | "material" | "note";
  fields: Record<string, string>;
  amount?: number;
};

export type GridData = {
  rows: GridRow[];
  headers?: Array<{ id: string; label: string; enabled: boolean; options?: string[] }>;
};

export type WorkOrderTemplate = {
  id: string;
  org_id: string;
  name: string;
  source_name: string | null;
  headers: Array<{ id: string; label: string; enabled: boolean; options?: string[] }> | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  org_id: string;
  client_id: string | null;
  work_order_id: string | null;
  number: string | null;
  status: InvoiceStatus;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  notes: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  org_id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  amount_cents: number;
  sort_order: number;
  created_at: string;
};

export type PricingCollection = {
  id: string;
  org_id: string;
  name: string;
  industry_type: string | null;
  pricing_mode: PricingMode;
  is_default: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type PricingFabric = {
  id: string;
  org_id: string;
  collection_id: string;
  fabric_style: string;
  price_group: string;
  fabric_width: string | null;
  fr: boolean;
  roller_shade: boolean;
  panel_track: boolean;
  multi_directional: boolean;
  created_at: string;
};

export type PricingMatrixCell = {
  id: string;
  org_id: string;
  collection_id: string;
  price_group: string;
  width_to: number;
  height_to: number;
  price: number;
  created_at: string;
};

export type PricingSurcharge = {
  id: string;
  org_id: string;
  collection_id: string;
  surcharge_type: string;
  width_to: number;
  price: number;
  created_at: string;
};

export type PricingItem = {
  id: string;
  org_id: string;
  collection_id: string | null;
  name: string;
  unit: string | null;
  price: number;
  created_at: string;
};

export type Employee = {
  id: string;
  org_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  department: string | null;
  hire_date: string | null;
  status: EmployeeStatus;
  hourly_rate: number | null;
  created_at: string;
  updated_at: string;
};

export type TimeEntry = {
  id: string;
  org_id: string;
  employee_id: string;
  work_order_id: string | null;
  clock_in: string;
  clock_out: string | null;
  hours: number | null;
  notes: string | null;
  created_at: string;
};

export type TimeOffRequest = {
  id: string;
  org_id: string;
  employee_id: string;
  type: TimeOffType;
  start_date: string;
  end_date: string;
  status: TimeOffStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeReview = {
  id: string;
  org_id: string;
  employee_id: string;
  reviewer_id: string | null;
  review_date: string;
  rating: number | null;
  notes: string | null;
  created_at: string;
};

export type EmployeeDocument = {
  id: string;
  org_id: string;
  employee_id: string;
  name: string;
  type: string | null;
  url: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  org_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type Notification = {
  id: string;
  org_id: string;
  user_id: string;
  type: string | null;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

export type ClientPortalAccess = {
  id: string;
  org_id: string;
  client_id: string;
  email: string;
  token: string;
  status: PortalStatus;
  expires_at: string;
  last_login_at: string | null;
  created_at: string;
};
