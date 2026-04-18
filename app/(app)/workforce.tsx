import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import {
  AppPage,
  ContentCard,
  PageHeader,
  SummaryCard,
  SummaryStrip,
} from "../../src/components/AppPage";
import EmptyState from "../../src/components/EmptyState";
import { getUserOrgId } from "../../src/lib/auth";
import { ROLE_PERMISSIONS, type Permission, type UserRole } from "../../src/lib/permissions";
import { getPortalForRole, type PortalType } from "../../src/lib/portals";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";

type TeamTab = "Members" | "Roles" | "Activity";
type MemberStatus = "All" | "active" | "inactive" | "pending";
type AssignmentFilter = "All" | "Assigned" | "Unassigned";
type DirectorySort = "Newest" | "Name" | "Role" | "Location";

type TeamMember = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  display_name: string | null;
  created_at?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  department?: string | null;
  employee_type?: string | null;
  employment_status?: string | null;
  manager_member_id?: string | null;
  portal_type?: PortalType | null;
  is_field_user?: boolean | null;
  mobile_access_enabled?: boolean | null;
  desktop_access_enabled?: boolean | null;
  work_location?: string | null;
  profile_photo_url?: string | null;
  last_active_at?: string | null;
  permissions?: Permission[] | string[] | null;
};

type TeamInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
  display_name?: string | null;
  phone?: string | null;
  job_title?: string | null;
  profile_photo_url?: string | null;
  portal_type?: PortalType | null;
  mobile_access_enabled?: boolean | null;
  desktop_access_enabled?: boolean | null;
  permissions?: Permission[] | string[] | null;
};

type TeamRecord = {
  id: string;
  userId?: string;
  name: string;
  role: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  employeeType?: string | null;
  employmentStatus?: string | null;
  managerMemberId?: string | null;
  portalType: PortalType;
  isFieldUser?: boolean | null;
  mobileAccessEnabled?: boolean | null;
  desktopAccessEnabled?: boolean | null;
  workLocation?: string | null;
  profilePhotoUrl?: string | null;
  createdAt?: string | null;
  lastActiveAt?: string | null;
  permissions?: Permission[] | string[] | null;
  source: "member" | "invite";
};

type WorkOrderLite = {
  id: string;
  title?: string | null;
  status?: string | null;
  assigned_to_user_id?: string | null;
  updated_at?: string | null;
};

type RolePreset = {
  label: "Owner" | "Manager" | "Dispatcher" | "Technician" | "Bookkeeper" | "Viewer";
  role: UserRole;
  description: string;
};

type TeamRole = {
  id: string;
  label: string;
  role: UserRole;
  description: string;
  color: string;
  portalType: PortalType;
  isSystem: boolean;
  permissions: Permission[];
};

type OrganizationRoleRow = {
  id: string;
  name: string;
  role_key: string;
  description?: string | null;
  color?: string | null;
  portal_type?: PortalType | null;
  permissions?: Permission[] | string[] | null;
  is_system?: boolean | null;
};

type NewRoleForm = {
  name: string;
  baseRole: UserRole;
  color: string;
};

type AddMemberForm = {
  name: string;
  email: string;
  phone: string;
  profilePhotoUrl: string;
  role: UserRole;
  status: "active" | "pending";
  portalType: PortalType;
  mobileAccessEnabled: boolean;
  desktopAccessEnabled: boolean;
};

const TABS: TeamTab[] = ["Members", "Roles", "Activity"];

const ROLE_PRESETS: RolePreset[] = [
  { label: "Owner", role: "owner", description: "Full workspace access and billing authority." },
  { label: "Manager", role: "general_manager", description: "Oversees jobs, people, clients, and invoices." },
  { label: "Dispatcher", role: "office_admin", description: "Coordinates work, invites, clients, and invoices." },
  { label: "Technician", role: "technician", description: "Focused field access for assigned work orders." },
  { label: "Bookkeeper", role: "accounting_manager", description: "Invoice, financial, and client visibility." },
  { label: "Viewer", role: "viewer", description: "Read-light access for workspace visibility." },
];

const SYSTEM_ROLE_TEMPLATES: TeamRole[] = ROLE_PRESETS.map((preset) => ({
  id: preset.role,
  label: preset.label,
  role: preset.role,
  description: preset.description,
  color: theme.colors.gold,
  portalType: getPortalForRole(preset.role),
  isSystem: true,
  permissions: [...ROLE_PERMISSIONS[preset.role]],
}));

const MEMBER_STATUSES: MemberStatus[] = ["All", "active", "pending", "inactive"];
const ASSIGNMENT_FILTERS: AssignmentFilter[] = ["All", "Assigned", "Unassigned"];

const PERMISSION_GROUPS: { title: string; items: { key: Permission; label: string }[] }[] = [
  {
    title: "Work Orders",
    items: [
      { key: "create_workorders", label: "Create" },
      { key: "edit_workorders", label: "Edit" },
      { key: "assign_workorders", label: "Assign" },
      { key: "approve_workorders", label: "Submit / approve review" },
      { key: "view_workorders", label: "View pricing context" },
    ],
  },
  {
    title: "Pricing",
    items: [
      { key: "view_workorders", label: "View" },
      { key: "edit_workorders", label: "Edit" },
      { key: "approve_workorders", label: "Approve" },
    ],
  },
  {
    title: "Clients",
    items: [
      { key: "view_clients", label: "View" },
      { key: "edit_clients", label: "Edit" },
    ],
  },
  {
    title: "Invoices",
    items: [
      { key: "view_invoices", label: "View" },
      { key: "create_invoices", label: "Create" },
      { key: "edit_invoices", label: "Send / edit" },
    ],
  },
  {
    title: "Team",
    items: [
      { key: "view_people", label: "View members" },
      { key: "invite_people", label: "Invite members" },
      { key: "edit_people", label: "Manage members" },
      { key: "manage_roles", label: "Manage roles" },
    ],
  },
];

const emptyAddMemberForm: AddMemberForm = {
  name: "",
  email: "",
  phone: "",
  profilePhotoUrl: "",
  role: "technician",
  status: "pending",
  portalType: "team",
  mobileAccessEnabled: true,
  desktopAccessEnabled: false,
};

const emptyNewRoleForm: NewRoleForm = {
  name: "",
  baseRole: "technician",
  color: theme.colors.gold,
};

function titleCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatRole(value?: string | null) {
  if (!value) return "Viewer";
  const preset = ROLE_PRESETS.find((item) => item.role === value);
  return preset?.label ?? titleCase(value);
}

function normalizeRole(value: string): UserRole {
  if (value === "manager") return "general_manager";
  if (value === "dispatcher") return "office_admin";
  if (value === "bookkeeper") return "accounting_manager";
  if ((Object.keys(ROLE_PERMISSIONS) as UserRole[]).includes(value as UserRole)) {
    return value as UserRole;
  }
  return "viewer";
}

function normalizePermissions(value: Permission[] | string[] | null | undefined, role: string) {
  if (Array.isArray(value) && value.length > 0) {
    return value.filter(Boolean) as Permission[];
  }
  return ROLE_PERMISSIONS[normalizeRole(role)] ?? ROLE_PERMISSIONS.viewer;
}

function formatRelative(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function statusStyle(status: string) {
  if (status === "active") return styles.statusActive;
  if (status === "pending") return styles.statusPending;
  return styles.statusInactive;
}

function statusLabel(value?: string | null) {
  return value || "Open";
}

function formatPortal(value?: PortalType | null) {
  if (value === "client") return "Client";
  if (value === "team") return "Team";
  return "Admin";
}

function getPortalForMember(role: string, portalType?: PortalType | null) {
  return portalType ?? getPortalForRole(role);
}

function roleRowToTemplate(row: OrganizationRoleRow): TeamRole {
  const safeRole = normalizeRole(row.role_key);
  return {
    id: row.id,
    label: row.name,
    role: safeRole,
    description: row.description || `Custom role based on ${formatRole(safeRole)}.`,
    color: row.color || theme.colors.gold,
    portalType: row.portal_type ?? getPortalForRole(safeRole),
    isSystem: !!row.is_system,
    permissions: normalizePermissions(row.permissions, safeRole),
  };
}

function MembersTable({
  loading,
  people,
  roleFilters,
  locationFilters,
  roleFilter,
  locationFilter,
  statusFilter,
  assignmentFilter,
  sortKey,
  query,
  assignedJobCountByUser,
  onQueryChange,
  onRoleFilter,
  onLocationFilter,
  onStatusFilter,
  onAssignmentFilter,
  onSort,
  onAddMember,
  onOpenMember,
  onCancelInvite,
}: {
  loading: boolean;
  people: TeamRecord[];
  roleFilters: string[];
  locationFilters: string[];
  roleFilter: string;
  locationFilter: string;
  statusFilter: MemberStatus;
  assignmentFilter: AssignmentFilter;
  sortKey: DirectorySort;
  query: string;
  assignedJobCountByUser: Map<string, number>;
  onQueryChange: (value: string) => void;
  onRoleFilter: (value: string) => void;
  onLocationFilter: (value: string) => void;
  onStatusFilter: (value: MemberStatus) => void;
  onAssignmentFilter: (value: AssignmentFilter) => void;
  onSort: (value: DirectorySort) => void;
  onAddMember: () => void;
  onOpenMember: (value: TeamRecord) => void;
  onCancelInvite: (id: string) => void;
}) {
  return (
    <ContentCard title="Members" subtitle="Search, filter, and open team records without extra side panels." meta={loading ? "Loading..." : `${people.length} shown`}>
      <View style={styles.controlsRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={theme.colors.muted} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search name, role, email, or phone"
            placeholderTextColor={theme.colors.muted}
            style={styles.search}
          />
        </View>
        <Pressable onPress={onAddMember} style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}>
          <Text style={styles.primaryButtonText}>+ Add Member</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
        {roleFilters.map((value) => (
          <FilterPill key={value} label={value} active={roleFilter === value} onPress={() => onRoleFilter(value)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
        {MEMBER_STATUSES.map((value) => (
          <FilterPill key={value} label={value === "All" ? "All Status" : titleCase(value)} active={statusFilter === value} onPress={() => onStatusFilter(value)} />
        ))}
        {ASSIGNMENT_FILTERS.map((value) => (
          <FilterPill key={value} label={value === "All" ? "All Assignments" : value} active={assignmentFilter === value} onPress={() => onAssignmentFilter(value)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
        {locationFilters.map((value) => (
          <FilterPill key={value} label={value === "All" ? "All Locations" : value} active={locationFilter === value} onPress={() => onLocationFilter(value)} />
        ))}
        {(["Newest", "Name", "Role", "Location"] as DirectorySort[]).map((value) => (
          <FilterPill key={value} label={`Sort: ${value}`} active={sortKey === value} onPress={() => onSort(value)} />
        ))}
      </ScrollView>

      {people.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colName]}>Name</Text>
              <Text style={[styles.th, styles.colRole]}>Role</Text>
              <Text style={[styles.th, styles.colStatus]}>Status</Text>
              <Text style={[styles.th, styles.colAssigned]}>Assigned Jobs</Text>
              <Text style={[styles.th, styles.colActive]}>Last Active</Text>
              <Text style={[styles.th, styles.colActions]}>Actions</Text>
            </View>
            {people.map((person, index) => {
              const assignedCount = person.userId ? assignedJobCountByUser.get(person.userId) ?? 0 : 0;
              return (
                <Pressable
                  key={`${person.source}-${person.id}`}
                  onPress={() => onOpenMember(person)}
                  style={({ pressed }) => [
                    styles.tr,
                    index % 2 === 0 ? styles.trStriped : null,
                    pressed ? styles.trPressed : null,
                  ]}
                >
                  <View style={[styles.colName, styles.personCell]}>
                    <Avatar name={person.name} uri={person.profilePhotoUrl} />
                    <View style={styles.personCopy}>
                      <Text style={styles.tdStrong} numberOfLines={1}>{person.name}</Text>
                      <Text style={styles.tdMeta} numberOfLines={1}>{person.jobTitle || (person.source === "invite" ? "Pending invitation" : "Team member")}</Text>
                    </View>
                  </View>
                  <View style={[styles.roleBadge, styles.colRole]}>
                    <Text style={styles.roleBadgeText}>{formatRole(person.role)}</Text>
                  </View>
                  <View style={[styles.statusBadge, statusStyle(person.status), styles.colStatus]}>
                    <Text style={styles.statusText}>{titleCase(person.status)}</Text>
                  </View>
                  <Text style={[styles.td, styles.colAssigned]}>{assignedCount}</Text>
                  <Text style={[styles.td, styles.colActive]}>{formatRelative(person.lastActiveAt)}</Text>
                  <View style={[styles.colActions, styles.actionsCell]}>
                    {person.source === "member" ? (
                      <Pressable
                        onPress={(e) => { e.stopPropagation?.(); onOpenMember(person); }}
                        style={({ pressed }) => [styles.smallAction, pressed ? styles.pressed : null]}
                      >
                        <Text style={styles.smallActionText}>Edit</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={(e) => { e.stopPropagation?.(); onCancelInvite(person.id); }}
                        style={({ pressed }) => [styles.smallAction, styles.smallActionDanger, pressed ? styles.pressed : null]}
                      >
                        <Text style={[styles.smallActionText, styles.smallActionDangerText]}>Cancel</Text>
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <EmptyState icon="people-outline" title="No team members found" body="Adjust the filters or add the first member to start building your operations team." actionLabel="+ Add Member" onAction={onAddMember} />
      )}
    </ContentCard>
  );
}

function RolesPanel({
  selectedRole,
  roles,
  rolePermissions,
  onSelectRole,
  onToggle,
  onReset,
  onNewRole,
}: {
  selectedRole: TeamRole;
  roles: TeamRole[];
  rolePermissions: Record<string, Permission[]>;
  onSelectRole: (value: TeamRole) => void;
  onToggle: (value: Permission) => void;
  onReset: () => void;
  onNewRole: () => void;
}) {
  return (
    <ContentCard title="Roles" subtitle="Create role templates, tune permissions, and set the default portal experience." meta={`${roles.length} roles`}>
      <View style={styles.rolesLayout}>
        <View style={styles.roleRail}>
          <Pressable onPress={onNewRole} style={({ pressed }) => [styles.newRoleButton, pressed ? styles.secondaryButtonPressed : null]}>
            <Ionicons name="add-outline" size={16} color={theme.colors.goldDark} />
            <Text style={styles.newRoleButtonText}>New Role</Text>
          </Pressable>

          {roles.map((role) => {
            const active = selectedRole.id === role.id;
            return (
              <Pressable key={role.id} onPress={() => onSelectRole(role)} style={({ pressed }) => [styles.roleOption, active ? styles.roleOptionActive : null, pressed ? styles.pressed : null]}>
                <View style={styles.roleOptionHeader}>
                  <View style={[styles.roleColorDot, { backgroundColor: role.color }]} />
                  <Text style={[styles.roleOptionTitle, active ? styles.roleOptionTitleActive : null]}>{role.label}</Text>
                </View>
                <Text style={styles.roleOptionMeta}>{role.description}</Text>
                <Text style={styles.roleOptionFooter}>{role.isSystem ? "System role" : "Custom role"} / {formatPortal(role.portalType)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.permissionPanel}>
          <View style={styles.permissionHeader}>
            <View>
              <Text style={styles.permissionTitle}>{selectedRole.label}</Text>
              <Text style={styles.permissionSubtitle}>{selectedRole.description}</Text>
            </View>
            <Pressable onPress={onReset} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null]}>
              <Text style={styles.secondaryButtonText}>Reset</Text>
            </Pressable>
          </View>

          <View style={styles.permissionGrid}>
            {PERMISSION_GROUPS.map((group) => (
              <View key={group.title} style={styles.permissionGroup}>
                <Text style={styles.permissionGroupTitle}>{group.title}</Text>
                {group.items.map((permission) => {
                  const active = (rolePermissions[selectedRole.id] ?? []).includes(permission.key);
                  return (
                    <Pressable key={`${group.title}-${permission.key}`} onPress={() => onToggle(permission.key)} style={({ pressed }) => [styles.permissionRow, pressed ? styles.permissionRowPressed : null]}>
                      <Text style={styles.permissionLabel}>{permission.label}</Text>
                      <View style={[styles.toggle, active ? styles.toggleActive : null]}>
                        <View style={[styles.toggleKnob, active ? styles.toggleKnobActive : null]} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.accessPreview}>
            <Text style={styles.permissionGroupTitle}>Portal Assignment</Text>
            <Text style={styles.accessPreviewText}>
              Default portal: {formatPortal(selectedRole.portalType)}. Use member-level overrides when a person needs mobile-only or desktop-only access.
            </Text>
          </View>
        </View>
      </View>
    </ContentCard>
  );
}

function ActivityPanel({ activityItems }: { activityItems: { title: string; body: string; time: string }[] }) {
  return (
    <ContentCard title="Team Activity" subtitle="Audit-friendly people operations events will collect here.">
      {activityItems.length ? (
        <View style={styles.list}>
          {activityItems.map((item, index) => (
            <View key={`${item.title}-${index}`} style={styles.activityRow}>
              <View style={styles.iconTile}>
                <Ionicons name="pulse-outline" size={17} color={theme.colors.goldDark} />
              </View>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>{item.title}</Text>
                <Text style={styles.listMeta}>{item.body}</Text>
              </View>
              <Text style={styles.listTime}>{item.time}</Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState icon="pulse-outline" title="No team activity yet" body="Invite, role, permission, portal, status, and profile changes will appear here." />
      )}
    </ContentCard>
  );
}

function AddMemberModal({
  visible,
  form,
  formError,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  form: AddMemberForm;
  formError: string;
  saving: boolean;
  onChange: (value: AddMemberForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Add member</Text>
              <Text style={styles.modalSubtitle}>Create a pending team invite with role defaults.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.iconButton}>
              <Ionicons name="close-outline" size={22} color={theme.colors.ink} />
            </Pressable>
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <LabeledInput label="Name" value={form.name} onChangeText={(value) => onChange({ ...form, name: value })} placeholder="Full name" />
          <LabeledInput label="Email" value={form.email} onChangeText={(value) => onChange({ ...form, email: value })} placeholder="name@company.com" />
          <LabeledInput label="Phone" value={form.phone} onChangeText={(value) => onChange({ ...form, phone: value })} placeholder="(555) 555-5555" />

          <Text style={styles.fieldLabel}>Profile Photo</Text>
          <Pressable style={({ pressed }) => [styles.uploadBox, pressed ? styles.secondaryButtonPressed : null]}>
            {form.profilePhotoUrl ? <Image source={{ uri: form.profilePhotoUrl }} style={styles.avatarImage} /> : <Ionicons name="camera-outline" size={18} color={theme.colors.goldDark} />}
            <Text style={styles.uploadBoxText}>Upload Photo</Text>
            <Text style={styles.uploadBoxMeta}>Storage upload hooks in next pass</Text>
          </Pressable>

          <Text style={styles.fieldLabel}>Role</Text>
          <View style={styles.modalPillGrid}>
            {ROLE_PRESETS.map((preset) => (
              <FilterPill
                key={preset.role}
                label={preset.label}
                active={form.role === preset.role}
                onPress={() => onChange({ ...form, role: preset.role, portalType: getPortalForRole(preset.role) })}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Portal</Text>
          <View style={styles.modalPillGrid}>
            {(["admin", "team", "client"] as PortalType[]).map((portalType) => (
              <FilterPill
                key={portalType}
                label={formatPortal(portalType)}
                active={form.portalType === portalType}
                onPress={() => onChange({ ...form, portalType })}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Access</Text>
          <View style={styles.modalPillGrid}>
            <FilterPill
              label="Mobile"
              active={form.mobileAccessEnabled}
              onPress={() => onChange({ ...form, mobileAccessEnabled: !form.mobileAccessEnabled })}
            />
            <FilterPill
              label="Desktop"
              active={form.desktopAccessEnabled}
              onPress={() => onChange({ ...form, desktopAccessEnabled: !form.desktopAccessEnabled })}
            />
          </View>

          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.modalPillGrid}>
            {(["pending", "active"] as const).map((status) => (
              <FilterPill key={status} label={titleCase(status)} active={form.status === status} onPress={() => onChange({ ...form, status })} />
            ))}
          </View>

          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null]}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onSubmit} style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}>
              <Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Add Member"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function NewRoleModal({
  visible,
  form,
  onChange,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  form: NewRoleForm;
  onChange: (value: NewRoleForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Create role</Text>
              <Text style={styles.modalSubtitle}>Start with a safe preset, then customize permissions.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.iconButton}>
              <Ionicons name="close-outline" size={22} color={theme.colors.ink} />
            </Pressable>
          </View>

          <LabeledInput label="Role Name" value={form.name} onChangeText={(value) => onChange({ ...form, name: value })} placeholder="Crew Lead" />

          <Text style={styles.fieldLabel}>Base Preset</Text>
          <View style={styles.modalPillGrid}>
            {SYSTEM_ROLE_TEMPLATES.map((role) => (
              <FilterPill
                key={role.id}
                label={role.label}
                active={form.baseRole === role.role}
                onPress={() => onChange({ ...form, baseRole: role.role, color: role.color })}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Badge Color</Text>
          <View style={styles.colorRow}>
            {[theme.colors.gold, "#0F766E", "#1D4ED8", "#B45309", "#BE123C"].map((color) => (
              <Pressable
                key={color}
                onPress={() => onChange({ ...form, color })}
                style={[styles.colorSwatch, { backgroundColor: color }, form.color === color ? styles.colorSwatchActive : null]}
              />
            ))}
          </View>

          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null]}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onSubmit} style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}>
              <Text style={styles.primaryButtonText}>Create Role</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MemberDetailModal({
  record,
  assignedJobCountByUser,
  onClose,
  onSave,
}: {
  record: TeamRecord | null;
  assignedJobCountByUser: Map<string, number>;
  onClose: () => void;
  onSave: (id: string, updates: { name: string; email: string; phone: string; jobTitle: string; department: string; role: UserRole; status: "active" | "inactive" }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("technician");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");

  useEffect(() => {
    if (record) {
      setEditing(false);
      setSaveError("");
      setEditName(record.name);
      setEditEmail(record.email || "");
      setEditPhone(record.phone || "");
      setEditJobTitle(record.jobTitle || "");
      setEditDepartment(record.department || "");
      setEditRole(normalizeRole(record.role));
      setEditStatus(record.status === "active" ? "active" : "inactive");
    }
  }, [record?.id]);

  async function handleSave() {
    if (!record) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSave(record.id, {
        name: editName,
        email: editEmail,
        phone: editPhone,
        jobTitle: editJobTitle,
        department: editDepartment,
        role: editRole,
        status: editStatus,
      });
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to save.");
      setSaving(false);
    }
  }

  return (
    <Modal visible={!!record} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        {record ? (
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.profileHeader}>
                <Avatar name={record.name} uri={record.profilePhotoUrl} />
                <View>
                  <Text style={styles.modalTitle}>{editing ? "Edit member" : record.name}</Text>
                  <Text style={styles.modalSubtitle}>
                    {editing ? "Update profile, role, and status." : `${formatRole(record.role)} / ${titleCase(record.status)}`}
                  </Text>
                </View>
              </View>
              <Pressable onPress={onClose} style={styles.iconButton}>
                <Ionicons name="close-outline" size={22} color={theme.colors.ink} />
              </Pressable>
            </View>

            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

            {editing ? (
              <>
                <LabeledInput label="Name" value={editName} onChangeText={setEditName} placeholder="Full name" />
                <LabeledInput label="Email" value={editEmail} onChangeText={setEditEmail} placeholder="name@company.com" />
                <LabeledInput label="Phone" value={editPhone} onChangeText={setEditPhone} placeholder="(555) 555-5555" />
                <LabeledInput label="Job Title" value={editJobTitle} onChangeText={setEditJobTitle} placeholder="Crew Lead" />
                <LabeledInput label="Department" value={editDepartment} onChangeText={setEditDepartment} placeholder="Operations" />

                <Text style={styles.fieldLabel}>Role</Text>
                <View style={styles.modalPillGrid}>
                  {ROLE_PRESETS.map((preset) => (
                    <FilterPill
                      key={preset.role}
                      label={preset.label}
                      active={editRole === preset.role}
                      onPress={() => setEditRole(preset.role)}
                    />
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Status</Text>
                <View style={styles.modalPillGrid}>
                  {(["active", "inactive"] as const).map((s) => (
                    <FilterPill key={s} label={titleCase(s)} active={editStatus === s} onPress={() => setEditStatus(s)} />
                  ))}
                </View>

                <View style={styles.modalActions}>
                  <Pressable onPress={() => setEditing(false)} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null]}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleSave} style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}>
                    <Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Save Changes"}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Profile</Text>
                <View style={styles.detailGrid}>
                  <DetailRow label="Email" value={record.email || "-"} />
                  <DetailRow label="Phone" value={record.phone || "-"} />
                </View>

                <Text style={styles.fieldLabel}>Job</Text>
                <View style={styles.detailGrid}>
                  <DetailRow label="Portal" value={formatPortal(record.portalType)} />
                  <DetailRow label="Location" value={record.workLocation || record.department || "-"} />
                  <DetailRow label="Job" value={[record.department, record.jobTitle].filter(Boolean).join(" / ") || "-"} />
                </View>

                <Text style={styles.fieldLabel}>Activity</Text>
                <View style={styles.detailGrid}>
                  <DetailRow label="Assigned work orders" value={String(record.userId ? assignedJobCountByUser.get(record.userId) ?? 0 : 0)} />
                  <DetailRow label="Last active" value={formatRelative(record.lastActiveAt)} />
                </View>

                <Text style={styles.fieldLabel}>Access</Text>
                <View style={styles.permissionChips}>
                  {normalizePermissions(record.permissions, record.role).slice(0, 8).map((permission) => (
                    <View key={permission} style={styles.miniChip}>
                      <Text style={styles.miniChipText}>{titleCase(permission)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.modalActions}>
                  <Pressable onPress={onClose} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null]}>
                    <Text style={styles.secondaryButtonText}>Close</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditing(true)} style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}>
                    <Text style={styles.primaryButtonText}>Edit Member</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function Avatar({ name, uri }: { name: string; uri?: string | null }) {
  if (uri) {
    return <Image source={{ uri }} style={styles.avatarImage} />;
  }

  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.filterPill, active ? styles.filterPillActive : null, pressed ? styles.pressed : null]}>
      <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.colors.muted} style={styles.input} />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function WorkforcePage() {
  const [activeTab, setActiveTab] = useState<TeamTab>("Members");
  const [orgId, setOrgId] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<MemberStatus>("All");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("All");
  const [sortKey, setSortKey] = useState<DirectorySort>("Newest");
  const [showAddMember, setShowAddMember] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [savingInvite, setSavingInvite] = useState(false);
  const [formError, setFormError] = useState("");
  const [addMemberForm, setAddMemberForm] = useState<AddMemberForm>(emptyAddMemberForm);
  const [newRoleForm, setNewRoleForm] = useState<NewRoleForm>(emptyNewRoleForm);
  const [selectedRecord, setSelectedRecord] = useState<TeamRecord | null>(null);
  const [roleTemplates, setRoleTemplates] = useState<TeamRole[]>(SYSTEM_ROLE_TEMPLATES);
  const [selectedRole, setSelectedRole] = useState<TeamRole>(SYSTEM_ROLE_TEMPLATES[0]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, Permission[]>>(() =>
    SYSTEM_ROLE_TEMPLATES.reduce(
      (acc, role) => ({ ...acc, [role.id]: [...role.permissions] }),
      {} as Record<string, Permission[]>
    )
  );
  const [teamActivity, setTeamActivity] = useState<{ id: string; actor_name: string | null; action: string; created_at: string }[]>([]);

  useEffect(() => {
    void loadTeamHub();
  }, []);

  const people = useMemo<TeamRecord[]>(() => {
    const memberRows = members.map((member) => ({
      id: member.id,
      userId: member.user_id,
      name: member.display_name || member.email || "Team Member",
      role: member.role,
      status: member.status || "active",
      email: member.email,
      phone: member.phone,
      jobTitle: member.job_title,
      department: member.department,
      employeeType: member.employee_type,
      employmentStatus: member.employment_status,
      managerMemberId: member.manager_member_id,
      portalType: getPortalForMember(member.role, member.portal_type),
      isFieldUser: member.is_field_user,
      mobileAccessEnabled: member.mobile_access_enabled,
      desktopAccessEnabled: member.desktop_access_enabled,
      workLocation: member.work_location,
      profilePhotoUrl: member.profile_photo_url,
      createdAt: member.created_at,
      lastActiveAt: member.last_active_at ?? member.created_at,
      permissions: member.permissions,
      source: "member" as const,
    }));

    const inviteRows = invites.map((invite) => ({
      id: invite.id,
      name: invite.display_name || invite.email || "Pending invite",
      role: invite.role,
      status: invite.status || "pending",
      email: invite.email,
      phone: invite.phone,
      jobTitle: invite.job_title,
      profilePhotoUrl: invite.profile_photo_url,
      portalType: getPortalForMember(invite.role, invite.portal_type),
      mobileAccessEnabled: invite.mobile_access_enabled,
      desktopAccessEnabled: invite.desktop_access_enabled,
      createdAt: invite.created_at,
      lastActiveAt: invite.created_at,
      permissions: invite.permissions,
      source: "invite" as const,
    }));

    return [...memberRows, ...inviteRows];
  }, [invites, members]);

  const assignedUserIds = useMemo(() => {
    return new Set(workOrders.map((item) => item.assigned_to_user_id).filter(Boolean) as string[]);
  }, [workOrders]);

  const assignedJobCountByUser = useMemo(() => {
    const counts = new Map<string, number>();
    workOrders.forEach((item) => {
      if (!item.assigned_to_user_id) return;
      counts.set(item.assigned_to_user_id, (counts.get(item.assigned_to_user_id) ?? 0) + 1);
    });
    return counts;
  }, [workOrders]);

  const roleFilters = useMemo(() => {
    return ["All", ...Array.from(new Set(people.map((person) => formatRole(person.role)))).sort()];
  }, [people]);

  const locationFilters = useMemo(() => {
    const values = people
      .map((person) => person.workLocation || person.department || "")
      .filter(Boolean);
    return ["All", ...Array.from(new Set(values)).sort()];
  }, [people]);

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return people.filter((person) => {
      if (roleFilter !== "All" && formatRole(person.role) !== roleFilter) return false;
      if (locationFilter !== "All" && (person.workLocation || person.department || "") !== locationFilter) return false;
      if (statusFilter !== "All" && person.status !== statusFilter) return false;

      if (assignmentFilter !== "All") {
        const assigned = !!person.userId && assignedUserIds.has(person.userId);
        if (assignmentFilter === "Assigned" && !assigned) return false;
        if (assignmentFilter === "Unassigned" && assigned) return false;
      }

      if (!normalizedQuery) return true;
      return [person.name, person.email, person.phone, person.jobTitle, formatRole(person.role)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    }).sort((a, b) => {
      if (sortKey === "Name") return a.name.localeCompare(b.name);
      if (sortKey === "Role") return formatRole(a.role).localeCompare(formatRole(b.role));
      if (sortKey === "Location") return (a.workLocation || a.department || "").localeCompare(b.workLocation || b.department || "");
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });
  }, [assignmentFilter, assignedUserIds, locationFilter, people, query, roleFilter, sortKey, statusFilter]);

  const activeToday = people.filter((person) => person.status === "active").length;
  const pendingInviteCount = invites.filter((invite) => invite.status === "pending").length;
  const fieldTeamCount = people.filter((person) => person.portalType === "team" || person.isFieldUser).length;
  const peopleNeedingReview = people.filter((person) => person.source === "member" && (!person.portalType || !person.jobTitle || !person.workLocation)).length;

  const activityItems = useMemo(() => {
    const assigned = workOrders
      .filter((item) => item.assigned_to_user_id)
      .slice(0, 4)
      .map((item) => ({
        title: item.title || "Work order",
        body: `${statusLabel(item.status)} assignment updated`,
        time: formatRelative(item.updated_at),
      }));
    const pending = invites.slice(0, 2).map((invite) => ({
      title: invite.display_name || invite.email,
      body: `Invite pending as ${formatRole(invite.role)}`,
      time: formatRelative(invite.created_at),
    }));
    return [...assigned, ...pending].slice(0, 5);
  }, [invites, workOrders]);

  async function resolveOrg() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);
    const userId = data.user?.id;
    if (!userId) throw new Error("No authenticated user found.");

    const activeOrgId = orgId || (await getUserOrgId(userId));
    if (!activeOrgId) throw new Error("Could not determine the active organization.");
    if (!orgId) setOrgId(activeOrgId);
    return { orgId: activeOrgId, userId };
  }

  async function loadTeamHub() {
    setLoading(true);
    setPageError("");

    try {
      const { orgId: activeOrgId } = await resolveOrg();
      const membersRes = await supabase
        .from("org_members")
        .select("id, user_id, role, status, display_name, email, phone, job_title, department, employee_type, employment_status, manager_member_id, portal_type, is_field_user, mobile_access_enabled, desktop_access_enabled, work_location, profile_photo_url, last_active_at, permissions, created_at")
        .eq("org_id", activeOrgId)
        .order("created_at", { ascending: false });

      let nextMembers: TeamMember[] = [];
      if (membersRes.error) {
        const fallback = await supabase
          .from("org_members")
          .select("id, user_id, role, status, display_name, created_at")
          .eq("org_id", activeOrgId)
          .order("created_at", { ascending: false });
        if (fallback.error) throw new Error(fallback.error.message);
        nextMembers = (fallback.data ?? []) as TeamMember[];
      } else {
        nextMembers = (membersRes.data ?? []) as TeamMember[];
      }

      const invitesRes = await supabase
        .from("org_invites")
        .select("id, email, role, status, display_name, phone, job_title, profile_photo_url, portal_type, mobile_access_enabled, desktop_access_enabled, permissions, created_at")
        .eq("org_id", activeOrgId)
        .order("created_at", { ascending: false });

      const nextInvites = invitesRes.error ? [] : ((invitesRes.data ?? []) as TeamInvite[]);

      const workOrdersRes = await supabase
        .from("work_orders")
        .select("id, title, status, assigned_to_user_id, updated_at")
        .eq("org_id", activeOrgId)
        .order("updated_at", { ascending: false })
        .limit(300);
      if (workOrdersRes.error) throw new Error(workOrdersRes.error.message);

      const customRolesRes = await supabase
        .from("organization_roles")
        .select("id, name, role_key, description, color, portal_type, permissions, is_system")
        .eq("org_id", activeOrgId)
        .order("created_at", { ascending: true });

      if (!customRolesRes.error && customRolesRes.data?.length) {
        const customRoles = (customRolesRes.data as OrganizationRoleRow[]).map(roleRowToTemplate);
        setRoleTemplates([...SYSTEM_ROLE_TEMPLATES, ...customRoles]);
        setRolePermissions((prev) => {
          const next = { ...prev };
          customRoles.forEach((role) => {
            next[role.id] = role.permissions;
          });
          return next;
        });
      }

      setMembers(nextMembers.map((member) => ({
        ...member,
        role: normalizeRole(member.role),
        permissions: normalizePermissions(member.permissions, member.role),
      })));
      setInvites(nextInvites.filter((invite) => invite.status !== "accepted").map((invite) => ({
        ...invite,
        role: normalizeRole(invite.role),
        permissions: normalizePermissions(invite.permissions, invite.role),
      })));
      setWorkOrders((workOrdersRes.data ?? []) as WorkOrderLite[]);

      const activityRes = await supabase
        .from("activity_log")
        .select("id, actor_name, action, created_at")
        .eq("org_id", activeOrgId)
        .order("created_at", { ascending: false })
        .limit(30);
      setTeamActivity((activityRes.data ?? []) as { id: string; actor_name: string | null; action: string; created_at: string }[]);
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to load team data.");
    } finally {
      setLoading(false);
    }
  }

  async function addMemberInvite() {
    setFormError("");
    setPageMessage("");
    const email = addMemberForm.email.trim().toLowerCase();

    if (!addMemberForm.name.trim()) {
      setFormError("Please enter a name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setSavingInvite(true);
    try {
      const { orgId: activeOrgId, userId } = await resolveOrg();
      const basePayload = {
        org_id: activeOrgId,
        email,
        role: addMemberForm.role,
        status: addMemberForm.status,
        invited_by_user_id: userId,
      };
      let insertRes = await supabase
        .from("org_invites")
        .insert({
          ...basePayload,
          display_name: addMemberForm.name.trim(),
          phone: addMemberForm.phone.trim() || null,
          profile_photo_url: addMemberForm.profilePhotoUrl.trim() || null,
          portal_type: addMemberForm.portalType,
          mobile_access_enabled: addMemberForm.mobileAccessEnabled,
          desktop_access_enabled: addMemberForm.desktopAccessEnabled,
          permissions: ROLE_PERMISSIONS[addMemberForm.role],
        })
        .select("id, email, role, status, display_name, phone, profile_photo_url, portal_type, mobile_access_enabled, desktop_access_enabled, permissions, created_at")
        .single();

      if (insertRes.error) {
        insertRes = await supabase
          .from("org_invites")
          .insert(basePayload)
          .select("id, email, role, status, created_at")
          .single();
      }
      if (insertRes.error) throw new Error(insertRes.error.message);

      const inviteId = insertRes.data?.id;
      if (inviteId) {
        const appUrl = typeof window !== "undefined" ? window.location.origin : undefined;
        await supabase.functions.invoke("send-invite", {
          body: { email, invite_id: inviteId, app_url: appUrl },
        });
      }

      setShowAddMember(false);
      setAddMemberForm(emptyAddMemberForm);
      setPageMessage(`Invite sent to ${email}.`);
      await loadTeamHub();
    } catch (error: any) {
      setFormError(error?.message ?? "Failed to add member invite.");
    } finally {
      setSavingInvite(false);
    }
  }

  function toggleRolePermission(permission: Permission) {
    const current = rolePermissions[selectedRole.id] ?? [];
    const next = current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission];
    setRolePermissions((prev) => ({ ...prev, [selectedRole.id]: next }));

    // Persist to DB for custom roles
    if (!selectedRole.isSystem) {
      void supabase
        .from("organization_roles")
        .update({ permissions: next, updated_at: new Date().toISOString() })
        .eq("id", selectedRole.id);
    }
  }

  async function createCustomRole() {
    const name = newRoleForm.name.trim();
    if (!name) return;

    const base = SYSTEM_ROLE_TEMPLATES.find((role) => role.role === newRoleForm.baseRole) ?? SYSTEM_ROLE_TEMPLATES[0];
    const draftRole: TeamRole = {
      id: `custom-${Date.now()}`,
      label: name,
      role: newRoleForm.baseRole,
      description: `Custom role based on ${base.label}.`,
      color: newRoleForm.color || theme.colors.gold,
      portalType: base.portalType,
      isSystem: false,
      permissions: [...(rolePermissions[base.id] ?? base.permissions)],
    };

    let nextRole = draftRole;

    try {
      const { orgId: activeOrgId } = await resolveOrg();
      const insertRes = await supabase
        .from("organization_roles")
        .insert({
          org_id: activeOrgId,
          name,
          role_key: newRoleForm.baseRole,
          description: draftRole.description,
          color: draftRole.color,
          portal_type: draftRole.portalType,
          permissions: draftRole.permissions,
          is_system: false,
        })
        .select("id, name, role_key, description, color, portal_type, permissions, is_system")
        .single();

      if (!insertRes.error && insertRes.data) {
        nextRole = roleRowToTemplate(insertRes.data as OrganizationRoleRow);
      }
    } catch {
      // Keep the builder usable before the custom roles migration is applied.
    }

    setRoleTemplates((prev) => [...prev, nextRole]);
    setRolePermissions((prev) => ({ ...prev, [nextRole.id]: nextRole.permissions }));
    setSelectedRole(nextRole);
    setNewRoleForm(emptyNewRoleForm);
    setShowRoleModal(false);
  }

  async function cancelInvite(inviteId: string) {
    try {
      const { error } = await supabase
        .from("org_invites")
        .update({ status: "cancelled" })
        .eq("id", inviteId);
      if (error) throw new Error(error.message);
      setPageMessage("Invite cancelled.");
      await loadTeamHub();
    } catch (err: any) {
      setPageError(err?.message ?? "Failed to cancel invite.");
    }
  }

  async function saveMember(id: string, updates: { name: string; email: string; phone: string; jobTitle: string; department: string; role: UserRole; status: "active" | "inactive" }) {
    const { error } = await supabase
      .from("org_members")
      .update({
        display_name: updates.name || null,
        email: updates.email || null,
        phone: updates.phone || null,
        job_title: updates.jobTitle || null,
        department: updates.department || null,
        role: updates.role,
        status: updates.status,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    setPageMessage("Member updated.");
    setSelectedRecord(null);
    await loadTeamHub();
  }

  return (
    <Screen padded={false}>
      <AppPage>
        <PageHeader
          eyebrow="Operations"
          title="Team"
          subtitle="Manage employees, roles, permissions, and field assignment signals from one operations hub."
          actions={[
            { label: "Refresh", onPress: loadTeamHub },
            { label: "+ Add Member", onPress: () => setShowAddMember(true), primary: true },
          ]}
        />

        <SummaryStrip>
          <SummaryCard label="Active today" value={String(activeToday)} meta="Available team members" accent="teal" />
          <SummaryCard label="Pending invites" value={String(pendingInviteCount)} meta="Waiting for acceptance" accent="lavender" />
          <SummaryCard label="Field team" value={String(fieldTeamCount)} meta="Team portal users" accent="plum" />
          <SummaryCard label="Needs review" value={String(peopleNeedingReview)} meta="Missing profile/workforce data" accent="indigo" />
        </SummaryStrip>

        {pageError ? <Text style={styles.errorText}>{pageError}</Text> : null}
        {pageMessage ? <Text style={styles.successText}>{pageMessage}</Text> : null}

        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <FilterPill
              key={tab}
              label={tab === "Roles" ? "Roles & Access" : tab}
              active={activeTab === tab}
              onPress={() => setActiveTab(tab)}
            />
          ))}
        </View>

        {activeTab === "Members" ? (
          <MembersTable
            loading={loading}
            people={filteredPeople}
            roleFilters={roleFilters}
            locationFilters={locationFilters}
            roleFilter={roleFilter}
            locationFilter={locationFilter}
            statusFilter={statusFilter}
            assignmentFilter={assignmentFilter}
            sortKey={sortKey}
            query={query}
            assignedJobCountByUser={assignedJobCountByUser}
            onQueryChange={setQuery}
            onRoleFilter={setRoleFilter}
            onLocationFilter={setLocationFilter}
            onStatusFilter={setStatusFilter}
            onAssignmentFilter={setAssignmentFilter}
            onSort={setSortKey}
            onAddMember={() => setShowAddMember(true)}
            onOpenMember={setSelectedRecord}
            onCancelInvite={cancelInvite}
          />
        ) : null}

        {activeTab === "Roles" ? (
          <RolesPanel
            selectedRole={selectedRole}
            roles={roleTemplates}
            rolePermissions={rolePermissions}
            onSelectRole={setSelectedRole}
            onToggle={toggleRolePermission}
            onReset={() =>
              setRolePermissions((prev) => ({
                ...prev,
                [selectedRole.id]: [...(selectedRole.isSystem ? ROLE_PERMISSIONS[selectedRole.role] : selectedRole.permissions)],
              }))
            }
            onNewRole={() => setShowRoleModal(true)}
          />
        ) : null}

        {activeTab === "Activity" ? (
          <ActivityPanel activityItems={
            teamActivity.length > 0
              ? teamActivity.map((item) => ({
                  title: item.actor_name ?? "System",
                  body: item.action,
                  time: formatRelative(item.created_at),
                }))
              : activityItems
          } />
        ) : null}

        <AddMemberModal
          visible={showAddMember}
          form={addMemberForm}
          formError={formError}
          saving={savingInvite}
          onChange={setAddMemberForm}
          onClose={() => setShowAddMember(false)}
          onSubmit={addMemberInvite}
        />

        <NewRoleModal
          visible={showRoleModal}
          form={newRoleForm}
          onChange={setNewRoleForm}
          onClose={() => setShowRoleModal(false)}
          onSubmit={() => void createCustomRole()}
        />

        <MemberDetailModal
          record={selectedRecord}
          assignedJobCountByUser={assignedJobCountByUser}
          onClose={() => setSelectedRecord(null)}
          onSave={saveMember}
        />
      </AppPage>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  list: {
    gap: 10,
  },
  activityRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: theme.colors.surface,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  listCopy: {
    flex: 1,
    minWidth: 0,
  },
  listTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  listMeta: {
    marginTop: 2,
    color: theme.colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },
  listTime: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  controlsRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchWrap: {
    flex: 1,
    minWidth: 260,
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  search: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  pillRow: {
    gap: 8,
  },
  filterPill: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  filterPillActive: {
    backgroundColor: theme.colors.surface2,
    borderColor: "#BFDBFE",
  },
  filterPillText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 12.5,
  },
  filterPillTextActive: {
    color: theme.colors.goldDark,
  },
  table: {
    minWidth: 940,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  tableHead: {
    minHeight: 46,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  th: {
    color: theme.colors.muted,
    fontWeight: "900",
    fontSize: 11.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tr: {
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  trStriped: {
    backgroundColor: "#F8FAFC",
  },
  trPressed: {
    backgroundColor: "#EFF6FF",
  },
  td: {
    color: theme.colors.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  tdStrong: {
    color: theme.colors.ink,
    fontWeight: "900",
    fontSize: 13.5,
  },
  tdMeta: {
    color: theme.colors.muted,
    fontWeight: "600",
    fontSize: 12,
  },
  colName: { width: 240 },
  colRole: { width: 140 },
  colStatus: { width: 110 },
  colAssigned: { width: 120, textAlign: "center" },
  colActive: { width: 120 },
  colActions: { width: 160 },
  personCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: theme.colors.goldDark,
    fontSize: 13,
    fontWeight: "900",
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  personCopy: {
    flex: 1,
    minWidth: 0,
  },
  roleBadge: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  roleBadgeText: {
    color: theme.colors.goldDark,
    fontSize: 12,
    fontWeight: "900",
  },
  statusBadge: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  statusActive: {
    backgroundColor: theme.colors.successBg,
    borderColor: theme.colors.successBorder,
  },
  statusPending: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  statusInactive: {
    backgroundColor: "#F3F4F6",
    borderColor: theme.colors.border,
  },
  statusText: {
    color: theme.colors.ink,
    fontSize: 11.5,
    fontWeight: "900",
  },
  actionsCell: {
    flexDirection: "row",
    gap: 8,
  },
  smallAction: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  smallActionText: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  smallActionDanger: {
    borderColor: "#efc8bc",
    backgroundColor: "#fff3ef",
  },
  smallActionDangerText: {
    color: "#9f3b2f",
  },
  rolesLayout: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
  },
  roleRail: {
    flexGrow: 1,
    flexBasis: 280,
    gap: 10,
  },
  roleOption: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  roleOptionActive: {
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface2,
  },
  roleOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleColorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  roleOptionTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  roleOptionTitleActive: {
    color: theme.colors.goldDark,
  },
  roleOptionMeta: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },
  roleOptionFooter: {
    marginTop: 8,
    color: theme.colors.goldDark,
    fontSize: 11.5,
    fontWeight: "900",
  },
  newRoleButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    backgroundColor: theme.colors.surface2,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  newRoleButtonText: {
    color: theme.colors.goldDark,
    fontSize: 13,
    fontWeight: "900",
  },
  permissionPanel: {
    flexGrow: 999,
    flexBasis: 620,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    backgroundColor: theme.colors.surface,
  },
  permissionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  permissionTitle: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  permissionSubtitle: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  permissionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  accessPreview: {
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    backgroundColor: theme.colors.surface2,
    padding: 14,
    gap: 6,
  },
  accessPreviewText: {
    color: theme.colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
  },
  permissionGroup: {
    flexGrow: 1,
    flexBasis: 240,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  permissionGroupTitle: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  permissionRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  permissionRowPressed: {
    opacity: 0.9,
  },
  permissionLabel: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 12.5,
    fontWeight: "700",
  },
  toggle: {
    width: 38,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: theme.colors.gold,
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  primaryButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonPressed: {
    backgroundColor: theme.colors.goldDark,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonPressed: {
    backgroundColor: theme.colors.surface2,
    borderColor: "#BFDBFE",
  },
  secondaryButtonText: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalTitle: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  modalSubtitle: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  uploadBox: {
    minHeight: 74,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  uploadBoxText: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  uploadBoxMeta: {
    marginLeft: "auto",
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  modalPillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchActive: {
    borderColor: theme.colors.ink,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    paddingTop: 4,
  },
  detailGrid: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  detailRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  detailLabel: {
    color: theme.colors.muted,
    fontSize: 12.5,
    fontWeight: "800",
  },
  detailValue: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  permissionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  miniChip: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface2,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  miniChipText: {
    color: theme.colors.goldDark,
    fontSize: 11.5,
    fontWeight: "900",
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: "800",
  },
  successText: {
    color: theme.colors.success,
    fontSize: 13,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.92,
  },
});
