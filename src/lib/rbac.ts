export type Role = "owner" | "manager" | "dispatcher" | "technician" | "bookkeeper" | "viewer";

export const Permissions = {
  ORG_SETTINGS: "org.settings",
  TEAM_MANAGE: "team.manage",
  WO_MANAGE: "workorders.manage",
  WO_UPDATE_ASSIGNED: "workorders.update_assigned",
  INVOICE_MANAGE: "invoices.manage",
  INVOICE_VIEW: "invoices.view",
  CLIENTS_MANAGE: "clients.manage",
  CLIENTS_VIEW: "clients.view"
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

const map: Record<Role, Permission[]> = {
  owner: Object.values(Permissions),
  manager: [
    Permissions.WO_MANAGE,
    Permissions.CLIENTS_MANAGE,
    Permissions.INVOICE_VIEW,
    Permissions.TEAM_MANAGE
  ],
  dispatcher: [Permissions.WO_MANAGE, Permissions.CLIENTS_MANAGE],
  technician: [Permissions.WO_UPDATE_ASSIGNED, Permissions.CLIENTS_VIEW],
  bookkeeper: [Permissions.INVOICE_MANAGE, Permissions.INVOICE_VIEW, Permissions.CLIENTS_VIEW],
  viewer: [Permissions.INVOICE_VIEW, Permissions.CLIENTS_VIEW]
};

export function hasPermission(role: Role, perm: Permission) {
  return map[role].includes(perm);
}