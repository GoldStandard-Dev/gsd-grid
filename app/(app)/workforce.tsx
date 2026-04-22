import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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

type TeamSavedView = "all" | "technicians" | "office" | "pending" | "unassigned" | "needs_setup";
type MemberStatus = "All" | "active" | "inactive" | "pending";
type AssignmentFilter = "All" | "Assigned" | "Unassigned";
type DirectorySort = "Newest" | "Name" | "Role" | "Location";
type TeamViewMode = "list" | "grid";
type WorkforceSection = "overview" | "members" | "resources" | "performance";
type MemberFocusFilter = "none" | "idle";

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
  department?: string | null;
  employee_type?: string | null;
  manager_member_id?: string | null;
  work_location?: string | null;
  start_date?: string | null;
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
  due_date?: string | null;
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
  jobTitle: string;
  department: string;
  workLocation: string;
  employeeType: string;
  managerMemberId: string;
  startDate: string;
  role: UserRole;
  status: "active" | "pending";
  portalType: PortalType;
  mobileAccessEnabled: boolean;
  desktopAccessEnabled: boolean;
};

type ConfirmAction = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
};

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
const TEAM_SAVED_VIEWS: { key: TeamSavedView; label: string }[] = [
  { key: "all", label: "All" },
  { key: "technicians", label: "Technicians" },
  { key: "office", label: "Office" },
  { key: "pending", label: "Pending" },
  { key: "unassigned", label: "Unassigned" },
  { key: "needs_setup", label: "Needs Setup" },
];
const WORKFORCE_SECTIONS: { key: WorkforceSection; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "members", label: "Members" },
  { key: "resources", label: "Resources" },
  { key: "performance", label: "Performance" },
];
const EMPLOYEE_TYPES = ["Full-time", "Part-time", "Contractor", "Seasonal", "Vendor"];
const DEFAULT_DEPARTMENTS = ["Field Operations", "Office", "Dispatch", "Finance", "Sales"];
const DEFAULT_LOCATIONS = ["Main Office", "Field", "Warehouse", "Remote"];

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
  jobTitle: "",
  department: "",
  workLocation: "",
  employeeType: "Full-time",
  managerMemberId: "",
  startDate: "",
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

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function PhotoUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function pick() {
    setError("");
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { setError("Camera roll permission required."); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? "anon";
      const ext = asset.uri.split(".").pop()?.split("?")[0] ?? "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;

      if (Platform.OS === "web") {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: blob.type });
        if (uploadError) throw uploadError;
      } else {
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, { uri: asset.uri, type: `image/${ext}`, name: path } as any, { upsert: true });
        if (uploadError) throw uploadError;
      }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      onChange(urlData.publicUrl);
    } catch (err: any) {
      setError(err?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>Profile Photo</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {value ? (
          <Image source={{ uri: value }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatarImage, { backgroundColor: theme.colors.surface2, alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="person-outline" size={22} color={theme.colors.muted} />
          </View>
        )}
        <View style={{ flex: 1, gap: 8 }}>
          <Pressable
            onPress={pick}
            disabled={uploading}
            style={({ pressed }) => [styles.secondaryButton, { flex: 0 }, pressed ? styles.secondaryButtonPressed : null]}
          >
            {uploading
              ? <ActivityIndicator size="small" color={theme.colors.ink} />
              : <Text style={styles.secondaryButtonText}>{value ? "Change photo" : "Upload photo"}</Text>
            }
          </Pressable>
          {value ? (
            <Pressable onPress={() => onChange("")} style={({ pressed }) => [styles.secondaryButton, { flex: 0 }, pressed ? styles.secondaryButtonPressed : null]}>
              <Text style={[styles.secondaryButtonText, { color: theme.colors.danger }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {error ? <Text style={[styles.errorText, { marginTop: 4 }]}>{error}</Text> : null}
    </View>
  );
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

function getManagerName(record: TeamRecord, people: TeamRecord[]) {
  if (!record.managerMemberId) return "Unassigned";
  return people.find((person) => person.id === record.managerMemberId)?.name ?? "Unassigned";
}

function getMemberLocation(record: TeamRecord) {
  return record.workLocation || record.department || "Unassigned";
}

function getWorkloadStatus(count: number) {
  if (count >= 6) return "Overloaded";
  if (count >= 3) return "Busy";
  if (count >= 1) return "Assigned";
  return "Open";
}

function getCapacityLabel(count: number) {
  if (count >= 6) return "At capacity";
  if (count >= 3) return "Near capacity";
  if (count >= 1) return "Available";
  return "Needs assignment";
}

function isOwnerRecord(record: TeamRecord) {
  return normalizeRole(record.role) === "owner";
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

function getSectionTitle(section: WorkforceSection) {
  if (section === "members") return "Members";
  if (section === "resources") return "Resources";
  if (section === "performance") return "Performance";
  return "Overview";
}

function getSectionSubtitle(section: WorkforceSection) {
  if (section === "members") return "Search, filter, and manage individual team records.";
  if (section === "resources") return "Documents, videos, training, and SOPs assigned to roles.";
  if (section === "performance") return "A simple visual read on workload and completion signals.";
  return "Metrics, attention items, and quick actions for daily ownership.";
}

function isOlderThanDays(value: string | null | undefined, days: number) {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  return Date.now() - date.getTime() > days * 24 * 60 * 60 * 1000;
}

function isWorkOrderPastDue(item: WorkOrderLite) {
  if (!item.due_date) return false;
  const status = String(item.status ?? "").toLowerCase();
  if (["closed", "completed", "canceled", "cancelled"].includes(status)) return false;

  const due = new Date(item.due_date);
  if (Number.isNaN(due.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function getStartOfWeek() {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function MembersTable({
  loading,
  people,
  viewMode,
  assignedJobCountByUser,
  onAddMember,
  onOpenMember,
  onCancelInvite,
}: {
  loading: boolean;
  people: TeamRecord[];
  viewMode: TeamViewMode;
  assignedJobCountByUser: Map<string, number>;
  onAddMember: () => void;
  onOpenMember: (value: TeamRecord) => void;
  onCancelInvite: (record: TeamRecord) => void;
}) {
  const showEmpty = !loading && people.length === 0;

  return (
    <ContentCard title="Members" subtitle="Directory records for staff and pending invites." meta={loading ? "Loading..." : `${people.length} shown`}>
      {loading ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Loading members...</Text>
        </View>
      ) : showEmpty ? (
        <EmptyState icon="people-outline" title="No team members found" body="Adjust the filters or add the first member to start building your operations team." actionLabel="+ Add Member" onAction={onAddMember} />
      ) : viewMode === "grid" ? (
        <View style={styles.memberCardGrid}>
          {people.map((person) => {
            const assignedCount = person.userId ? assignedJobCountByUser.get(person.userId) ?? 0 : 0;
            return (
              <Pressable
                key={`${person.source}-${person.id}`}
                onPress={() => onOpenMember(person)}
                style={({ pressed }) => [styles.memberCard, pressed ? styles.memberCardPressed : null]}
              >
                <View style={styles.memberCardHeader}>
                  <Avatar name={person.name} uri={person.profilePhotoUrl} />
                  <View style={styles.personCopy}>
                    <Text style={styles.tdStrong} numberOfLines={1}>{person.name}</Text>
                    <Text style={styles.tdMeta} numberOfLines={1}>{person.email || person.jobTitle || "Team member"}</Text>
                  </View>
                </View>
                <View style={styles.memberCardMetaRow}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{formatRole(person.role)}</Text>
                  </View>
                  <View style={[styles.statusBadge, statusStyle(person.status)]}>
                    <Text style={styles.statusText}>{titleCase(person.status)}</Text>
                  </View>
                </View>
                <View style={styles.memberCardFooter}>
                  <Text style={styles.tdMeta}>{assignedCount} assigned jobs</Text>
                  <Text style={styles.tdMeta}>{getMemberLocation(person)}</Text>
                </View>
                {person.source === "invite" ? (
                  <Pressable
                    onPress={(event) => { event.stopPropagation?.(); onCancelInvite(person); }}
                    style={({ pressed }) => [styles.smallAction, styles.smallActionDanger, pressed ? styles.pressed : null]}
                  >
                    <Text style={[styles.smallActionText, styles.smallActionDangerText]}>Cancel invite</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberTableScrollContent}>
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
                        onPress={(e) => { e.stopPropagation?.(); onCancelInvite(person); }}
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
      )}
    </ContentCard>
  );
}

function WorkforceNav({
  activeSection,
  onSectionChange,
}: {
  activeSection: WorkforceSection;
  onSectionChange: (value: WorkforceSection) => void;
}) {
  return (
    <View style={styles.stickyNavWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionNav}>
        {WORKFORCE_SECTIONS.map((section) => {
          const active = activeSection === section.key;
          return (
            <Pressable
              key={section.key}
              onPress={() => onSectionChange(section.key)}
              style={({ pressed }) => [styles.sectionNavPill, active ? styles.sectionNavPillActive : null, pressed ? styles.pressed : null]}
            >
              <Text style={[styles.sectionNavText, active ? styles.sectionNavTextActive : null]}>{section.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function DeepViewHeader({
  section,
  onBack,
}: {
  section: WorkforceSection;
  onBack: () => void;
}) {
  if (section === "overview") return null;

  return (
    <View style={styles.deepHeader}>
      <View style={styles.listCopy}>
        <Text style={styles.deepTitle}>{getSectionTitle(section)}</Text>
        <Text style={styles.deepSubtitle}>{getSectionSubtitle(section)}</Text>
      </View>
      <Pressable onPress={onBack} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null]}>
        <Text style={styles.secondaryButtonText}>Back to Overview</Text>
      </Pressable>
    </View>
  );
}

function TeamControls({
  savedView,
  savedViewCounts,
  query,
  viewMode,
  statusFilter,
  assignmentFilter,
  locationFilter,
  locationFilters,
  sortKey,
  onSavedView,
  onQueryChange,
  onViewMode,
  onStatusFilter,
  onAssignmentFilter,
  onLocationFilter,
  onSort,
  onAddMember,
}: {
  savedView: TeamSavedView;
  savedViewCounts: Record<TeamSavedView, number>;
  query: string;
  viewMode: TeamViewMode;
  statusFilter: MemberStatus;
  assignmentFilter: AssignmentFilter;
  locationFilter: string;
  locationFilters: string[];
  sortKey: DirectorySort;
  onSavedView: (value: TeamSavedView) => void;
  onQueryChange: (value: string) => void;
  onViewMode: (value: TeamViewMode) => void;
  onStatusFilter: (value: MemberStatus) => void;
  onAssignmentFilter: (value: AssignmentFilter) => void;
  onLocationFilter: (value: string) => void;
  onSort: (value: DirectorySort) => void;
  onAddMember: () => void;
}) {
  return (
    <ContentCard title="Team controls" subtitle="Saved views, search, and focused filters.">
      <View style={styles.primaryViewsBlock}>
        <Text style={styles.filterGroupLabel}>Saved Views</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.primaryViewsRow}>
          {TEAM_SAVED_VIEWS.map((view) => {
            const active = savedView === view.key;
            const count = savedViewCounts[view.key] ?? 0;
            return (
              <Pressable
                key={view.key}
                onPress={() => onSavedView(view.key)}
                style={({ pressed }) => [styles.primaryViewPill, active ? styles.primaryViewPillActive : null, pressed ? styles.pressed : null]}
              >
                <Text style={[styles.primaryViewText, active ? styles.primaryViewTextActive : null]}>{view.label} ({count})</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.searchControlRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={theme.colors.muted} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search members"
            placeholderTextColor={theme.colors.muted}
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.viewModeRow}>
          {([
            ["list", "list-outline"],
            ["grid", "grid-outline"],
          ] as const).map(([mode, icon]) => {
            const active = viewMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => onViewMode(mode)}
                style={({ pressed }) => [styles.viewModeBtn, active ? styles.viewModeBtnActive : null, pressed ? styles.pressed : null]}
              >
                <Ionicons name={icon} size={16} color={active ? theme.colors.goldDark : theme.colors.muted} />
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={onAddMember} style={({ pressed }) => [styles.controlCta, pressed ? styles.controlCtaPressed : null]}>
          <Text style={styles.controlCtaText}>+ Add Member</Text>
        </Pressable>
      </View>

      <View style={styles.filterGroups}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {MEMBER_STATUSES.map((value) => (
              <FilterPill key={value} label={value === "All" ? "All" : titleCase(value)} active={statusFilter === value} onPress={() => onStatusFilter(value)} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Assignment</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {ASSIGNMENT_FILTERS.map((value) => (
              <FilterPill key={value} label={value} active={assignmentFilter === value} onPress={() => onAssignmentFilter(value)} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Location</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {locationFilters.map((value) => (
              <FilterPill key={value} label={value} active={locationFilter === value} onPress={() => onLocationFilter(value)} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Sort</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {(["Newest", "Name", "Role", "Location"] as DirectorySort[]).map((value) => (
              <FilterPill key={value} label={value} active={sortKey === value} onPress={() => onSort(value)} />
            ))}
          </ScrollView>
        </View>
      </View>
    </ContentCard>
  );
}

function AttentionPanel({
  unassignedPeople,
  idlePeople,
  pendingInvites,
  missingProfilePeople,
  overdueWorkOrders,
  onAddMember,
  onDrilldown,
}: {
  unassignedPeople: TeamRecord[];
  idlePeople: TeamRecord[];
  pendingInvites: TeamRecord[];
  missingProfilePeople: TeamRecord[];
  overdueWorkOrders: WorkOrderLite[];
  onAddMember: () => void;
  onDrilldown: (key: "unassigned" | "idle" | "pending" | "setup" | "overdue") => void;
}) {
  const items = [
    {
      key: "unassigned",
      icon: "person-remove-outline" as const,
      title: `${unassignedPeople.length} member${unassignedPeople.length === 1 ? "" : "s"} not assigned to any work`,
      body: unassignedPeople.slice(0, 3).map((person) => person.name).join(", ") || "Every active member has work assigned.",
      tone: unassignedPeople.length ? "warning" : "good",
      record: unassignedPeople[0],
    },
    {
      key: "idle",
      icon: "time-outline" as const,
      title: `${idlePeople.length} member${idlePeople.length === 1 ? "" : "s"} idle for 3+ days`,
      body: idlePeople.slice(0, 3).map((person) => person.name).join(", ") || "Recent member activity looks current.",
      tone: idlePeople.length ? "danger" : "good",
      record: idlePeople[0],
    },
    {
      key: "pending",
      icon: "mail-unread-outline" as const,
      title: `${pendingInvites.length} pending invite${pendingInvites.length === 1 ? "" : "s"}`,
      body: pendingInvites.slice(0, 3).map((person) => person.email || person.name).join(", ") || "No pending invites.",
      tone: pendingInvites.length ? "warning" : "good",
      record: pendingInvites[0],
    },
    {
      key: "setup",
      icon: "alert-circle-outline" as const,
      title: `${missingProfilePeople.length} member${missingProfilePeople.length === 1 ? "" : "s"} missing profile info`,
      body: missingProfilePeople.slice(0, 3).map((person) => person.name).join(", ") || "Required member details are filled in.",
      tone: missingProfilePeople.length ? "warning" : "good",
      record: missingProfilePeople[0],
    },
    {
      key: "overdue",
      icon: "clipboard-outline" as const,
      title: `${overdueWorkOrders.length} overdue assigned work order${overdueWorkOrders.length === 1 ? "" : "s"}`,
      body: overdueWorkOrders.slice(0, 3).map((item) => item.title || "Work order").join(", ") || "No overdue assigned work orders found.",
      tone: overdueWorkOrders.length ? "danger" : "good",
    },
  ];

  const needsAction = items.reduce((sum, item) => {
    if (item.key === "overdue") return sum + overdueWorkOrders.length;
    if (item.key === "unassigned") return sum + unassignedPeople.length;
    if (item.key === "idle") return sum + idlePeople.length;
    if (item.key === "pending") return sum + pendingInvites.length;
    return sum + missingProfilePeople.length;
  }, 0);

  return (
    <ContentCard title="Attention" subtitle="Owner-level items that need action first." meta={`${needsAction} open`}>
      <View style={styles.attentionGrid}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => {
              const key = item.key as "unassigned" | "idle" | "pending" | "setup" | "overdue";
              if (key === "pending" && !item.record) onAddMember();
              onDrilldown(key);
            }}
            style={({ pressed }) => [
              styles.attentionItem,
              item.tone === "danger" ? styles.attentionDanger : item.tone === "warning" ? styles.attentionWarning : styles.attentionGood,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.attentionIcon}>
              <Ionicons name={item.icon} size={17} color={item.tone === "danger" ? "#B42318" : item.tone === "warning" ? theme.colors.goldDark : "#047857"} />
            </View>
            <View style={styles.listCopy}>
              <Text style={styles.listTitle}>{item.title}</Text>
              <Text style={styles.listMeta}>{item.body}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ContentCard>
  );
}

function TeamResourcesPanel({ onUpload }: { onUpload: () => void }) {
  const resources = [
    { title: "Safety Guidelines.pdf", type: "Document", meta: "Technicians", icon: "document-text-outline" as const },
    { title: "Installation Standards", type: "SOP", meta: "Field roles", icon: "construct-outline" as const },
    { title: "Training Videos", type: "Video", meta: "New hires", icon: "play-circle-outline" as const },
    { title: "SOPs", type: "Folder", meta: "Managers and technicians", icon: "folder-open-outline" as const },
  ];
  const [selectedResource, setSelectedResource] = useState<(typeof resources)[number] | null>(null);

  return (
    <ContentCard title="Resources" subtitle="Documents, training, and standards assigned to roles." meta={`${resources.length} resources`}>
      <View style={styles.resourceHeader}>
        <Pressable onPress={onUpload} style={({ pressed }) => [styles.controlCta, pressed ? styles.controlCtaPressed : null]}>
          <Text style={styles.controlCtaText}>Upload</Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
          {["Technician", "Manager", "Office", "All Roles"].map((role) => (
            <View key={role} style={styles.resourceRolePill}>
              <Text style={styles.resourceRoleText}>{role}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.resourceGrid}>
        {resources.map((resource) => (
          <Pressable key={resource.title} onPress={() => setSelectedResource(resource)} style={({ pressed }) => [styles.resourceCard, pressed ? styles.memberCardPressed : null]}>
            <View style={styles.iconTile}>
              <Ionicons name={resource.icon} size={17} color={theme.colors.goldDark} />
            </View>
            <View style={styles.resourceCopy}>
              <Text style={styles.listTitle}>{resource.title}</Text>
              <Text style={styles.listMeta}>{resource.type} / {resource.meta}</Text>
            </View>
            <View style={styles.resourceActions}>
              <View style={styles.resourceRolePill}>
                <Text style={styles.resourceRoleText}>Assigned</Text>
              </View>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation?.();
                  setSelectedResource(resource);
                }}
                style={({ pressed }) => [styles.smallAction, pressed ? styles.pressed : null]}
              >
                <Text style={styles.smallActionText}>Open</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
      </View>

      <Modal visible={!!selectedResource} transparent animationType="fade" onRequestClose={() => setSelectedResource(null)}>
        <View style={styles.resourcePreviewBackdrop}>
          <Pressable style={styles.resourcePreviewScrim} onPress={() => setSelectedResource(null)} />
          <View style={styles.resourcePreviewPanel}>
            {selectedResource ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.confirmCopy}>
                    <Text style={styles.modalTitle}>{selectedResource.title}</Text>
                    <Text style={styles.modalSubtitle}>{selectedResource.type} / assigned to {selectedResource.meta}</Text>
                  </View>
                  <Pressable onPress={() => setSelectedResource(null)} style={styles.iconButton}>
                    <Ionicons name="close-outline" size={20} color={theme.colors.ink} />
                  </Pressable>
                </View>
                <View style={styles.resourcePreviewBody}>
                  <Ionicons name={selectedResource.icon} size={28} color={theme.colors.goldDark} />
                  <Text style={styles.permissionTitle}>Preview panel</Text>
                  <Text style={styles.accessPreviewText}>Document preview, role assignment, completion status, and training requirements can connect here without leaving the workforce page.</Text>
                </View>
                <View style={styles.modalActions}>
                  <Pressable onPress={onUpload} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null]}>
                    <Text style={styles.secondaryButtonText}>Assign Roles</Text>
                  </Pressable>
                  <Pressable onPress={() => setSelectedResource(null)} style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}>
                    <Text style={styles.primaryButtonText}>Done</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ContentCard>
  );
}

function WorkforcePerformancePanel({
  avgJobsPerTech,
  completedThisWeek,
  mostActiveTechnician,
  leastActiveTechnician,
  technicianRows,
}: {
  avgJobsPerTech: string;
  completedThisWeek: number;
  mostActiveTechnician?: { name: string; count: number };
  leastActiveTechnician?: { name: string; count: number };
  technicianRows: { name: string; count: number }[];
}) {
  const maxCount = Math.max(...technicianRows.map((row) => row.count), 1);

  return (
    <ContentCard title="Workforce Performance" subtitle="Simple operating signals for owner review.">
      <View style={styles.performanceChart}>
        {technicianRows.slice(0, 6).map((row) => (
          <View key={row.name} style={styles.chartRow}>
            <Text style={styles.chartName} numberOfLines={1}>{row.name}</Text>
            <View style={styles.chartTrack}>
              <View style={[styles.chartBar, { width: `${Math.max((row.count / maxCount) * 100, row.count ? 10 : 2)}%` }]} />
            </View>
            <Text style={styles.chartValue}>{row.count}</Text>
          </View>
        ))}
        {technicianRows.length === 0 ? (
          <EmptyState icon="bar-chart-outline" title="No technician data yet" body="Technician workload will appear once members and work orders are connected." />
        ) : null}
      </View>

      <View style={styles.performanceGrid}>
        <MiniMetric label="Avg jobs per tech" value={avgJobsPerTech} />
        <MiniMetric label="Completed this week" value={String(completedThisWeek)} />
        <MiniMetric label="Most active technician" value={mostActiveTechnician ? `${mostActiveTechnician.name} (${mostActiveTechnician.count})` : "-"} />
        <MiniMetric label="Least active technician" value={leastActiveTechnician ? `${leastActiveTechnician.name} (${leastActiveTechnician.count})` : "-"} />
      </View>
    </ContentCard>
  );
}

function MemberHealthPanel({
  activeCount,
  idleCount,
  overloadedCount,
  needsSetupCount,
}: {
  activeCount: number;
  idleCount: number;
  overloadedCount: number;
  needsSetupCount: number;
}) {
  return (
    <ContentCard title="Member Health" subtitle="Fast status tags for accountability and staffing risk.">
      <View style={styles.healthGrid}>
        <HealthBadge label="Active" value={activeCount} tone="good" />
        <HealthBadge label="Idle" value={idleCount} tone="warning" />
        <HealthBadge label="Overloaded" value={overloadedCount} tone="danger" />
        <HealthBadge label="Needs setup" value={needsSetupCount} tone="warning" />
      </View>
    </ContentCard>
  );
}

function HealthBadge({ label, value, tone }: { label: string; value: number; tone: "good" | "warning" | "danger" }) {
  return (
    <View style={[styles.healthBadge, tone === "danger" ? styles.attentionDanger : tone === "warning" ? styles.attentionWarning : styles.attentionGood]}>
      <Text style={styles.healthValue}>{value}</Text>
      <Text style={styles.healthLabel}>{label}</Text>
    </View>
  );
}

function LocationsOverviewPanel({ locations }: { locations: { label: string; count: number }[] }) {
  return (
    <ContentCard title="Locations Overview" subtitle="Staff distribution by saved location." meta={`${locations.length} locations`}>
      {locations.length ? (
        <View style={styles.locationList}>
          {locations.map((location) => (
            <View key={location.label} style={styles.locationRow}>
              <Ionicons name="location-outline" size={17} color={theme.colors.goldDark} />
              <Text style={styles.locationName}>{location.label}</Text>
              <Text style={styles.locationCount}>{location.count} staff</Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState icon="location-outline" title="No locations yet" body="Add member locations to see workforce distribution here." />
      )}
    </ContentCard>
  );
}

function SmartInsightsPanel({ insights }: { insights: string[] }) {
  return (
    <ContentCard title="Smart Insights" subtitle="Automated owner prompts from workforce signals." meta={`${insights.length} insights`}>
      <View style={styles.insightList}>
        {insights.map((insight) => (
          <View key={insight} style={styles.insightRow}>
            <Ionicons name="sparkles-outline" size={16} color={theme.colors.goldDark} />
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        ))}
      </View>
    </ContentCard>
  );
}

function QuickActionsPanel({
  onAddMember,
  onInviteUser,
  onUploadDocument,
  onAssignTraining,
}: {
  onAddMember: () => void;
  onInviteUser: () => void;
  onUploadDocument: () => void;
  onAssignTraining: () => void;
}) {
  const actions = [
    { label: "+ Add Member", icon: "person-add-outline" as const, onPress: onAddMember, primary: true },
    { label: "Invite User", icon: "mail-outline" as const, onPress: onInviteUser },
    { label: "Upload Document", icon: "cloud-upload-outline" as const, onPress: onUploadDocument },
    { label: "Assign Training", icon: "school-outline" as const, onPress: onAssignTraining },
  ];

  return (
    <ContentCard title="Quick Actions" subtitle="Common owner actions without hunting through the page.">
      <View style={styles.quickActionRow}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [styles.quickActionButton, action.primary ? styles.quickActionButtonPrimary : null, pressed ? styles.pressed : null]}
          >
            <Ionicons name={action.icon} size={16} color={action.primary ? "#FFFFFF" : theme.colors.goldDark} />
            <Text style={[styles.quickActionText, action.primary ? styles.quickActionTextPrimary : null]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </ContentCard>
  );
}

function OrganizationOwnerCard({
  owner,
  onOpenOwner,
  onTransferOwnership,
}: {
  owner?: TeamRecord;
  onOpenOwner: (value: TeamRecord) => void;
  onTransferOwnership: () => void;
}) {
  return (
    <ContentCard
      title="Organization Owner"
      subtitle="System authority is pinned above the workforce and kept out of normal member management."
      meta="1 owner"
    >
      {owner ? (
        <View style={styles.ownerCard}>
          <View style={styles.ownerIdentity}>
            <Avatar name={owner.name} uri={owner.profilePhotoUrl} />
            <View style={styles.ownerCopy}>
              <View style={styles.ownerTitleRow}>
                <Text style={styles.ownerName}>{owner.name}</Text>
                <View style={styles.ownerBadge}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.goldDark} />
                  <Text style={styles.ownerBadgeText}>Owner</Text>
                </View>
              </View>
              <Text style={styles.ownerMeta}>{owner.email || "No owner email saved"}</Text>
            </View>
          </View>

          <View style={styles.ownerSignals}>
            <View style={styles.ownerSignal}>
              <Text style={styles.ownerSignalLabel}>Status</Text>
              <Text style={styles.ownerSignalValue}>Always Active</Text>
            </View>
            <View style={styles.ownerSignal}>
              <Text style={styles.ownerSignalLabel}>Permissions</Text>
              <Text style={styles.ownerSignalValue}>Locked full access</Text>
            </View>
            <View style={styles.ownerSignal}>
              <Text style={styles.ownerSignalLabel}>Scope</Text>
              <Text style={styles.ownerSignalValue}>System-level</Text>
            </View>
          </View>

          <View style={styles.ownerActions}>
            <Pressable onPress={() => onOpenOwner(owner)} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null]}>
              <Text style={styles.secondaryButtonText}>Edit Profile</Text>
            </Pressable>
            <Pressable onPress={onTransferOwnership} style={({ pressed }) => [styles.secondaryButton, styles.ownerTransferButton, pressed ? styles.secondaryButtonPressed : null]}>
              <Text style={styles.ownerTransferText}>Transfer Ownership</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.ownerEmpty}>
          <Ionicons name="shield-outline" size={20} color={theme.colors.goldDark} />
          <View style={styles.ownerCopy}>
            <Text style={styles.ownerName}>No owner record found</Text>
            <Text style={styles.ownerMeta}>The authenticated organization owner will appear here once the member profile is synced.</Text>
          </View>
        </View>
      )}
    </ContentCard>
  );
}

function RolesPanel({
  selectedRole,
  roles,
  roleMemberCounts,
  rolePermissions,
  saveStatus,
  onSelectRole,
  onToggle,
  onReset,
  onNewRole,
  onDuplicateRole,
  onRenameRole,
  onDeleteRole,
}: {
  selectedRole: TeamRole;
  roles: TeamRole[];
  roleMemberCounts: Map<string, number>;
  rolePermissions: Record<string, Permission[]>;
  saveStatus: string;
  onSelectRole: (value: TeamRole) => void;
  onToggle: (value: Permission) => void;
  onReset: () => void;
  onNewRole: () => void;
  onDuplicateRole: (value: TeamRole) => void;
  onRenameRole: (role: TeamRole, nextName: string) => void;
  onDeleteRole: (value: TeamRole) => void;
}) {
  const selectedRoleMemberCount = roleMemberCounts.get(selectedRole.role) ?? 0;
  const ownerLocked = selectedRole.role === "owner";
  const [renameValue, setRenameValue] = useState(selectedRole.label);

  useEffect(() => {
    setRenameValue(selectedRole.label);
  }, [selectedRole.id, selectedRole.label]);

  return (
    <ContentCard title="Roles & Access" subtitle="Create role templates, tune permissions, and set the default portal experience." meta={`${roles.length} roles`}>
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
                <Text style={styles.roleOptionFooter}>
                  {role.role === "owner" ? "Locked full system access" : `${role.isSystem ? "System role" : "Custom role"} / ${formatPortal(role.portalType)} / ${roleMemberCounts.get(role.role) ?? 0} members`}
                </Text>
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
            {ownerLocked ? (
              <View style={styles.lockedRoleBadge}>
                <Ionicons name="lock-closed-outline" size={14} color={theme.colors.goldDark} />
                <Text style={styles.lockedRoleBadgeText}>Full System Access</Text>
              </View>
            ) : (
              <View style={styles.roleActionRow}>
                <Pressable onPress={onReset} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null]}>
                  <Text style={styles.secondaryButtonText}>Reset</Text>
                </Pressable>
                <Pressable onPress={() => onDuplicateRole(selectedRole)} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null]}>
                  <Text style={styles.secondaryButtonText}>Duplicate</Text>
                </Pressable>
                {!selectedRole.isSystem ? (
                  <Pressable onPress={() => onDeleteRole(selectedRole)} style={({ pressed }) => [styles.secondaryButton, styles.smallActionDanger, pressed ? styles.secondaryButtonPressed : null]}>
                    <Text style={[styles.secondaryButtonText, styles.smallActionDangerText]}>Delete</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.roleSaveBar}>
            <Text style={styles.roleSaveText}>
              {ownerLocked ? "Owner permissions are read-only and always include full workspace access." : saveStatus || `${selectedRoleMemberCount} active member${selectedRoleMemberCount === 1 ? "" : "s"} use this role.`}
            </Text>
            {!ownerLocked && selectedRoleMemberCount > 0 ? (
              <Text style={styles.roleWarningText}>Permission changes can affect active staff.</Text>
            ) : null}
          </View>

          {!selectedRole.isSystem ? (
            <View style={styles.roleRenameBox}>
              <Text style={styles.permissionGroupTitle}>Rename custom role</Text>
              <View style={styles.roleRenameRow}>
                <TextInput
                  value={renameValue}
                  onChangeText={setRenameValue}
                  placeholder="Role name"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
                <Pressable onPress={() => onRenameRole(selectedRole, renameValue)} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Save Name</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.permissionGrid}>
            {PERMISSION_GROUPS.map((group) => (
              <View key={group.title} style={styles.permissionGroup}>
                <Text style={styles.permissionGroupTitle}>{group.title}</Text>
                {group.items.map((permission) => {
                  const active = (rolePermissions[selectedRole.id] ?? []).includes(permission.key);
                  return (
                    <Pressable
                      key={`${group.title}-${permission.key}`}
                      onPress={() => {
                        if (!ownerLocked) onToggle(permission.key);
                      }}
                      style={({ pressed }) => [styles.permissionRow, ownerLocked ? styles.permissionRowLocked : null, pressed && !ownerLocked ? styles.permissionRowPressed : null]}
                    >
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
              {ownerLocked
                ? "Owner access is locked to the admin portal and cannot be reduced from this workforce page."
                : `Default portal: ${formatPortal(selectedRole.portalType)}. Use member-level overrides when a person needs mobile-only or desktop-only access.`}
            </Text>
          </View>
        </View>
      </View>
    </ContentCard>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniMetric}>
      <Text style={styles.miniMetricValue}>{value}</Text>
      <Text style={styles.miniMetricLabel}>{label}</Text>
    </View>
  );
}

function AddMemberModal({
  visible,
  form,
  formError,
  saving,
  people,
  onChange,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  form: AddMemberForm;
  formError: string;
  saving: boolean;
  people: TeamRecord[];
  onChange: (value: AddMemberForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const managers = people.filter((person) => person.source === "member" && !isOwnerRecord(person) && ["general_manager", "office_admin"].includes(normalizeRole(person.role)));
  const departmentOptions = Array.from(new Set([...DEFAULT_DEPARTMENTS, ...people.map((person) => person.department || "").filter(Boolean)]));
  const locationOptions = Array.from(new Set([...DEFAULT_LOCATIONS, ...people.map((person) => person.workLocation || "").filter(Boolean)]));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, styles.scrollableModalCard]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Add member</Text>
              <Text style={styles.modalSubtitle}>Create a pending team invite with role defaults.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.iconButton}>
              <Ionicons name="close-outline" size={22} color={theme.colors.ink} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator nestedScrollEnabled>
            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

            <LabeledInput label="Name" value={form.name} onChangeText={(value) => onChange({ ...form, name: value })} placeholder="Full name" />
            <LabeledInput label="Email" value={form.email} onChangeText={(value) => onChange({ ...form, email: value })} placeholder="name@company.com" />
            <LabeledInput label="Phone" value={form.phone} onChangeText={(value) => onChange({ ...form, phone: formatPhone(value) })} placeholder="(555) 555-5555" keyboardType="phone-pad" />
            <LabeledInput label="Job Title" value={form.jobTitle} onChangeText={(value) => onChange({ ...form, jobTitle: value })} placeholder="Field Technician" />
            <PhotoUpload value={form.profilePhotoUrl} onChange={(url) => onChange({ ...form, profilePhotoUrl: url })} />

            <Text style={styles.fieldLabel}>Department</Text>
            <View style={styles.modalPillGrid}>
              {departmentOptions.map((department) => (
                <FilterPill key={department} label={department} active={form.department === department} onPress={() => onChange({ ...form, department })} />
              ))}
            </View>
            <LabeledInput label="Custom Department" value={form.department} onChangeText={(value) => onChange({ ...form, department: value })} placeholder="Operations" />

            <Text style={styles.fieldLabel}>Location</Text>
            <View style={styles.modalPillGrid}>
              {locationOptions.map((workLocation) => (
                <FilterPill key={workLocation} label={workLocation} active={form.workLocation === workLocation} onPress={() => onChange({ ...form, workLocation })} />
              ))}
            </View>
            <LabeledInput label="Custom Location" value={form.workLocation} onChangeText={(value) => onChange({ ...form, workLocation: value })} placeholder="Main Office" />

            <Text style={styles.fieldLabel}>Employee Type</Text>
            <View style={styles.modalPillGrid}>
              {EMPLOYEE_TYPES.map((employeeType) => (
                <FilterPill key={employeeType} label={employeeType} active={form.employeeType === employeeType} onPress={() => onChange({ ...form, employeeType })} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Manager</Text>
            <View style={styles.modalPillGrid}>
              <FilterPill label="Unassigned" active={!form.managerMemberId} onPress={() => onChange({ ...form, managerMemberId: "" })} />
              {managers.map((manager) => (
                <FilterPill key={manager.id} label={manager.name} active={form.managerMemberId === manager.id} onPress={() => onChange({ ...form, managerMemberId: manager.id })} />
              ))}
            </View>

            <LabeledInput label="Start Date" value={form.startDate} onChangeText={(value) => onChange({ ...form, startDate: value })} placeholder="YYYY-MM-DD" />

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.modalPillGrid}>
              {ROLE_PRESETS.filter((preset) => preset.role !== "owner").map((preset) => (
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
          </ScrollView>
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
            {SYSTEM_ROLE_TEMPLATES.filter((role) => role.role !== "owner").map((role) => (
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

function TransferOwnershipModal({
  visible,
  owner,
  members,
  selectedMemberId,
  saving,
  onSelect,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  owner?: TeamRecord;
  members: TeamRecord[];
  selectedMemberId: string;
  saving: boolean;
  onSelect: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Transfer ownership</Text>
              <Text style={styles.modalSubtitle}>Choose an active member to receive full system authority. The current owner becomes Manager.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.iconButton}>
              <Ionicons name="close-outline" size={22} color={theme.colors.ink} />
            </Pressable>
          </View>

          <View style={styles.ownerLockNotice}>
            <Ionicons name="warning-outline" size={16} color={theme.colors.goldDark} />
            <Text style={styles.ownerLockText}>
              This changes billing, role management, and workspace control from {owner?.name ?? "the current owner"} to the selected member.
            </Text>
          </View>

          <Text style={styles.fieldLabel}>New Owner</Text>
          <View style={styles.transferList}>
            {members.length ? (
              members.map((member) => (
                <Pressable
                  key={member.id}
                  onPress={() => onSelect(member.id)}
                  style={({ pressed }) => [
                    styles.transferOption,
                    selectedMemberId === member.id ? styles.transferOptionActive : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Avatar name={member.name} uri={member.profilePhotoUrl} />
                  <View style={styles.personCopy}>
                    <Text style={styles.tdStrong}>{member.name}</Text>
                    <Text style={styles.tdMeta}>{[formatRole(member.role), member.email].filter(Boolean).join(" / ")}</Text>
                  </View>
                  {selectedMemberId === member.id ? (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.goldDark} />
                  ) : null}
                </Pressable>
              ))
            ) : (
              <View style={styles.detailListRow}>
                <Text style={styles.listMeta}>Add an active member before transferring ownership.</Text>
              </View>
            )}
          </View>

          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null]}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSubmit}
              disabled={!selectedMemberId || saving}
              style={({ pressed }) => [styles.primaryButton, !selectedMemberId || saving ? styles.disabledButton : null, pressed ? styles.primaryButtonPressed : null]}
            >
              <Text style={styles.primaryButtonText}>{saving ? "Transferring..." : "Confirm Transfer"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ConfirmActionModal({
  action,
  saving,
  onClose,
  onConfirm,
}: {
  action: ConfirmAction | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={!!action} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        {action ? (
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons
                name={action.danger ? "warning-outline" : "mail-unread-outline"}
                size={20}
                color={action.danger ? theme.colors.danger : theme.colors.goldDark}
              />
            </View>
            <View style={styles.confirmCopy}>
              <Text style={styles.modalTitle}>{action.title}</Text>
              <Text style={styles.confirmBody}>{action.body}</Text>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={onClose}
                disabled={saving}
                style={({ pressed }) => [styles.secondaryButton, saving ? styles.disabledButton : null, pressed ? styles.secondaryButtonPressed : null]}
              >
                <Text style={styles.secondaryButtonText}>Keep</Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={saving}
                style={({ pressed }) => [
                  styles.primaryButton,
                  action.danger ? styles.dangerButton : null,
                  saving ? styles.disabledButton : null,
                  pressed ? (action.danger ? styles.dangerButtonPressed : styles.primaryButtonPressed) : null,
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>{action.confirmLabel}</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function MemberDetailModal({
  record,
  assignedJobCountByUser,
  assignedJobs,
  people,
  onTransferOwnership,
  onResendInvite,
  onCancelInvite,
  onRemoveMember,
  onClose,
  onSave,
}: {
  record: TeamRecord | null;
  assignedJobCountByUser: Map<string, number>;
  assignedJobs: WorkOrderLite[];
  people: TeamRecord[];
  onTransferOwnership: () => void;
  onResendInvite: (record: TeamRecord) => void;
  onCancelInvite: (record: TeamRecord) => void;
  onRemoveMember: (record: TeamRecord) => void;
  onClose: () => void;
  onSave: (id: string, updates: { name: string; email: string; phone: string; profilePhotoUrl: string; jobTitle: string; department: string; workLocation: string; employeeType: string; managerMemberId: string; role: UserRole; status: "active" | "inactive" }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editWorkLocation, setEditWorkLocation] = useState("");
  const [editEmployeeType, setEditEmployeeType] = useState("");
  const [editManagerMemberId, setEditManagerMemberId] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("technician");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const activeAssignedCount = record?.userId ? assignedJobCountByUser.get(record.userId) ?? 0 : 0;
  const memberJobs = record?.userId ? assignedJobs.filter((job) => job.assigned_to_user_id === record.userId).slice(0, 6) : [];
  const isOwner = record ? isOwnerRecord(record) : false;
  const managers = people.filter((person) => person.source === "member" && person.id !== record?.id && !isOwnerRecord(person) && ["general_manager", "office_admin"].includes(normalizeRole(person.role)));

  useEffect(() => {
    if (record) {
      setEditing(false);
      setSaveError("");
      setEditName(record.name);
      setEditEmail(record.email || "");
      setEditPhone(record.phone || "");
      setEditPhotoUrl(record.profilePhotoUrl || "");
      setEditJobTitle(record.jobTitle || "");
      setEditDepartment(record.department || "");
      setEditWorkLocation(record.workLocation || "");
      setEditEmployeeType(record.employeeType || "");
      setEditManagerMemberId(record.managerMemberId || "");
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
        profilePhotoUrl: editPhotoUrl,
        jobTitle: editJobTitle,
        department: editDepartment,
        workLocation: editWorkLocation,
        employeeType: editEmployeeType,
        managerMemberId: editManagerMemberId,
        role: isOwner ? "owner" : editRole,
        status: isOwner ? "active" : editStatus,
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
          <View style={[styles.modalCard, styles.scrollableModalCard]}>
            <View style={styles.modalHeader}>
              <View style={styles.profileHeader}>
                <Avatar name={record.name} uri={record.profilePhotoUrl} />
                <View>
                  <Text style={styles.modalTitle}>{editing ? "Edit member" : record.name}</Text>
                  <Text style={styles.modalSubtitle}>
                    {editing ? (isOwner ? "Update owner profile. Permissions stay locked." : "Update profile, role, and status.") : `${formatRole(record.role)} / ${isOwner ? "Always Active" : titleCase(record.status)}`}
                  </Text>
                </View>
              </View>
              <Pressable onPress={onClose} style={styles.iconButton}>
                <Ionicons name="close-outline" size={22} color={theme.colors.ink} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator nestedScrollEnabled>
              {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

              {editing ? (
                <>
                  <PhotoUpload value={editPhotoUrl} onChange={setEditPhotoUrl} />
                  <LabeledInput label="Name" value={editName} onChangeText={setEditName} placeholder="Full name" />
                  <LabeledInput label="Email" value={editEmail} onChangeText={setEditEmail} placeholder="name@company.com" />
                  <LabeledInput label="Phone" value={editPhone} onChangeText={(v) => setEditPhone(formatPhone(v))} placeholder="(555) 555-5555" keyboardType="phone-pad" />
                  <LabeledInput label="Job Title" value={editJobTitle} onChangeText={setEditJobTitle} placeholder="Crew Lead" />
                  <LabeledInput label="Department" value={editDepartment} onChangeText={setEditDepartment} placeholder="Operations" />
                  <LabeledInput label="Location" value={editWorkLocation} onChangeText={setEditWorkLocation} placeholder="Main Office" />

                <Text style={styles.fieldLabel}>Employee Type</Text>
                <View style={styles.modalPillGrid}>
                  {EMPLOYEE_TYPES.map((type) => (
                    <FilterPill key={type} label={type} active={editEmployeeType === type} onPress={() => setEditEmployeeType(type)} />
                  ))}
                </View>

                {!isOwner ? (
                  <>
                    <Text style={styles.fieldLabel}>Manager</Text>
                    <View style={styles.modalPillGrid}>
                      <FilterPill label="Unassigned" active={!editManagerMemberId} onPress={() => setEditManagerMemberId("")} />
                      {managers.map((manager) => (
                        <FilterPill key={manager.id} label={manager.name} active={editManagerMemberId === manager.id} onPress={() => setEditManagerMemberId(manager.id)} />
                      ))}
                    </View>

                    <Text style={styles.fieldLabel}>Role</Text>
                    <View style={styles.modalPillGrid}>
                      {ROLE_PRESETS.filter((preset) => preset.role !== "owner").map((preset) => (
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
                  </>
                ) : (
                  <View style={styles.ownerLockNotice}>
                    <Ionicons name="lock-closed-outline" size={16} color={theme.colors.goldDark} />
                    <Text style={styles.ownerLockText}>Owner role, active status, and full permissions are locked. Transfer ownership to move system authority to another member.</Text>
                  </View>
                )}

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
                <Text style={styles.fieldLabel}>Quick Actions</Text>
                {isOwner ? (
                  <View style={styles.quickActionGrid}>
                    <Pressable onPress={() => setEditing(true)} style={styles.smallAction}>
                      <Text style={styles.smallActionText}>Edit profile</Text>
                    </Pressable>
                    <Pressable onPress={onTransferOwnership} style={[styles.smallAction, styles.ownerTransferButton]}>
                      <Text style={styles.ownerTransferText}>Transfer ownership</Text>
                    </Pressable>
                    <View style={styles.ownerLockNotice}>
                      <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.goldDark} />
                      <Text style={styles.ownerLockText}>Owner cannot be deactivated, removed, or changed from this member flow.</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.quickActionGrid}>
                    {record.source === "invite" ? (
                      <>
                        <Pressable onPress={() => onResendInvite(record)} style={styles.smallAction}>
                          <Text style={styles.smallActionText}>Resend invite</Text>
                        </Pressable>
                        <Pressable onPress={() => onCancelInvite(record)} style={[styles.smallAction, styles.smallActionDanger]}>
                          <Text style={[styles.smallActionText, styles.smallActionDangerText]}>Cancel invite</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Pressable
                          onPress={() => {
                            setEditStatus("inactive");
                            setEditing(true);
                          }}
                          style={[styles.smallAction, styles.smallActionDanger]}
                        >
                          <Text style={[styles.smallActionText, styles.smallActionDangerText]}>Deactivate</Text>
                        </Pressable>
                        <Pressable onPress={() => onRemoveMember(record)} style={[styles.smallAction, styles.smallActionDanger]}>
                          <Text style={[styles.smallActionText, styles.smallActionDangerText]}>Remove member</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}

                <Text style={styles.fieldLabel}>Profile</Text>
                <View style={styles.detailGrid}>
                  <DetailRow label="Email" value={record.email || "-"} />
                  <DetailRow label="Phone" value={record.phone || "-"} />
                  <DetailRow label="Employee type" value={record.employeeType || "-"} />
                </View>

                <Text style={styles.fieldLabel}>Job</Text>
                <View style={styles.detailGrid}>
                  <DetailRow label="Portal" value={isOwner ? "Admin" : formatPortal(record.portalType)} />
                  <DetailRow label="Location" value={record.workLocation || record.department || "-"} />
                  <DetailRow label="Manager" value={isOwner ? "System authority" : getManagerName(record, people)} />
                  <DetailRow label="Job" value={[record.department, record.jobTitle].filter(Boolean).join(" / ") || "-"} />
                </View>

                {isOwner ? (
                  <>
                    <Text style={styles.fieldLabel}>Owner Controls</Text>
                    <View style={styles.detailGrid}>
                      <DetailRow label="Authority" value="Full system access" />
                      <DetailRow label="Ownership transfer" value="Advanced action only" />
                      <DetailRow label="Last active" value={formatRelative(record.lastActiveAt)} />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>Workload</Text>
                    <View style={styles.detailGrid}>
                      <DetailRow label="Assigned work orders" value={String(activeAssignedCount)} />
                      <DetailRow label="Capacity" value={`${getWorkloadStatus(activeAssignedCount)} / ${getCapacityLabel(activeAssignedCount)}`} />
                      <DetailRow label="Last active" value={formatRelative(record.lastActiveAt)} />
                    </View>

                    <Text style={styles.fieldLabel}>Assigned Work Orders</Text>
                    {memberJobs.length ? (
                      <View style={styles.detailList}>
                        {memberJobs.map((job) => (
                          <View key={job.id} style={styles.detailListRow}>
                            <View>
                              <Text style={styles.listTitle}>{job.title || "Work order"}</Text>
                              <Text style={styles.listMeta}>{statusLabel(job.status)} / Updated {formatRelative(job.updated_at)}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.detailListRow}>
                        <Text style={styles.listMeta}>No active assigned work orders.</Text>
                      </View>
                    )}
                  </>
                )}

                <Text style={styles.fieldLabel}>Access</Text>
                <View style={styles.detailGrid}>
                  <DetailRow label="Mobile portal" value={isOwner ? "Locked enabled" : record.mobileAccessEnabled === false ? "Disabled" : "Enabled"} />
                  <DetailRow label="Desktop portal" value={isOwner ? "Locked enabled" : record.desktopAccessEnabled === false ? "Disabled" : "Enabled"} />
                </View>
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
                    <Text style={styles.primaryButtonText}>{isOwner ? "Edit Profile" : "Edit Member"}</Text>
                  </Pressable>
                </View>
                </>
              )}
            </ScrollView>
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
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "email-address" | "numeric";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.colors.muted} style={styles.input} keyboardType={keyboardType ?? "default"} />
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
  const [orgId, setOrgId] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [activeSection, setActiveSection] = useState<WorkforceSection>("overview");
  const [query, setQuery] = useState("");
  const [savedView, setSavedView] = useState<TeamSavedView>("all");
  const [viewMode, setViewMode] = useState<TeamViewMode>("list");
  const [locationFilter, setLocationFilter] = useState("All Locations");
  const [statusFilter, setStatusFilter] = useState<MemberStatus>("All");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("All");
  const [memberFocusFilter, setMemberFocusFilter] = useState<MemberFocusFilter>("none");
  const [sortKey, setSortKey] = useState<DirectorySort>("Newest");
  const [showAddMember, setShowAddMember] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetMemberId, setTransferTargetMemberId] = useState("");
  const [transferringOwnership, setTransferringOwnership] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [savingInvite, setSavingInvite] = useState(false);
  const [formError, setFormError] = useState("");
  const [addMemberForm, setAddMemberForm] = useState<AddMemberForm>(emptyAddMemberForm);
  const [newRoleForm, setNewRoleForm] = useState<NewRoleForm>(emptyNewRoleForm);
  const [selectedRecord, setSelectedRecord] = useState<TeamRecord | null>(null);
  const [roleTemplates, setRoleTemplates] = useState<TeamRole[]>(SYSTEM_ROLE_TEMPLATES);
  const [selectedRole, setSelectedRole] = useState<TeamRole>(SYSTEM_ROLE_TEMPLATES[0]);
  const [roleSaveStatus, setRoleSaveStatus] = useState("");
  const [rolePermissions, setRolePermissions] = useState<Record<string, Permission[]>>(() =>
    SYSTEM_ROLE_TEMPLATES.reduce(
      (acc, role) => ({ ...acc, [role.id]: [...role.permissions] }),
      {} as Record<string, Permission[]>
    )
  );
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
      department: invite.department,
      employeeType: invite.employee_type,
      managerMemberId: invite.manager_member_id,
      workLocation: invite.work_location,
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

  const ownerRecord = useMemo(() => {
    return people.find((person) => person.source === "member" && isOwnerRecord(person)) ?? people.find(isOwnerRecord);
  }, [people]);

  const workforcePeople = useMemo(() => {
    return people.filter((person) => !isOwnerRecord(person));
  }, [people]);

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

  const assignedJobsByUser = useMemo(() => {
    const jobs = new Map<string, WorkOrderLite[]>();
    workOrders.forEach((item) => {
      if (!item.assigned_to_user_id) return;
      jobs.set(item.assigned_to_user_id, [...(jobs.get(item.assigned_to_user_id) ?? []), item]);
    });
    return jobs;
  }, [workOrders]);

  const roleMemberCounts = useMemo(() => {
    const counts = new Map<string, number>();
    people.forEach((person) => {
      counts.set(normalizeRole(person.role), (counts.get(normalizeRole(person.role)) ?? 0) + 1);
    });
    return counts;
  }, [people]);

  const locationFilters = useMemo(() => {
    const values = workforcePeople
      .map((person) => person.workLocation || person.department || "")
      .filter(Boolean);
    return ["All Locations", ...Array.from(new Set(values)).sort()];
  }, [workforcePeople]);

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return workforcePeople.filter((person) => {
      const normalizedRole = normalizeRole(person.role);
      const assigned = !!person.userId && assignedUserIds.has(person.userId);
      const needsSetup = person.source === "member" && (!person.portalType || !person.jobTitle || !person.workLocation);

      if (memberFocusFilter === "idle" && !(person.source === "member" && person.status === "active" && isOlderThanDays(person.lastActiveAt, 3))) return false;
      if (savedView === "technicians" && normalizedRole !== "technician") return false;
      if (
        savedView === "office" &&
        !["office_admin", "accounting_manager", "general_manager"].includes(normalizedRole) &&
        !["Office", "Dispatch", "Finance"].includes(person.department || "")
      ) return false;
      if (savedView === "pending" && person.status !== "pending") return false;
      if (savedView === "unassigned" && assigned) return false;
      if (savedView === "needs_setup" && !needsSetup) return false;

      if (locationFilter !== "All Locations" && (person.workLocation || person.department || "") !== locationFilter) return false;
      if (statusFilter !== "All" && person.status !== statusFilter) return false;

      if (assignmentFilter !== "All") {
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
  }, [assignmentFilter, assignedUserIds, locationFilter, memberFocusFilter, workforcePeople, query, savedView, sortKey, statusFilter]);

  const activeToday = workforcePeople.filter((person) => person.status === "active").length;
  const pendingInviteCount = invites.filter((invite) => invite.status === "pending").length;
  const assignedStaffCount = workforcePeople.filter((person) => person.source === "member" && !!person.userId && !!assignedJobCountByUser.get(person.userId)).length;
  const peopleNeedingReview = workforcePeople.filter((person) => person.source === "member" && (!person.portalType || !person.jobTitle || !person.workLocation)).length;

  const savedViewCounts = useMemo<Record<TeamSavedView, number>>(() => {
    return {
      all: workforcePeople.length,
      technicians: workforcePeople.filter((person) => normalizeRole(person.role) === "technician").length,
      office: workforcePeople.filter((person) => {
        const normalizedRole = normalizeRole(person.role);
        return ["office_admin", "accounting_manager", "general_manager"].includes(normalizedRole) || ["Office", "Dispatch", "Finance"].includes(person.department || "");
      }).length,
      pending: workforcePeople.filter((person) => person.status === "pending").length,
      unassigned: workforcePeople.filter((person) => !person.userId || !assignedUserIds.has(person.userId)).length,
      needs_setup: peopleNeedingReview,
    };
  }, [assignedUserIds, peopleNeedingReview, workforcePeople]);

  const unassignedMembers = useMemo(() => {
    return workforcePeople.filter((person) => person.source === "member" && (!person.userId || !assignedUserIds.has(person.userId)));
  }, [assignedUserIds, workforcePeople]);

  const idleMembers = useMemo(() => {
    return workforcePeople.filter((person) => person.source === "member" && person.status === "active" && isOlderThanDays(person.lastActiveAt, 3));
  }, [workforcePeople]);

  const pendingInvitePeople = useMemo(() => {
    return workforcePeople.filter((person) => person.source === "invite" && person.status === "pending");
  }, [workforcePeople]);

  const missingProfilePeople = useMemo(() => {
    return workforcePeople.filter((person) => person.source === "member" && (!person.portalType || !person.jobTitle || !person.workLocation));
  }, [workforcePeople]);

  const overdueAssignedWorkOrders = useMemo(() => {
    return workOrders.filter((item) => !!item.assigned_to_user_id && isWorkOrderPastDue(item));
  }, [workOrders]);

  const technicianPerformance = useMemo(() => {
    const technicians = workforcePeople.filter((person) => person.source === "member" && normalizeRole(person.role) === "technician");
    const rows = technicians.map((person) => ({
      name: person.name,
      count: person.userId ? assignedJobCountByUser.get(person.userId) ?? 0 : 0,
    }));
    const totalJobs = rows.reduce((sum, item) => sum + item.count, 0);
    const sorted = [...rows].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
      avgJobsPerTech: rows.length ? (totalJobs / rows.length).toFixed(1) : "0.0",
      rows: sorted,
      mostActiveTechnician: sorted[0],
      leastActiveTechnician: sorted.length ? sorted[sorted.length - 1] : undefined,
      overloadedCount: rows.filter((item) => item.count >= 6).length,
      totalAssignedTechJobs: totalJobs,
    };
  }, [assignedJobCountByUser, workforcePeople]);

  const completedThisWeek = useMemo(() => {
    const startOfWeek = getStartOfWeek();
    return workOrders.filter((item) => {
      const status = String(item.status ?? "").toLowerCase();
      if (!["closed", "completed"].includes(status)) return false;
      const updated = new Date(item.updated_at ?? "");
      return !Number.isNaN(updated.getTime()) && updated >= startOfWeek;
    }).length;
  }, [workOrders]);

  const locationsOverview = useMemo(() => {
    const counts = new Map<string, number>();
    workforcePeople
      .filter((person) => person.source === "member")
      .forEach((person) => {
        const location = getMemberLocation(person);
        if (location === "Unassigned") return;
        counts.set(location, (counts.get(location) ?? 0) + 1);
      });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [workforcePeople]);

  const smartInsights = useMemo(() => {
    const insights: string[] = [];
    if (unassignedMembers.length) insights.push(`You have ${unassignedMembers.length} unassigned technician${unassignedMembers.length === 1 ? "" : "s"}.`);
    if (pendingInvitePeople.length) insights.push(`${pendingInvitePeople.length} invite${pendingInvitePeople.length === 1 ? " is" : "s are"} still waiting for acceptance.`);
    if (missingProfilePeople.length) insights.push(`${missingProfilePeople.length} member${missingProfilePeople.length === 1 ? "" : "s"} need profile or location setup.`);
    if (idleMembers.length) insights.push(`${idleMembers.length} active member${idleMembers.length === 1 ? " has" : "s have"} no recorded activity in 3+ days.`);
    if (overdueAssignedWorkOrders.length) insights.push(`${overdueAssignedWorkOrders.length} assigned work order${overdueAssignedWorkOrders.length === 1 ? " is" : "s are"} overdue.`);

    const top = technicianPerformance.mostActiveTechnician;
    if (top && technicianPerformance.totalAssignedTechJobs > 0 && top.count / technicianPerformance.totalAssignedTechJobs >= 0.7) {
      insights.push(`${top.name} is handling ${Math.round((top.count / technicianPerformance.totalAssignedTechJobs) * 100)}% of technician workload.`);
    }

    return insights.length ? insights : ["No major workforce risks detected from current member and work order data."];
  }, [idleMembers, missingProfilePeople, overdueAssignedWorkOrders, pendingInvitePeople, technicianPerformance, unassignedMembers]);

  function resetMemberFilters() {
    setSavedView("all");
    setStatusFilter("All");
    setAssignmentFilter("All");
    setLocationFilter("All Locations");
    setMemberFocusFilter("none");
    setQuery("");
  }

  function openMembersWithFilter(filter: "all" | "active" | "pending" | "assigned" | "unassigned" | "needs_setup" | "idle") {
    resetMemberFilters();
    setActiveSection("members");

    if (filter === "active") setStatusFilter("active");
    if (filter === "pending") {
      setSavedView("pending");
      setStatusFilter("pending");
    }
    if (filter === "assigned") setAssignmentFilter("Assigned");
    if (filter === "unassigned") {
      setSavedView("unassigned");
      setAssignmentFilter("Unassigned");
    }
    if (filter === "needs_setup") setSavedView("needs_setup");
    if (filter === "idle") setMemberFocusFilter("idle");
  }

  function handleAttentionDrilldown(key: "unassigned" | "idle" | "pending" | "setup" | "overdue") {
    if (key === "unassigned") openMembersWithFilter("unassigned");
    if (key === "idle") openMembersWithFilter("idle");
    if (key === "pending") openMembersWithFilter("pending");
    if (key === "setup") openMembersWithFilter("needs_setup");
    if (key === "overdue") {
      setActiveSection("performance");
      setPageMessage("Overdue work orders stay managed from Work Orders; this view highlights the staffing signal.");
    }
  }

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
        .select("id, email, role, status, display_name, phone, job_title, department, employee_type, manager_member_id, work_location, start_date, profile_photo_url, portal_type, mobile_access_enabled, desktop_access_enabled, permissions, created_at")
        .eq("org_id", activeOrgId)
        .order("created_at", { ascending: false });

      let nextInvites: TeamInvite[] = [];
      if (invitesRes.error) {
        const fallbackInvites = await supabase
          .from("org_invites")
          .select("id, email, role, status, display_name, phone, job_title, profile_photo_url, portal_type, mobile_access_enabled, desktop_access_enabled, permissions, created_at")
          .eq("org_id", activeOrgId)
          .order("created_at", { ascending: false });
        nextInvites = fallbackInvites.error ? [] : ((fallbackInvites.data ?? []) as TeamInvite[]);
      } else {
        nextInvites = (invitesRes.data ?? []) as TeamInvite[];
      }

      const workOrdersRes = await supabase
        .from("work_orders")
        .select("id, title, status, assigned_to_user_id, updated_at, due_date")
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
      setInvites(nextInvites.filter((invite) => !["accepted", "cancelled"].includes(invite.status)).map((invite) => ({
        ...invite,
        role: normalizeRole(invite.role),
        permissions: normalizePermissions(invite.permissions, invite.role),
      })));
      setWorkOrders((workOrdersRes.data ?? []) as WorkOrderLite[]);
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
      const appUrl = typeof window !== "undefined" ? window.location.origin : undefined;

      if (addMemberForm.status === "active") {
        // Create the employee profile in org_members immediately (user_id null until they sign up)
        const { error: memberError } = await supabase.from("org_members").insert({
          org_id: activeOrgId,
          email,
          role: addMemberForm.role,
          status: "active",
          display_name: addMemberForm.name.trim(),
          phone: addMemberForm.phone.trim() || null,
          job_title: addMemberForm.jobTitle.trim() || null,
          department: addMemberForm.department.trim() || null,
          employee_type: addMemberForm.employeeType || null,
          manager_member_id: addMemberForm.managerMemberId || null,
          work_location: addMemberForm.workLocation.trim() || null,
          start_date: addMemberForm.startDate.trim() || null,
          profile_photo_url: addMemberForm.profilePhotoUrl.trim() || null,
          portal_type: addMemberForm.portalType,
          mobile_access_enabled: addMemberForm.mobileAccessEnabled,
          desktop_access_enabled: addMemberForm.desktopAccessEnabled,
          permissions: ROLE_PERMISSIONS[addMemberForm.role],
          is_field_user: addMemberForm.portalType === "team",
        });
        if (memberError) throw new Error(memberError.message);

        // Create a pending invite so they can sign up and get linked to this profile
        const inviteRes = await supabase
          .from("org_invites")
          .insert({
            org_id: activeOrgId,
            email,
            role: addMemberForm.role,
            status: "pending",
            invited_by_user_id: userId,
            display_name: addMemberForm.name.trim(),
          })
          .select("id")
          .single();
        if (!inviteRes.error && inviteRes.data?.id) {
          await supabase.functions.invoke("send-invite", {
            body: { email, invite_id: inviteRes.data.id, app_url: appUrl },
          });
        }

        setShowAddMember(false);
        setAddMemberForm(emptyAddMemberForm);
        setPageMessage(`Profile created for ${email}.`);
      } else {
        // Pending invite — insert into org_invites and send email
        const basePayload = {
          org_id: activeOrgId,
          email,
          role: addMemberForm.role,
          status: "pending" as const,
          invited_by_user_id: userId,
        };
        let insertRes = await supabase
          .from("org_invites")
          .insert({
            ...basePayload,
            display_name: addMemberForm.name.trim(),
            phone: addMemberForm.phone.trim() || null,
            job_title: addMemberForm.jobTitle.trim() || null,
            department: addMemberForm.department.trim() || null,
            employee_type: addMemberForm.employeeType || null,
            manager_member_id: addMemberForm.managerMemberId || null,
            work_location: addMemberForm.workLocation.trim() || null,
            start_date: addMemberForm.startDate.trim() || null,
            profile_photo_url: addMemberForm.profilePhotoUrl.trim() || null,
            portal_type: addMemberForm.portalType,
            mobile_access_enabled: addMemberForm.mobileAccessEnabled,
            desktop_access_enabled: addMemberForm.desktopAccessEnabled,
            permissions: ROLE_PERMISSIONS[addMemberForm.role],
          })
          .select("id, email, role, status, display_name, phone, job_title, department, employee_type, manager_member_id, work_location, start_date, profile_photo_url, portal_type, mobile_access_enabled, desktop_access_enabled, permissions, created_at")
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
          await supabase.functions.invoke("send-invite", {
            body: { email, invite_id: inviteId, app_url: appUrl },
          });
        }

        setShowAddMember(false);
        setAddMemberForm(emptyAddMemberForm);
        setPageMessage(`Invite sent to ${email}.`);
      }

      await loadTeamHub();
    } catch (error: any) {
      setFormError(error?.message ?? "Failed to add member invite.");
    } finally {
      setSavingInvite(false);
    }
  }

  function toggleRolePermission(permission: Permission) {
    if (selectedRole.role === "owner") {
      setRoleSaveStatus("Owner permissions are locked.");
      return;
    }

    const current = rolePermissions[selectedRole.id] ?? [];
    const next = current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission];
    setRolePermissions((prev) => ({ ...prev, [selectedRole.id]: next }));

    // Persist to DB for custom roles
    if (!selectedRole.isSystem) {
      setRoleSaveStatus("Saving role permissions...");
      void supabase
        .from("organization_roles")
        .update({ permissions: next, updated_at: new Date().toISOString() })
        .eq("id", selectedRole.id)
        .then(({ error }) => setRoleSaveStatus(error ? "Could not save role permissions." : "Role permissions saved."));
    } else {
      setRoleSaveStatus("System role preview updated for this session.");
    }
  }

  async function duplicateRole(role: TeamRole) {
    setNewRoleForm({
      name: `${role.label} Copy`,
      baseRole: role.role,
      color: role.color,
    });
    setShowRoleModal(true);
    setPageMessage(`Duplicate ${role.label} from the role modal.`);
  }

  async function deleteCustomRole(role: TeamRole) {
    if (role.isSystem) return;
    const usedCount = roleMemberCounts.get(role.role) ?? 0;
    if (usedCount > 0) {
      setPageError(`Cannot delete ${role.label} while ${usedCount} member${usedCount === 1 ? "" : "s"} use it.`);
      return;
    }

    const { error } = await supabase.from("organization_roles").delete().eq("id", role.id);
    if (error) {
      setPageError(error.message);
      return;
    }
    setRoleTemplates((prev) => prev.filter((item) => item.id !== role.id));
    setRolePermissions((prev) => {
      const next = { ...prev };
      delete next[role.id];
      return next;
    });
    setSelectedRole(SYSTEM_ROLE_TEMPLATES[0]);
    setPageMessage(`${role.label} deleted.`);
  }

  async function renameCustomRole(role: TeamRole, nextName: string) {
    const name = nextName.trim();
    if (!name || role.isSystem) return;

    const { error } = await supabase
      .from("organization_roles")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", role.id);

    if (error) {
      setRoleSaveStatus("Could not rename role.");
      setPageError(error.message);
      return;
    }

    const nextRole = { ...role, label: name };
    setRoleTemplates((prev) => prev.map((item) => (item.id === role.id ? nextRole : item)));
    setSelectedRole(nextRole);
    setRoleSaveStatus("Role name saved.");
  }

  async function createCustomRole() {
    const name = newRoleForm.name.trim();
    if (!name) return;

    const base = SYSTEM_ROLE_TEMPLATES.find((role) => role.role === newRoleForm.baseRole && role.role !== "owner") ?? SYSTEM_ROLE_TEMPLATES.find((role) => role.role === "technician") ?? SYSTEM_ROLE_TEMPLATES[0];
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

  async function runConfirmedAction() {
    if (!confirmAction || confirmSaving) return;
    setConfirmSaving(true);
    setPageError("");
    setPageMessage("");

    try {
      await confirmAction.onConfirm();
      setConfirmAction(null);
    } catch (err: any) {
      setPageError(err?.message ?? "Action failed.");
    } finally {
      setConfirmSaving(false);
    }
  }

  function requestResendInvite(record: TeamRecord) {
    const recipient = record.email || record.name;
    setConfirmAction({
      title: "Resend invite?",
      body: `Send a fresh invite email to ${recipient}.`,
      confirmLabel: "Resend Invite",
      onConfirm: async () => {
        const appUrl = typeof window !== "undefined" ? window.location.origin : undefined;
        const { error } = await supabase.functions.invoke("send-invite", {
          body: { email: record.email, invite_id: record.id, app_url: appUrl },
        });
        if (error) throw new Error(error.message ?? "Failed to send invite email.");
        setSelectedRecord(null);
        setPageMessage(`Invite resent to ${recipient}.`);
      },
    });
  }

  function requestCancelInvite(record: TeamRecord) {
    const recipient = record.email || record.name;
    setConfirmAction({
      title: "Cancel invite?",
      body: `This will cancel the pending invite for ${recipient}. They will not be able to accept the existing invitation.`,
      confirmLabel: "Cancel Invite",
      danger: true,
      onConfirm: async () => {
        await cancelInvite(record.id, recipient);
        if (selectedRecord?.id === record.id) setSelectedRecord(null);
      },
    });
  }

  function requestRemoveMember(record: TeamRecord) {
    setConfirmAction({
      title: "Remove member?",
      body: `Remove ${record.name} from this organization. This does not delete historical work orders or invoices.`,
      confirmLabel: "Remove Member",
      danger: true,
      onConfirm: async () => {
        await removeMember(record);
      },
    });
  }

  async function cancelInvite(inviteId: string, inviteName = "invite") {
    try {
      const { error } = await supabase
        .from("org_invites")
        .update({ status: "cancelled" })
        .eq("id", inviteId);
      if (error) throw new Error(error.message);
      setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      setPageMessage(`Invite cancelled for ${inviteName}.`);
      await loadTeamHub();
    } catch (err: any) {
      setPageError(err?.message ?? "Failed to cancel invite.");
    }
  }

  async function removeMember(record: TeamRecord) {
    if (isOwnerRecord(record)) {
      setPageError("Owner cannot be removed from the member flow.");
      return;
    }

    try {
      const { error } = await supabase.from("org_members").delete().eq("id", record.id);
      if (error) throw new Error(error.message);
      setSelectedRecord(null);
      setPageMessage(`${record.name} removed from the organization.`);
      await loadTeamHub();
    } catch (err: any) {
      setPageError(err?.message ?? "Failed to remove member.");
    }
  }

  async function saveMember(id: string, updates: { name: string; email: string; phone: string; profilePhotoUrl: string; jobTitle: string; department: string; workLocation: string; employeeType: string; managerMemberId: string; role: UserRole; status: "active" | "inactive" }) {
    const { error } = await supabase
      .from("org_members")
      .update({
        display_name: updates.name || null,
        email: updates.email || null,
        phone: updates.phone || null,
        profile_photo_url: updates.profilePhotoUrl || null,
        job_title: updates.jobTitle || null,
        department: updates.department || null,
        work_location: updates.workLocation || null,
        employee_type: updates.employeeType || null,
        manager_member_id: updates.managerMemberId || null,
        role: updates.role,
        status: updates.status,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    setPageMessage("Member updated.");
    setSelectedRecord(null);
    await loadTeamHub();
  }

  function openTransferOwnership() {
    setTransferTargetMemberId("");
    setSelectedRecord(null);
    setShowTransferModal(true);
  }

  async function transferOwnership() {
    if (!ownerRecord || !transferTargetMemberId || transferringOwnership) return;
    setTransferringOwnership(true);
    setPageError("");

    try {
      const newOwner = workforcePeople.find((person) => person.id === transferTargetMemberId);
      if (!newOwner) throw new Error("Choose an active member before transferring ownership.");

      const demoteCurrentOwner = await supabase
        .from("org_members")
        .update({
          role: "general_manager",
          status: "active",
          portal_type: "admin",
          mobile_access_enabled: true,
          desktop_access_enabled: true,
          permissions: ROLE_PERMISSIONS.general_manager,
        })
        .eq("id", ownerRecord.id);
      if (demoteCurrentOwner.error) throw new Error(demoteCurrentOwner.error.message);

      const promoteNewOwner = await supabase
        .from("org_members")
        .update({
          role: "owner",
          status: "active",
          manager_member_id: null,
          portal_type: "admin",
          mobile_access_enabled: true,
          desktop_access_enabled: true,
          permissions: ROLE_PERMISSIONS.owner,
        })
        .eq("id", newOwner.id);
      if (promoteNewOwner.error) throw new Error(promoteNewOwner.error.message);

      setShowTransferModal(false);
      setSelectedRecord(null);
      setPageMessage(`Ownership transferred to ${newOwner.name}.`);
      await loadTeamHub();
    } catch (err: any) {
      setPageError(err?.message ?? "Failed to transfer ownership.");
    } finally {
      setTransferringOwnership(false);
    }
  }

  return (
    <Screen padded={false}>
      <AppPage>
        <PageHeader
          eyebrow="Operations"
          title="Workforce Overview"
          subtitle="Owner dashboard for team status, onboarding, performance, resources, and access control."
          actions={[
            { label: "Refresh", onPress: loadTeamHub },
            { label: "+ Add Member", onPress: () => setShowAddMember(true), primary: true },
          ]}
        />

        <WorkforceNav activeSection={activeSection} onSectionChange={setActiveSection} />

        {pageError ? <Text style={styles.errorText}>{pageError}</Text> : null}
        {pageMessage ? <Text style={styles.successText}>{pageMessage}</Text> : null}

        <DeepViewHeader section={activeSection} onBack={() => setActiveSection("overview")} />

        {activeSection === "overview" ? (
          <>
            <SummaryStrip>
              <SummaryCard label="Active Members" value={String(activeToday)} meta="Available team members" accent="teal" onPress={() => openMembersWithFilter("active")} />
              <SummaryCard label="Pending Invites" value={String(pendingInviteCount)} meta="Waiting for acceptance" accent="lavender" onPress={() => openMembersWithFilter("pending")} />
              <SummaryCard label="Assigned Staff" value={String(assignedStaffCount)} meta="Currently carrying work" accent="indigo" onPress={() => openMembersWithFilter("assigned")} />
              <SummaryCard label="Needs Setup" value={String(peopleNeedingReview)} meta="Missing profile/workforce data" accent="purple" onPress={() => openMembersWithFilter("needs_setup")} />
            </SummaryStrip>

            <AttentionPanel
              unassignedPeople={unassignedMembers}
              idlePeople={idleMembers}
              pendingInvites={pendingInvitePeople}
              missingProfilePeople={missingProfilePeople}
              overdueWorkOrders={overdueAssignedWorkOrders}
              onAddMember={() => setShowAddMember(true)}
              onDrilldown={handleAttentionDrilldown}
            />

            <QuickActionsPanel
              onAddMember={() => setShowAddMember(true)}
              onInviteUser={() => setShowAddMember(true)}
              onUploadDocument={() => setActiveSection("resources")}
              onAssignTraining={() => setActiveSection("resources")}
            />
          </>
        ) : null}

        {activeSection === "members" ? (
          <>
            <TeamControls
              savedView={savedView}
              savedViewCounts={savedViewCounts}
              query={query}
              viewMode={viewMode}
              statusFilter={statusFilter}
              assignmentFilter={assignmentFilter}
              locationFilter={locationFilter}
              locationFilters={locationFilters}
              sortKey={sortKey}
              onSavedView={(value) => {
                setMemberFocusFilter("none");
                setSavedView(value);
              }}
              onQueryChange={setQuery}
              onViewMode={setViewMode}
              onStatusFilter={(value) => {
                setMemberFocusFilter("none");
                setStatusFilter(value);
              }}
              onAssignmentFilter={(value) => {
                setMemberFocusFilter("none");
                setAssignmentFilter(value);
              }}
              onLocationFilter={(value) => {
                setMemberFocusFilter("none");
                setLocationFilter(value);
              }}
              onSort={setSortKey}
              onAddMember={() => setShowAddMember(true)}
            />

            <MembersTable
              loading={loading}
              people={filteredPeople}
              viewMode={viewMode}
              assignedJobCountByUser={assignedJobCountByUser}
              onAddMember={() => setShowAddMember(true)}
              onOpenMember={setSelectedRecord}
              onCancelInvite={requestCancelInvite}
            />
          </>
        ) : null}

        {activeSection === "resources" ? (
          <TeamResourcesPanel
            onUpload={() => setPageMessage("Resource upload, preview, and role assignment panels are ready to connect when storage is enabled.")}
          />
        ) : null}

        {activeSection === "performance" ? (
          <WorkforcePerformancePanel
            avgJobsPerTech={technicianPerformance.avgJobsPerTech}
            completedThisWeek={completedThisWeek}
            mostActiveTechnician={technicianPerformance.mostActiveTechnician}
            leastActiveTechnician={technicianPerformance.leastActiveTechnician}
            technicianRows={technicianPerformance.rows}
          />
        ) : null}

        <AddMemberModal
          visible={showAddMember}
          form={addMemberForm}
          formError={formError}
          saving={savingInvite}
          people={workforcePeople}
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
          assignedJobs={selectedRecord?.userId ? assignedJobsByUser.get(selectedRecord.userId) ?? [] : []}
          people={workforcePeople}
          onTransferOwnership={openTransferOwnership}
          onResendInvite={requestResendInvite}
          onCancelInvite={requestCancelInvite}
          onRemoveMember={requestRemoveMember}
          onClose={() => setSelectedRecord(null)}
          onSave={saveMember}
        />

        <TransferOwnershipModal
          visible={showTransferModal}
          owner={ownerRecord}
          members={workforcePeople.filter((person) => person.source === "member" && person.status === "active")}
          selectedMemberId={transferTargetMemberId}
          saving={transferringOwnership}
          onSelect={setTransferTargetMemberId}
          onClose={() => setShowTransferModal(false)}
          onSubmit={() => void transferOwnership()}
        />

        <ConfirmActionModal
          action={confirmAction}
          saving={confirmSaving}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => void runConfirmedAction()}
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
  activityGroup: {
    gap: 8,
  },
  activityGroupTitle: {
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
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
  stickyNavWrap: {
    ...Platform.select({
      web: {
        position: "sticky" as any,
        top: 0,
        zIndex: 20,
      },
      default: {
        position: "relative",
      },
    }),
    marginTop: -4,
    marginBottom: -2,
    paddingVertical: 8,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226, 232, 240, 0.72)",
  },
  sectionNav: {
    gap: 10,
  },
  sectionNavPill: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  sectionNavPillActive: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
  sectionNavText: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  sectionNavTextActive: {
    color: "#FFFFFF",
  },
  deepHeader: {
    minHeight: 58,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  deepTitle: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  deepSubtitle: {
    marginTop: 3,
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  primaryViewsBlock: {
    gap: 8,
  },
  primaryViewsRow: {
    gap: 10,
    paddingBottom: 2,
  },
  primaryViewPill: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  primaryViewPillActive: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
  primaryViewText: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  primaryViewTextActive: {
    color: "#FFFFFF",
  },
  searchControlRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
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
  filterGroups: {
    gap: 12,
  },
  filterGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  filterGroupLabel: {
    minWidth: 84,
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  filterPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  filterPillActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  filterPillText: {
    color: theme.colors.ink,
    fontWeight: "700",
    fontSize: 12.5,
  },
  filterPillTextActive: {
    color: theme.colors.primaryHover,
  },
  viewModeRow: {
    flexDirection: "row",
    gap: 6,
  },
  viewModeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  viewModeBtnActive: {
    backgroundColor: theme.colors.surface2,
    borderColor: "#BFDBFE",
  },
  controlCta: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  controlCtaPressed: {
    backgroundColor: theme.colors.goldDark,
  },
  controlCtaText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  emptyWrap: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
  },
  emptyTitle: {
    color: theme.colors.muted,
    fontSize: 13.5,
    fontWeight: "800",
  },
  table: {
    minWidth: 940,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  memberTableScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  memberCardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  memberCard: {
    flexGrow: 1,
    flexBasis: 280,
    maxWidth: 380,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    padding: 14,
    gap: 12,
  },
  memberCardPressed: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FAFC",
  },
  memberCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  memberCardMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  memberCardFooter: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
    gap: 4,
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
  colAssignmentMember: { width: 260 },
  colManager: { width: 150 },
  colCapacity: { width: 150 },
  colLocation: { width: 150 },
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
  attentionGrid: {
    gap: 10,
  },
  attentionItem: {
    minHeight: 68,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  attentionDanger: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  attentionWarning: {
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },
  attentionGood: {
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
  },
  attentionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  resourceHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
  },
  resourceRolePill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  resourceRoleText: {
    color: theme.colors.ink,
    fontSize: 12.5,
    fontWeight: "800",
  },
  resourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  resourceCard: {
    flexGrow: 1,
    flexBasis: 260,
    maxWidth: 380,
    minHeight: 178,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    padding: 14,
    gap: 12,
  },
  resourceCopy: {
    flex: 1,
    gap: 4,
  },
  resourceActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  resourcePreviewBackdrop: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.24)",
  },
  resourcePreviewScrim: {
    flex: 1,
  },
  resourcePreviewPanel: {
    width: "100%",
    maxWidth: 420,
    height: "100%",
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 20,
    gap: 16,
  },
  resourcePreviewBody: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    padding: 16,
    gap: 10,
    justifyContent: "center",
  },
  resourceItem: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    padding: 12,
  },
  performanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  performanceChart: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    padding: 14,
    gap: 10,
  },
  chartRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chartName: {
    width: 140,
    color: theme.colors.ink,
    fontSize: 12.5,
    fontWeight: "800",
  },
  chartTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  chartBar: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: theme.colors.gold,
  },
  chartValue: {
    width: 32,
    textAlign: "right",
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  quickActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickActionButton: {
    flexGrow: 1,
    flexBasis: 190,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quickActionButtonPrimary: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
  quickActionText: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  quickActionTextPrimary: {
    color: "#FFFFFF",
  },
  healthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  healthBadge: {
    flexGrow: 1,
    flexBasis: 160,
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    justifyContent: "center",
  },
  healthValue: {
    color: theme.colors.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  healthLabel: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  locationList: {
    gap: 8,
  },
  locationRow: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locationName: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  locationCount: {
    color: theme.colors.muted,
    fontSize: 12.5,
    fontWeight: "800",
  },
  insightList: {
    gap: 8,
  },
  insightRow: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    backgroundColor: "#F8FBFF",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  insightText: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  ownerCard: {
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 18,
    backgroundColor: "#F8FBFF",
    padding: 16,
    gap: 16,
  },
  ownerIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ownerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  ownerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  ownerName: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  ownerMeta: {
    color: theme.colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
  },
  ownerBadge: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ownerBadgeText: {
    color: theme.colors.goldDark,
    fontSize: 11.5,
    fontWeight: "900",
  },
  ownerSignals: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  ownerSignal: {
    flexGrow: 1,
    flexBasis: 170,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    padding: 12,
    gap: 4,
  },
  ownerSignalLabel: {
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ownerSignalValue: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  ownerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  ownerTransferButton: {
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },
  ownerTransferText: {
    color: theme.colors.goldDark,
    fontSize: 12,
    fontWeight: "900",
  },
  ownerEmpty: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 16,
    backgroundColor: "#F8FBFF",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rolesLayout: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
  },
  roleActionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  roleSaveBar: {
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    padding: 12,
    gap: 4,
  },
  roleSaveText: {
    color: theme.colors.primaryHover,
    fontSize: 12.5,
    fontWeight: "900",
  },
  roleWarningText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  lockedRoleBadge: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lockedRoleBadgeText: {
    color: theme.colors.goldDark,
    fontSize: 12,
    fontWeight: "900",
  },
  roleRenameBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    backgroundColor: "#F8FAFC",
  },
  roleRenameRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
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
  assignmentStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  miniMetric: {
    flexGrow: 1,
    flexBasis: 160,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    padding: 12,
  },
  miniMetricValue: {
    color: theme.colors.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  miniMetricLabel: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  assignmentTable: {
    minWidth: 1140,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  capacityCell: {
    justifyContent: "center",
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
  permissionRowLocked: {
    opacity: 0.72,
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
  dangerButton: {
    backgroundColor: theme.colors.danger,
  },
  dangerButtonPressed: {
    backgroundColor: "#9f3b2f",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
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
  confirmCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 20,
    gap: 14,
  },
  confirmIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCopy: {
    gap: 6,
  },
  confirmBody: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  scrollableModalCard: {
    maxHeight: "88%",
  },
  modalScroll: {
    width: "100%",
  },
  modalScrollContent: {
    gap: 14,
    paddingBottom: 4,
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
  ownerLockNotice: {
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    backgroundColor: "#FFFBEB",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  ownerLockText: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
  },
  transferList: {
    gap: 8,
    maxHeight: 280,
  },
  transferOption: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  transferOptionActive: {
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface2,
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
  quickActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailGrid: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  detailList: {
    gap: 8,
  },
  detailListRow: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    padding: 12,
    justifyContent: "center",
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
