import type { UserRole } from "./permissions";

export type PortalType = "admin" | "team" | "client";

export const ADMIN_PORTAL_ROLES: UserRole[] = [
  "owner",
  "general_manager",
  "operations_manager",
  "project_manager",
  "estimator",
  "office_admin",
  "accounting_manager",
  "hr_manager",
  "field_supervisor",
];

export const TEAM_PORTAL_ROLES: UserRole[] = ["technician"];

export function getPortalForRole(role?: string | null): PortalType {
  if (role === "client") return "client";
  if (TEAM_PORTAL_ROLES.includes(role as UserRole)) return "team";
  return "admin";
}

export function getMobilePortalHome(portal: PortalType) {
  if (portal === "team") return "/mobile/team/jobs";
  if (portal === "client") return "/mobile/client/projects";
  return "/mobile/admin/dashboard";
}

export function getMobilePortalHomeForRole(role?: string | null) {
  return getMobilePortalHome(getPortalForRole(role));
}
