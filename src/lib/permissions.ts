export type UserRole =
  | "owner"
  | "general_manager"
  | "operations_manager"
  | "project_manager"
  | "estimator"
  | "office_admin"
  | "hr_manager"
  | "accounting_manager"
  | "field_supervisor"
  | "technician"
  | "viewer";

export type Permission =
  | "view_dashboard"

  | "view_workorders"
  | "create_workorders"
  | "edit_workorders"
  | "delete_workorders"
  | "assign_workorders"
  | "approve_workorders"

  | "view_invoices"
  | "create_invoices"
  | "edit_invoices"
  | "delete_invoices"
  | "view_financials"

  | "view_clients"
  | "create_clients"
  | "edit_clients"
  | "delete_clients"

  | "view_people"
  | "invite_people"
  | "edit_people"
  | "remove_people"
  | "manage_roles"

  | "view_hr"
  | "edit_employees"
  | "manage_time_off"
  | "manage_reviews"
  | "manage_documents"
  | "view_payroll"

  | "view_settings"
  | "edit_settings";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    "view_dashboard",

    "view_workorders",
    "create_workorders",
    "edit_workorders",
    "delete_workorders",
    "assign_workorders",
    "approve_workorders",

    "view_invoices",
    "create_invoices",
    "edit_invoices",
    "delete_invoices",
    "view_financials",

    "view_clients",
    "create_clients",
    "edit_clients",
    "delete_clients",

    "view_people",
    "invite_people",
    "edit_people",
    "remove_people",
    "manage_roles",

    "view_hr",
    "edit_employees",
    "manage_time_off",
    "manage_reviews",
    "manage_documents",
    "view_payroll",

    "view_settings",
    "edit_settings",
  ],

  general_manager: [
    "view_dashboard",

    "view_workorders",
    "create_workorders",
    "edit_workorders",
    "assign_workorders",
    "approve_workorders",

    "view_invoices",
    "create_invoices",
    "edit_invoices",
    "view_financials",

    "view_clients",
    "create_clients",
    "edit_clients",

    "view_people",
    "invite_people",
    "edit_people",

    "view_hr",
    "edit_employees",
    "manage_time_off",
    "manage_reviews",
    "manage_documents",

    "view_settings",
  ],

  operations_manager: [
    "view_dashboard",

    "view_workorders",
    "create_workorders",
    "edit_workorders",
    "assign_workorders",
    "approve_workorders",

    "view_clients",
    "create_clients",
    "edit_clients",

    "view_people",
    "edit_people",

    "view_hr",
    "edit_employees",
    "manage_time_off",
  ],

  project_manager: [
    "view_dashboard",

    "view_workorders",
    "create_workorders",
    "edit_workorders",
    "assign_workorders",

    "view_clients",
    "create_clients",
    "edit_clients",

    "view_people",
  ],

  estimator: [
    "view_dashboard",

    "view_workorders",
    "create_workorders",
    "edit_workorders",

    "view_clients",
    "create_clients",
    "edit_clients",
  ],

  office_admin: [
    "view_dashboard",

    "view_workorders",
    "create_workorders",
    "edit_workorders",

    "view_invoices",
    "create_invoices",
    "edit_invoices",

    "view_clients",
    "create_clients",
    "edit_clients",

    "view_people",
    "invite_people",
  ],

  hr_manager: [
    "view_dashboard",

    "view_people",
    "invite_people",
    "edit_people",
    "manage_roles",

    "view_hr",
    "edit_employees",
    "manage_time_off",
    "manage_reviews",
    "manage_documents",
    "view_payroll",
  ],

  accounting_manager: [
    "view_dashboard",

    "view_invoices",
    "create_invoices",
    "edit_invoices",
    "delete_invoices",
    "view_financials",

    "view_clients",
    "view_people",
  ],

  field_supervisor: [
    "view_dashboard",

    "view_workorders",
    "edit_workorders",
    "assign_workorders",

    "view_clients",
    "view_people",
  ],

  technician: [
    "view_workorders",
  ],

  viewer: [
    "view_dashboard",
  ],
};

export function hasPermission(
  permissions: Permission[] | null | undefined,
  permission: Permission
) {
  return !!permissions?.includes(permission);
}