import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import { getUserOrgId } from "../../src/lib/auth";
import {
  ROLE_PERMISSIONS,
  hasPermission,
  type Permission,
  type UserRole,
} from "../../src/lib/permissions";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";
import { ui } from "../../src/theme/ui";

type PermissionKey = Permission;

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  display_name: string | null;
  created_at: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  work_location?: string | null;
  permissions?: PermissionKey[] | string[] | null;
  notes?: string | null;
  avatar_url?: string | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  display_name?: string | null;
  phone?: string | null;
  job_title?: string | null;
  work_location?: string | null;
  permissions?: PermissionKey[] | string[] | null;
  notes?: string | null;
  avatar_url?: string | null;
};

type InviteForm = {
  email: string;
  role: string;
  display_name: string;
  phone: string;
  job_title: string;
  work_location: string;
  notes: string;
  permissions: PermissionKey[];
  avatar_url: string;
};

type MemberEditForm = {
  display_name: string;
  email: string;
  phone: string;
  job_title: string;
  work_location: string;
  notes: string;
  role: string;
  status: string;
  permissions: PermissionKey[];
  avatar_url: string;
};

type InviteEditForm = {
  email: string;
  display_name: string;
  phone: string;
  job_title: string;
  work_location: string;
  notes: string;
  role: string;
  status: string;
  permissions: PermissionKey[];
  avatar_url: string;
};

type PermissionOption = {
  key: PermissionKey;
  label: string;
};

type LocationParts = {
  name: string;
  city: string;
  state: string;
};

type StateSelectProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

const STATUS_OPTIONS = ["active", "inactive", "pending"] as const;
const MEMBER_STATUS_OPTIONS = ["active", "inactive"] as const;

const DEFAULT_ROLE_OPTIONS: UserRole[] = [
  "owner",
  "general_manager",
  "operations_manager",
  "project_manager",
  "estimator",
  "office_admin",
  "hr_manager",
  "accounting_manager",
  "field_supervisor",
  "technician",
  "viewer",
];

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;

const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  manager: "general_manager",
  dispatcher: "office_admin",
  bookkeeper: "accounting_manager",
};

const LEGACY_PERMISSION_MAP: Record<string, PermissionKey[]> = {
  "dashboard.view": ["view_dashboard"],
  "team.view": ["view_people"],
  "team.manage": ["view_people", "invite_people", "edit_people", "manage_roles"],
  "clients.view": ["view_clients"],
  "clients.manage": ["view_clients", "create_clients", "edit_clients"],
  "workorders.view": ["view_workorders"],
  "workorders.manage": [
    "view_workorders",
    "create_workorders",
    "edit_workorders",
    "assign_workorders",
    "approve_workorders",
  ],
  "invoices.view": ["view_invoices"],
  "invoices.manage": [
    "view_invoices",
    "create_invoices",
    "edit_invoices",
    "delete_invoices",
    "view_financials",
  ],
  "settings.manage": ["view_settings", "edit_settings"],
};

const PERMISSION_OPTIONS: PermissionOption[] = [
  { key: "view_dashboard", label: "View Dashboard" },

  { key: "view_workorders", label: "View Work Orders" },
  { key: "create_workorders", label: "Create Work Orders" },
  { key: "edit_workorders", label: "Edit Work Orders" },
  { key: "delete_workorders", label: "Delete Work Orders" },
  { key: "assign_workorders", label: "Assign Work Orders" },
  { key: "approve_workorders", label: "Approve Work Orders" },

  { key: "view_invoices", label: "View Invoices" },
  { key: "create_invoices", label: "Create Invoices" },
  { key: "edit_invoices", label: "Edit Invoices" },
  { key: "delete_invoices", label: "Delete Invoices" },
  { key: "view_financials", label: "View Financial Data" },

  { key: "view_clients", label: "View Clients" },
  { key: "create_clients", label: "Create Clients" },
  { key: "edit_clients", label: "Edit Clients" },
  { key: "delete_clients", label: "Delete Clients" },

  { key: "view_people", label: "View Team" },
  { key: "invite_people", label: "Invite Team" },
  { key: "edit_people", label: "Edit Team" },
  { key: "remove_people", label: "Remove Team" },
  { key: "manage_roles", label: "Manage Roles" },

  { key: "view_hr", label: "View Workforce" },
  { key: "edit_employees", label: "Edit Employees" },
  { key: "manage_time_off", label: "Manage Time Off" },
  { key: "manage_reviews", label: "Manage Reviews" },
  { key: "manage_documents", label: "Manage Documents" },
  { key: "view_payroll", label: "View Payroll" },

  { key: "view_settings", label: "View Settings" },
  { key: "edit_settings", label: "Edit Settings" },
];

const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  owner: ROLE_PERMISSIONS.owner,
  general_manager: ROLE_PERMISSIONS.general_manager,
  operations_manager: ROLE_PERMISSIONS.operations_manager,
  project_manager: ROLE_PERMISSIONS.project_manager,
  estimator: ROLE_PERMISSIONS.estimator,
  office_admin: ROLE_PERMISSIONS.office_admin,
  hr_manager: ROLE_PERMISSIONS.hr_manager,
  accounting_manager: ROLE_PERMISSIONS.accounting_manager,
  field_supervisor: ROLE_PERMISSIONS.field_supervisor,
  technician: ROLE_PERMISSIONS.technician,
  viewer: ROLE_PERMISSIONS.viewer,
};

const emptyInviteForm: InviteForm = {
  email: "",
  role: "viewer",
  display_name: "",
  phone: "",
  job_title: "",
  work_location: "",
  notes: "",
  permissions: ROLE_DEFAULT_PERMISSIONS.viewer,
  avatar_url: "",
};

function TeamStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function getInitials(name?: string | null, email?: string | null) {
  const base = (name?.trim() || email?.trim() || "U").replace(/\s+/g, " ");
  const parts = base.split(" ").filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return base.slice(0, 2).toUpperCase();
}

function Avatar({
  name,
  email,
  avatarUrl,
  size = 42,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: number;
}) {
  const initials = getInitials(name, email);

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.avatarImage,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatarFallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={styles.avatarInitials}>{initials}</Text>
    </View>
  );
}

function titleCase(value: string | null | undefined) {
  return (value ?? "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function sanitizePhoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function formatPhoneInput(value: string) {
  const digits = sanitizePhoneInput(value);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function normalizeRoleName(value: string): UserRole | string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return LEGACY_ROLE_MAP[normalized] ?? normalized;
}

function normalizeRoleForPermissions(value: string): UserRole {
  const normalized = normalizeRoleName(value);
  const safeRole = String(normalized) as UserRole;
  return safeRole in ROLE_DEFAULT_PERMISSIONS ? safeRole : "viewer";
}

function normalizePermissions(value: unknown, role: string): PermissionKey[] {
  const roleKey = normalizeRoleForPermissions(role);
  const defaults = ROLE_DEFAULT_PERMISSIONS[roleKey] ?? ROLE_DEFAULT_PERMISSIONS.viewer;

  if (!Array.isArray(value)) {
    return defaults;
  }

  const next = new Set<PermissionKey>();

  value.forEach((item) => {
    if (typeof item !== "string") return;

    if (PERMISSION_OPTIONS.some((p) => p.key === item)) {
      next.add(item as PermissionKey);
      return;
    }

    const mapped = LEGACY_PERMISSION_MAP[item];
    if (mapped?.length) {
      mapped.forEach((permission) => next.add(permission));
    }
  });

  return next.size ? Array.from(next) : defaults;
}

function buildCustomLocation(name: string, city: string, state: string) {
  const cleanName = name.trim();
  const cleanCity = city.trim();
  const cleanState = state.trim().toUpperCase();

  const cityState = [cleanCity, cleanState].filter(Boolean).join(", ");

  if (cleanName && cityState) return `${cleanName} - ${cityState}`;
  if (cleanName) return cleanName;
  if (cityState) return cityState;
  return "";
}

function parseCustomLocation(value: string | null | undefined): LocationParts {
  const raw = (value ?? "").trim();

  if (!raw) {
    return { name: "", city: "", state: "" };
  }

  const [namePart, restPart] = raw.split(" - ");
  if (!restPart) {
    return { name: raw, city: "", state: "" };
  }

  const [cityPart, statePart] = restPart.split(",").map((part) => part.trim());

  return {
    name: namePart?.trim() ?? "",
    city: cityPart ?? "",
    state: statePart ?? "",
  };
}

function StateSelect({ value, onChange, label = "State" }: StateSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.fieldColSmall}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <Pressable onPress={() => setOpen(true)} style={styles.selectInput}>
        <Text style={[styles.selectInputText, !value ? styles.selectPlaceholder : null]}>
          {value || "Select"}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.dropdownBackdrop}>
          <View style={styles.dropdownCard}>
            <View style={styles.dropdownTop}>
              <Text style={styles.dropdownTitle}>Select State</Text>
              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              <View style={styles.stateGrid}>
                {US_STATES.map((state) => {
                  const active = value === state;
                  return (
                    <Pressable
                      key={state}
                      onPress={() => {
                        onChange(state);
                        setOpen(false);
                      }}
                      style={[styles.statePill, active ? styles.statePillActive : null]}
                    >
                      <Text style={[styles.statePillText, active ? styles.statePillTextActive : null]}>
                        {state}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MemberCard({
  item,
  canManagePeople,
  onEdit,
}: {
  item: MemberRow;
  canManagePeople: boolean;
  onEdit: () => void;
}) {
  const permissionCount = normalizePermissions(item.permissions, item.role).length;

  return (
    <View style={styles.personCard}>
      <View style={styles.personTop}>
        <View style={styles.personIdentity}>
          <Avatar
            name={item.display_name}
            email={item.email}
            avatarUrl={item.avatar_url}
            size={46}
          />
          <View style={styles.personIdentityText}>
            <Text style={styles.personName} numberOfLines={1}>
              {item.display_name || item.email || "Team Member"}
            </Text>
            <Text style={styles.personSub} numberOfLines={1}>
              {item.email || "No email"}
            </Text>
          </View>
        </View>

        {canManagePeople ? (
          <Pressable onPress={onEdit} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.personMetaGrid}>
        <View style={styles.personMetaItem}>
          <Text style={styles.personMetaLabel}>Role</Text>
          <Text style={styles.personMetaValue}>{titleCase(item.role)}</Text>
        </View>

        <View style={styles.personMetaItem}>
          <Text style={styles.personMetaLabel}>Status</Text>
          <Text style={styles.personMetaValue}>{titleCase(item.status)}</Text>
        </View>

        <View style={styles.personMetaItem}>
          <Text style={styles.personMetaLabel}>Job Title</Text>
          <Text style={styles.personMetaValue}>{item.job_title || "—"}</Text>
        </View>

        <View style={styles.personMetaItem}>
          <Text style={styles.personMetaLabel}>Phone</Text>
          <Text style={styles.personMetaValue}>{formatPhoneInput(item.phone || "") || "—"}</Text>
        </View>

        <View style={[styles.personMetaItem, styles.personMetaItemFull]}>
          <Text style={styles.personMetaLabel}>Work Location</Text>
          <Text style={styles.personMetaValue}>{item.work_location || "—"}</Text>
        </View>

        <View style={styles.personMetaItem}>
          <Text style={styles.personMetaLabel}>Permissions</Text>
          <Text style={styles.personMetaValue}>{permissionCount} enabled</Text>
        </View>

        <View style={styles.personMetaItem}>
          <Text style={styles.personMetaLabel}>Joined</Text>
          <Text style={styles.personMetaValue}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
    </View>
  );
}

function InviteCard({
  item,
  canManagePeople,
  onEdit,
  onCancel,
}: {
  item: InviteRow;
  canManagePeople: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const permissionCount = normalizePermissions(item.permissions, item.role).length;

  return (
    <View style={styles.personCard}>
      <View style={styles.personTop}>
        <View style={styles.personIdentity}>
          <Avatar
            name={item.display_name}
            email={item.email}
            avatarUrl={item.avatar_url}
            size={46}
          />
          <View style={styles.personIdentityText}>
            <Text style={styles.personName} numberOfLines={1}>
              {item.display_name || item.email || "Invited Member"}
            </Text>
            <Text style={styles.personSub} numberOfLines={1}>
              {item.email}
            </Text>
          </View>
        </View>

        {canManagePeople ? (
          <View style={styles.inlineBtnRow}>
            <Pressable onPress={onEdit} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>

            {item.status === "pending" ? (
              <Pressable onPress={onCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.personMetaGrid}>
        <View style={styles.personMetaItem}>
          <Text style={styles.personMetaLabel}>Role</Text>
          <Text style={styles.personMetaValue}>{titleCase(item.role)}</Text>
        </View>

        <View style={styles.personMetaItem}>
          <Text style={styles.personMetaLabel}>Status</Text>
          <Text style={styles.personMetaValue}>{titleCase(item.status)}</Text>
        </View>

        <View style={styles.personMetaItem}>
          <Text style={styles.personMetaLabel}>Job Title</Text>
          <Text style={styles.personMetaValue}>{item.job_title || "—"}</Text>
        </View>

        <View style={styles.personMetaItem}>
          <Text style={styles.personMetaLabel}>Phone</Text>
          <Text style={styles.personMetaValue}>{formatPhoneInput(item.phone || "") || "—"}</Text>
        </View>

        <View style={[styles.personMetaItem, styles.personMetaItemFull]}>
          <Text style={styles.personMetaLabel}>Work Location</Text>
          <Text style={styles.personMetaValue}>{item.work_location || "—"}</Text>
        </View>

        <View style={styles.personMetaItem}>
          <Text style={styles.personMetaLabel}>Permissions</Text>
          <Text style={styles.personMetaValue}>{permissionCount} enabled</Text>
        </View>

        <View style={styles.personMetaItem}>
          <Text style={styles.personMetaLabel}>Created</Text>
          <Text style={styles.personMetaValue}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function Team() {
  const [orgId, setOrgId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("viewer");
  const [currentUserPermissions, setCurrentUserPermissions] = useState<PermissionKey[]>(
    ROLE_DEFAULT_PERMISSIONS.viewer
  );

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [schemaSupportsExtendedFields, setSchemaSupportsExtendedFields] = useState(true);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showInviteEditModal, setShowInviteEditModal] = useState(false);

  const [form, setForm] = useState<InviteForm>(emptyInviteForm);
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [memberForm, setMemberForm] = useState<MemberEditForm | null>(null);
  const [editingInvite, setEditingInvite] = useState<InviteRow | null>(null);
  const [inviteEditForm, setInviteEditForm] = useState<InviteEditForm | null>(null);

  const [saving, setSaving] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [savingInviteEdit, setSavingInviteEdit] = useState(false);
  const [acceptingInvites, setAcceptingInvites] = useState(false);

  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [memberError, setMemberError] = useState("");
  const [inviteEditError, setInviteEditError] = useState("");

  const [customRoleInput, setCustomRoleInput] = useState("");
  const [customMemberRoleInput, setCustomMemberRoleInput] = useState("");
  const [customInviteRoleInput, setCustomInviteRoleInput] = useState("");

  const [customLocationName, setCustomLocationName] = useState("");
  const [customLocationCity, setCustomLocationCity] = useState("");
  const [customLocationState, setCustomLocationState] = useState("");

  const [customMemberLocationName, setCustomMemberLocationName] = useState("");
  const [customMemberLocationCity, setCustomMemberLocationCity] = useState("");
  const [customMemberLocationState, setCustomMemberLocationState] = useState("");

  const [customInviteLocationName, setCustomInviteLocationName] = useState("");
  const [customInviteLocationCity, setCustomInviteLocationCity] = useState("");
  const [customInviteLocationState, setCustomInviteLocationState] = useState("");

  useEffect(() => {
    void acceptMyInvitesAndLoad();
  }, []);

  async function resolveOrg() {
    const { data: auth, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);

    const userId = auth.user?.id;
    if (!userId) throw new Error("No authenticated user found.");

    const resolvedOrgId = await getUserOrgId(userId);
    if (!resolvedOrgId) throw new Error("Could not determine the active organization.");

    setCurrentUserId(userId);
    setOrgId(resolvedOrgId);
    return { userId, orgId: resolvedOrgId };
  }

  async function acceptMyInvitesAndLoad() {
    setAcceptingInvites(true);
    setPageError("");
    setPageMessage("");

    try {
      const acceptRes = await supabase.rpc("accept_org_invites_for_current_user");
      if (acceptRes.error) {
        throw new Error(acceptRes.error.message);
      }
      await loadTeamData();
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to accept invites.");
    } finally {
      setAcceptingInvites(false);
    }
  }

  async function loadTeamData() {
    setLoading(true);
    setPageError("");
    setPageMessage("");

    try {
      const { userId, orgId: activeOrgId } = await resolveOrg();

      let membersData: MemberRow[] = [];
      let invitesData: InviteRow[] = [];
      let extendedSupported = true;

      const membersRes = await supabase
        .from("org_members")
        .select(
          "id, user_id, role, status, display_name, email, phone, job_title, work_location, permissions, notes, avatar_url, created_at"
        )
        .eq("org_id", activeOrgId)
        .order("created_at", { ascending: false });

      if (membersRes.error) {
        extendedSupported = false;
        const fallbackMembersRes = await supabase
          .from("org_members")
          .select("id, user_id, role, status, display_name, created_at")
          .eq("org_id", activeOrgId)
          .order("created_at", { ascending: false });

        if (fallbackMembersRes.error) throw new Error(fallbackMembersRes.error.message);
        membersData = ((fallbackMembersRes.data as MemberRow[]) ?? []).map((item) => ({
          ...item,
          role: normalizeRoleName(item.role),
          permissions: normalizePermissions(null, item.role),
        }));
      } else {
        membersData = ((membersRes.data as MemberRow[]) ?? []).map((item) => ({
          ...item,
          role: normalizeRoleName(item.role),
          permissions: normalizePermissions(item.permissions, item.role),
        }));
      }

      const invitesRes = await supabase
        .from("org_invites")
        .select(
          "id, email, role, status, display_name, phone, job_title, work_location, permissions, notes, avatar_url, created_at"
        )
        .eq("org_id", activeOrgId)
        .order("created_at", { ascending: false });

      if (invitesRes.error) {
        extendedSupported = false;
        const fallbackInvitesRes = await supabase
          .from("org_invites")
          .select("id, email, role, status, created_at")
          .eq("org_id", activeOrgId)
          .order("created_at", { ascending: false });

        if (fallbackInvitesRes.error) throw new Error(fallbackInvitesRes.error.message);
        invitesData = ((fallbackInvitesRes.data as InviteRow[]) ?? []).map((item) => ({
          ...item,
          role: normalizeRoleName(item.role),
          permissions: normalizePermissions(null, item.role),
        }));
      } else {
        invitesData = ((invitesRes.data as InviteRow[]) ?? []).map((item) => ({
          ...item,
          role: normalizeRoleName(item.role),
          permissions: normalizePermissions(item.permissions, item.role),
        }));
      }

      setSchemaSupportsExtendedFields(extendedSupported);
      setMembers(membersData);
      setInvites(invitesData);

      const me = membersData.find((item) => item.user_id === userId);
      const safeRole = normalizeRoleForPermissions(me?.role ?? "viewer");
      const mergedPermissions = Array.from(
        new Set([
          ...(ROLE_DEFAULT_PERMISSIONS[safeRole] ?? ROLE_DEFAULT_PERMISSIONS.viewer),
          ...normalizePermissions(me?.permissions, safeRole),
        ])
      );

      setCurrentUserRole(safeRole);
      setCurrentUserPermissions(mergedPermissions);

      if (!extendedSupported) {
        setPageMessage(
          "Team page loaded. Add the new member fields in Supabase to save location, permissions, avatar, and profile details."
        );
      }
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to load team data.");
    } finally {
      setLoading(false);
    }
  }

  const canInvitePeople = hasPermission(currentUserPermissions, "invite_people");
  const canEditPeople = hasPermission(currentUserPermissions, "edit_people");
  const canManageRoles = hasPermission(currentUserPermissions, "manage_roles");
  const canManagePeople = canInvitePeople || canEditPeople || canManageRoles;

  const roleOptions = useMemo(() => {
    const dynamicRoles = new Set<string>([
      ...DEFAULT_ROLE_OPTIONS,
      ...members.map((item) => item.role).filter(Boolean),
      ...invites.map((item) => item.role).filter(Boolean),
      form.role,
      memberForm?.role ?? "",
      inviteEditForm?.role ?? "",
    ]);

    return Array.from(dynamicRoles).filter(Boolean);
  }, [members, invites, form.role, memberForm?.role, inviteEditForm?.role]);

  function openInviteModal() {
    setForm(emptyInviteForm);
    setCustomRoleInput("");
    setCustomLocationName("");
    setCustomLocationCity("");
    setCustomLocationState("");
    setFormError("");
    setFormSuccess("");
    setShowInviteModal(true);
  }

  function closeInviteModal() {
    if (saving) return;
    setShowInviteModal(false);
    setForm(emptyInviteForm);
    setCustomRoleInput("");
    setCustomLocationName("");
    setCustomLocationCity("");
    setCustomLocationState("");
    setFormError("");
    setFormSuccess("");
  }

  function openMemberModal(member: MemberRow) {
    if (!canManagePeople) return;

    setEditingMember(member);
    setMemberForm({
      display_name: member.display_name ?? "",
      email: member.email ?? "",
      phone: formatPhoneInput(member.phone ?? ""),
      job_title: member.job_title ?? "",
      work_location: member.work_location ?? "",
      notes: member.notes ?? "",
      role: member.role ?? "viewer",
      status: member.status ?? "active",
      permissions: normalizePermissions(member.permissions, member.role),
      avatar_url: member.avatar_url ?? "",
    });

    const parsedLocation = parseCustomLocation(member.work_location);
    setCustomMemberLocationName(parsedLocation.name);
    setCustomMemberLocationCity(parsedLocation.city);
    setCustomMemberLocationState(parsedLocation.state);

    setCustomMemberRoleInput("");
    setMemberError("");
    setShowMemberModal(true);
  }

  function closeMemberModal() {
    if (savingMember) return;
    setEditingMember(null);
    setMemberForm(null);
    setCustomMemberRoleInput("");
    setCustomMemberLocationName("");
    setCustomMemberLocationCity("");
    setCustomMemberLocationState("");
    setMemberError("");
    setShowMemberModal(false);
  }

  function openInviteEditModal(invite: InviteRow) {
    if (!canManagePeople) return;

    setEditingInvite(invite);
    setInviteEditForm({
      email: invite.email ?? "",
      display_name: invite.display_name ?? "",
      phone: formatPhoneInput(invite.phone ?? ""),
      job_title: invite.job_title ?? "",
      work_location: invite.work_location ?? "",
      notes: invite.notes ?? "",
      role: invite.role ?? "viewer",
      status: invite.status ?? "pending",
      permissions: normalizePermissions(invite.permissions, invite.role),
      avatar_url: invite.avatar_url ?? "",
    });

    const parsedLocation = parseCustomLocation(invite.work_location);
    setCustomInviteLocationName(parsedLocation.name);
    setCustomInviteLocationCity(parsedLocation.city);
    setCustomInviteLocationState(parsedLocation.state);

    setCustomInviteRoleInput("");
    setInviteEditError("");
    setShowInviteEditModal(true);
  }

  function closeInviteEditModal() {
    if (savingInviteEdit) return;
    setEditingInvite(null);
    setInviteEditForm(null);
    setCustomInviteRoleInput("");
    setCustomInviteLocationName("");
    setCustomInviteLocationCity("");
    setCustomInviteLocationState("");
    setInviteEditError("");
    setShowInviteEditModal(false);
  }

  async function sendInviteEmail(email: string, inviteId: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";

    console.log("Invoking send-invite function", {
      email: normalizedEmail,
      inviteId,
      app_url: origin,
    });

    const { data, error } = await supabase.functions.invoke("send-invite", {
      body: {
        email: normalizedEmail,
        invite_id: inviteId,
        app_url: origin,
      },
    });

    if (error) {
      console.error("Invite email error:", error);
      throw new Error(error.message || "Failed to send invite email.");
    }

    if (!data) {
      console.warn("Invite email returned no data");
    } else {
      console.log("Invite email response:", data);
    }

    return data;
  }

  function toggleInvitePermission(permission: PermissionKey) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((item) => item !== permission)
        : [...prev.permissions, permission],
    }));
  }

  function toggleMemberPermission(permission: PermissionKey) {
    setMemberForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        permissions: prev.permissions.includes(permission)
          ? prev.permissions.filter((item) => item !== permission)
          : [...prev.permissions, permission],
      };
    });
  }

  function toggleInviteEditPermission(permission: PermissionKey) {
    setInviteEditForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        permissions: prev.permissions.includes(permission)
          ? prev.permissions.filter((item) => item !== permission)
          : [...prev.permissions, permission],
      };
    });
  }

  function applyRoleToInvite(role: string) {
    const safeRole = normalizeRoleForPermissions(role);
    setForm((prev) => ({
      ...prev,
      role: safeRole,
      permissions: ROLE_DEFAULT_PERMISSIONS[safeRole] ?? prev.permissions,
    }));
  }

  function applyRoleToMember(role: string) {
    const safeRole = normalizeRoleForPermissions(role);
    setMemberForm((prev) =>
      prev
        ? {
            ...prev,
            role: safeRole,
            permissions: ROLE_DEFAULT_PERMISSIONS[safeRole] ?? prev.permissions,
          }
        : prev
    );
  }

  function applyRoleToInviteEdit(role: string) {
    const safeRole = normalizeRoleForPermissions(role);
    setInviteEditForm((prev) =>
      prev
        ? {
            ...prev,
            role: safeRole,
            permissions: ROLE_DEFAULT_PERMISSIONS[safeRole] ?? prev.permissions,
          }
        : prev
    );
  }

  function applyInviteCustomLocation() {
    const location = buildCustomLocation(customLocationName, customLocationCity, customLocationState);
    if (!location) return;
    setForm((prev) => ({ ...prev, work_location: location }));
  }

  function applyMemberCustomLocation() {
    const location = buildCustomLocation(
      customMemberLocationName,
      customMemberLocationCity,
      customMemberLocationState
    );
    if (!location) return;
    setMemberForm((prev) => (prev ? { ...prev, work_location: location } : prev));
  }

  function applyInviteEditCustomLocation() {
    const location = buildCustomLocation(
      customInviteLocationName,
      customInviteLocationCity,
      customInviteLocationState
    );
    if (!location) return;
    setInviteEditForm((prev) => (prev ? { ...prev, work_location: location } : prev));
  }

  async function sendInvite() {
    if (saving || !canInvitePeople) return;

    setFormError("");
    setFormSuccess("");
    setPageMessage("");

    const email = form.email.trim().toLowerCase();
    const role = normalizeRoleForPermissions(form.role);
    const location = buildCustomLocation(customLocationName, customLocationCity, customLocationState);

    if (!email) {
      setFormError("Please enter an email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (!location) {
      setFormError("Please enter a custom work location.");
      return;
    }

    setSaving(true);

    try {
      const { userId, orgId: activeOrgId } = await resolveOrg();

      const pendingInviteRes = await supabase
        .from("org_invites")
        .select("id, email, status")
        .eq("org_id", activeOrgId)
        .eq("email", email)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (pendingInviteRes.error) throw new Error(pendingInviteRes.error.message);

      if ((pendingInviteRes.data ?? []).length > 0) {
        throw new Error("That email already has a pending invite.");
      }

      const basePayload = {
        org_id: activeOrgId,
        email,
        role,
        status: "pending",
        invited_by_user_id: userId,
      };

      const extendedPayload = {
        ...basePayload,
        display_name: form.display_name.trim() || null,
        phone: sanitizePhoneInput(form.phone) || null,
        job_title: form.job_title.trim() || null,
        work_location: location,
        notes: form.notes.trim() || null,
        permissions: form.permissions,
        avatar_url: form.avatar_url.trim() || null,
      };

      let insertRes = await supabase
        .from("org_invites")
        .insert(extendedPayload)
        .select(
          "id, email, role, status, display_name, phone, job_title, work_location, permissions, notes, avatar_url, created_at"
        )
        .single();

      if (insertRes.error) {
        insertRes = await supabase
          .from("org_invites")
          .insert(basePayload)
          .select("id, email, role, status, created_at")
          .single();

        if (insertRes.error) throw new Error(insertRes.error.message);
        setSchemaSupportsExtendedFields(false);
      }

      const newInvite = {
        ...(insertRes.data as InviteRow),
        role,
        work_location: location,
        permissions: normalizePermissions((insertRes.data as InviteRow)?.permissions, role),
      };

      await sendInviteEmail(newInvite.email, newInvite.id);
      await loadTeamData();

      setFormSuccess("Invite created and email sent.");
      setPageMessage(`Invite email sent to ${email}.`);

      setTimeout(() => {
        setShowInviteModal(false);
        setForm(emptyInviteForm);
        setCustomLocationName("");
        setCustomLocationCity("");
        setCustomLocationState("");
        setFormError("");
        setFormSuccess("");
      }, 300);
    } catch (error: any) {
      console.error("Failed to create invite:", error);
      setFormError(error?.message ?? "Failed to create invite.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMemberChanges() {
    if (!editingMember || !memberForm || savingMember || !canManagePeople) return;

    setSavingMember(true);
    setMemberError("");
    setPageMessage("");
    setPageError("");

    try {
      const role = normalizeRoleForPermissions(memberForm.role);
      const location = buildCustomLocation(
        customMemberLocationName,
        customMemberLocationCity,
        customMemberLocationState
      );

      if (!location) {
        throw new Error("Please enter a custom work location.");
      }

      const extendedPayload = {
        display_name: memberForm.display_name.trim() || null,
        email: memberForm.email.trim().toLowerCase() || null,
        phone: sanitizePhoneInput(memberForm.phone) || null,
        job_title: memberForm.job_title.trim() || null,
        work_location: location,
        notes: memberForm.notes.trim() || null,
        role,
        status: memberForm.status,
        permissions: memberForm.permissions,
        avatar_url: memberForm.avatar_url.trim() || null,
      };

      let res = await supabase
        .from("org_members")
        .update(extendedPayload)
        .eq("id", editingMember.id)
        .select("*")
        .single();

      if (res.error) {
        const fallbackPayload = {
          display_name: memberForm.display_name.trim() || null,
          role,
          status: memberForm.status,
        };
        res = await supabase
          .from("org_members")
          .update(fallbackPayload)
          .eq("id", editingMember.id)
          .select("id, user_id, role, status, display_name, created_at")
          .single();
        if (res.error) throw new Error(res.error.message);
        setSchemaSupportsExtendedFields(false);
      }

      const updatedMember = {
        ...(res.data as MemberRow),
        role,
        work_location: location,
        permissions: normalizePermissions((res.data as MemberRow)?.permissions, role),
      };

      setMembers((prev) =>
        prev.map((item) => (item.id === editingMember.id ? { ...item, ...updatedMember } : item))
      );
      setPageMessage("Member updated.");
      closeMemberModal();
    } catch (error: any) {
      setMemberError(error?.message ?? "Failed to update member.");
    } finally {
      setSavingMember(false);
    }
  }

  async function saveInviteChanges() {
    if (!editingInvite || !inviteEditForm || savingInviteEdit || !canManagePeople) return;

    setSavingInviteEdit(true);
    setInviteEditError("");
    setPageMessage("");
    setPageError("");

    try {
      const role = normalizeRoleForPermissions(inviteEditForm.role);
      const location = buildCustomLocation(
        customInviteLocationName,
        customInviteLocationCity,
        customInviteLocationState
      );

      if (!location) {
        throw new Error("Please enter a custom work location.");
      }

      const extendedPayload = {
        email: inviteEditForm.email.trim().toLowerCase(),
        display_name: inviteEditForm.display_name.trim() || null,
        phone: sanitizePhoneInput(inviteEditForm.phone) || null,
        job_title: inviteEditForm.job_title.trim() || null,
        work_location: location,
        notes: inviteEditForm.notes.trim() || null,
        role,
        status: inviteEditForm.status,
        permissions: inviteEditForm.permissions,
        avatar_url: inviteEditForm.avatar_url.trim() || null,
      };

      let res = await supabase
        .from("org_invites")
        .update(extendedPayload)
        .eq("id", editingInvite.id)
        .select("*")
        .single();

      if (res.error) {
        const fallbackPayload = {
          email: inviteEditForm.email.trim().toLowerCase(),
          role,
          status: inviteEditForm.status,
        };
        res = await supabase
          .from("org_invites")
          .update(fallbackPayload)
          .eq("id", editingInvite.id)
          .select("id, email, role, status, created_at")
          .single();
        if (res.error) throw new Error(res.error.message);
        setSchemaSupportsExtendedFields(false);
      }

      const updatedInvite = {
        ...(res.data as InviteRow),
        role,
        work_location: location,
        permissions: normalizePermissions((res.data as InviteRow)?.permissions, role),
      };

      setInvites((prev) =>
        prev.map((item) => (item.id === editingInvite.id ? { ...item, ...updatedInvite } : item))
      );
      setPageMessage("Invite updated.");
      closeInviteEditModal();
    } catch (error: any) {
      setInviteEditError(error?.message ?? "Failed to update invite.");
    } finally {
      setSavingInviteEdit(false);
    }
  }

  async function cancelInvite(inviteId: string) {
    if (!canManagePeople) return;

    setPageError("");
    setPageMessage("");

    try {
      const res = await supabase.from("org_invites").update({ status: "cancelled" }).eq("id", inviteId);

      if (res.error) throw new Error(res.error.message);

      setInvites((prev) =>
        prev.map((invite) =>
          invite.id === inviteId ? { ...invite, status: "cancelled" } : invite
        )
      );
      setPageMessage("Invite cancelled.");
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to cancel invite.");
    }
  }

  const activeMembers = useMemo(
    () => members.filter((x) => x.status?.toLowerCase() === "active").length,
    [members]
  );

  const pendingInvites = useMemo(
    () => invites.filter((x) => x.status?.toLowerCase() === "pending").length,
    [invites]
  );

  const adminCount = useMemo(
    () =>
      members.filter((x) => {
        const role = normalizeRoleForPermissions(x.role);
        return role === "owner" || role === "general_manager" || role === "operations_manager";
      }).length,
    [members]
  );

  const customLocationCount = useMemo(
    () =>
      members.filter((x) => (x.work_location ?? "").trim()).length +
      invites.filter((x) => (x.work_location ?? "").trim()).length,
    [members, invites]
  );

  return (
    <Screen padded={false}>
      <View style={[ui.container, styles.pagePad]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Team</Text>
            <Text style={styles.heroSub}>Manage members, invites, roles, permissions, and custom work locations.</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable style={styles.refreshBtn} onPress={acceptMyInvitesAndLoad}>
              <Text style={styles.refreshBtnText}>{acceptingInvites ? "Checking..." : "Check My Invites"}</Text>
            </Pressable>

            {canInvitePeople ? (
              <Pressable style={styles.inviteBtn} onPress={openInviteModal}>
                <Text style={styles.inviteText}>Invite Person</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {!schemaSupportsExtendedFields ? (
          <View style={styles.bannerWarn}>
            <Text style={styles.bannerWarnText}>
              Extended team fields are not in your database yet. Role updates still work, but
              location, permissions, avatar, and profile details need the new columns in Supabase.
            </Text>
          </View>
        ) : null}

        {pageError ? (
          <View style={styles.bannerError}>
            <Text style={styles.bannerErrorText}>{pageError}</Text>
          </View>
        ) : null}

        {pageMessage ? (
          <View style={styles.bannerSuccess}>
            <Text style={styles.bannerSuccessText}>{pageMessage}</Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <TeamStat label="Active Members" value={String(activeMembers)} />
          <TeamStat label="Pending Invites" value={String(pendingInvites)} />
          <TeamStat label="Leadership" value={String(adminCount)} />
          <TeamStat label="Saved Locations" value={String(customLocationCount)} />
        </View>

        <View style={[ui.card, styles.card]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.title}>Members</Text>
              <Text style={styles.sectionSub}>Edit profiles, role access, and custom work locations.</Text>
            </View>
            <Text style={styles.meta}>{loading ? "Loading..." : `${members.length} total`}</Text>
          </View>

          {loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>Loading members...</Text>
            </View>
          ) : members.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>No members yet.</Text>
              <Text style={styles.emptySub}>Invite members to collaborate inside GSD Grid.</Text>
            </View>
          ) : (
            <View style={styles.cardGrid}>
              {members.map((item) => (
                <MemberCard
                  key={item.id}
                  item={item}
                  canManagePeople={canManagePeople}
                  onEdit={() => openMemberModal(item)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={[ui.card, styles.card, { marginTop: 14 }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.title}>Invites</Text>
              <Text style={styles.sectionSub}>Review pending invites before teammates join.</Text>
            </View>
            <Text style={styles.meta}>{loading ? "Loading..." : `${invites.length} total`}</Text>
          </View>

          {loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>Loading invites...</Text>
            </View>
          ) : invites.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>No invites yet.</Text>
              <Text style={styles.emptySub}>Create an invite to start adding teammates.</Text>
            </View>
          ) : (
            <View style={styles.cardGrid}>
              {invites.map((item) => (
                <InviteCard
                  key={item.id}
                  item={item}
                  canManagePeople={canManagePeople}
                  onEdit={() => openInviteEditModal(item)}
                  onCancel={() => cancelInvite(item.id)}
                />
              ))}
            </View>
          )}
        </View>

        <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={closeInviteModal}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Invite Person</Text>
                  <Text style={styles.modalSub}>
                    Add team details, set a custom work location, and choose starting access before sending the invite.
                  </Text>
                </View>

                <Pressable onPress={closeInviteModal} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </View>

              {formError ? (
                <View style={styles.formBannerError}>
                  <Text style={styles.formBannerErrorText}>{formError}</Text>
                </View>
              ) : null}

              {formSuccess ? (
                <View style={styles.formBannerSuccess}>
                  <Text style={styles.formBannerSuccessText}>{formSuccess}</Text>
                </View>
              ) : null}

              <ScrollView style={{ maxHeight: 560 }}>
                <View style={styles.formGrid}>
                  <View style={styles.fieldColFull}>
                    <Text style={styles.fieldLabel}>Invite Email</Text>
                    <TextInput
                      value={form.email}
                      onChangeText={(v) => setForm((prev) => ({ ...prev, email: v }))}
                      placeholder="teammate@email.com"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Full Name</Text>
                      <TextInput
                        value={form.display_name}
                        onChangeText={(v) => setForm((prev) => ({ ...prev, display_name: v }))}
                        placeholder="John Smith"
                        placeholderTextColor={theme.colors.muted}
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Email</Text>
                      <TextInput
                        value={form.email}
                        editable={false}
                        placeholderTextColor={theme.colors.muted}
                        style={[styles.input, styles.disabledInput]}
                        autoCapitalize="none"
                      />
                    </View>
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Phone</Text>
                      <TextInput
                        value={form.phone}
                        onChangeText={(v) =>
                          setForm((prev) => ({
                            ...prev,
                            phone: formatPhoneInput(v),
                          }))
                        }
                        placeholder="(555) 555-5555"
                        placeholderTextColor={theme.colors.muted}
                        style={styles.input}
                        keyboardType="phone-pad"
                      />
                    </View>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Job Title</Text>
                      <TextInput
                        value={form.job_title}
                        onChangeText={(v) => setForm((prev) => ({ ...prev, job_title: v }))}
                        placeholder="Estimator"
                        placeholderTextColor={theme.colors.muted}
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldColFull}>
                    <Text style={styles.fieldLabel}>Profile Picture URL</Text>
                    <TextInput
                      value={form.avatar_url}
                      onChangeText={(v) => setForm((prev) => ({ ...prev, avatar_url: v }))}
                      placeholder="https://..."
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.fieldColFull}>
                    <Text style={styles.fieldLabel}>Preview</Text>
                    <View style={styles.previewCard}>
                      <Avatar
                        name={form.display_name}
                        email={form.email}
                        avatarUrl={form.avatar_url}
                        size={52}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.previewName}>{form.display_name || "New Team Member"}</Text>
                        <Text style={styles.previewSub}>{form.email || "No email set"}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.fieldColFull}>
                    <Text style={styles.fieldLabel}>Custom Work Location</Text>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldCol}>
                        <TextInput
                          value={customLocationName}
                          onChangeText={setCustomLocationName}
                          placeholder="Location name"
                          placeholderTextColor={theme.colors.muted}
                          style={styles.input}
                        />
                      </View>

                      <View style={styles.fieldCol}>
                        <TextInput
                          value={customLocationCity}
                          onChangeText={setCustomLocationCity}
                          placeholder="City"
                          placeholderTextColor={theme.colors.muted}
                          style={styles.input}
                        />
                      </View>

                      <StateSelect value={customLocationState} onChange={setCustomLocationState} />
                    </View>

                    <View style={styles.fieldInlineAction}>
                      <Pressable onPress={applyInviteCustomLocation} style={styles.secondaryBtn}>
                        <Text style={styles.secondaryBtnText}>Apply Location</Text>
                      </Pressable>
                    </View>

                    <Text style={styles.locationPreviewText}>
                      {form.work_location || buildCustomLocation(customLocationName, customLocationCity, customLocationState) || "No location set"}
                    </Text>
                  </View>

                  <View style={styles.fieldColFull}>
                    <Text style={styles.fieldLabel}>Role</Text>
                    <View style={styles.roleRow}>
                      {roleOptions.map((role) => {
                        const active = form.role === role;
                        return (
                          <Pressable
                            key={role}
                            onPress={() => applyRoleToInvite(role)}
                            style={[styles.rolePill, active ? styles.rolePillActive : null]}
                          >
                            <Text style={[styles.rolePillText, active ? styles.rolePillTextActive : null]}>
                              {titleCase(role)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={styles.fieldCol}>
                      <Text style={styles.fieldLabel}>Custom Role Name</Text>
                      <TextInput
                        value={customRoleInput}
                        onChangeText={setCustomRoleInput}
                        placeholder="Project lead"
                        placeholderTextColor={theme.colors.muted}
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.fieldInlineAction}>
                      <Pressable
                        onPress={() => {
                          const role = normalizeRoleName(customRoleInput);
                          if (!role) return;
                          applyRoleToInvite(String(role));
                          setCustomRoleInput("");
                        }}
                        style={styles.secondaryBtn}
                      >
                        <Text style={styles.secondaryBtnText}>Use Custom Role</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.fieldColFull}>
                    <Text style={styles.fieldLabel}>Permissions</Text>
                    <View style={styles.permissionGrid}>
                      {PERMISSION_OPTIONS.map((permission) => {
                        const active = form.permissions.includes(permission.key);
                        return (
                          <Pressable
                            key={permission.key}
                            onPress={() => toggleInvitePermission(permission.key)}
                            style={[styles.permissionCard, active ? styles.permissionCardActive : null]}
                          >
                            <Text style={[styles.permissionText, active ? styles.permissionTextActive : null]}>
                              {permission.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.fieldColFull}>
                    <Text style={styles.fieldLabel}>Notes</Text>
                    <TextInput
                      value={form.notes}
                      onChangeText={(v) => setForm((prev) => ({ ...prev, notes: v }))}
                      placeholder="Any details about this team member"
                      placeholderTextColor={theme.colors.muted}
                      style={[styles.input, styles.textArea]}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <Pressable onPress={closeInviteModal} style={styles.secondaryBtn} disabled={saving}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>

                <Pressable onPress={sendInvite} style={[styles.inviteBtn, saving ? { opacity: 0.7 } : null]} disabled={saving}>
                  <Text style={styles.inviteText}>{saving ? "Sending..." : "Send Invite"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showMemberModal} transparent animationType="fade" onRequestClose={closeMemberModal}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Edit Member</Text>
                  <Text style={styles.modalSub}>Update general information, role access, and custom work location.</Text>
                </View>
                <Pressable onPress={closeMemberModal} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </View>

              {memberError ? (
                <View style={styles.formBannerError}>
                  <Text style={styles.formBannerErrorText}>{memberError}</Text>
                </View>
              ) : null}

              {memberForm ? (
                <>
                  <ScrollView style={{ maxHeight: 560 }}>
                    <View style={styles.formGrid}>
                      <View style={styles.fieldRow}>
                        <View style={styles.fieldCol}>
                          <Text style={styles.fieldLabel}>Full Name</Text>
                          <TextInput
                            value={memberForm.display_name}
                            onChangeText={(v) => setMemberForm((prev) => (prev ? { ...prev, display_name: v } : prev))}
                            placeholder="John Smith"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.input}
                          />
                        </View>
                        <View style={styles.fieldCol}>
                          <Text style={styles.fieldLabel}>Email</Text>
                          <TextInput
                            value={memberForm.email}
                            onChangeText={(v) => setMemberForm((prev) => (prev ? { ...prev, email: v } : prev))}
                            placeholder="name@email.com"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.input}
                            autoCapitalize="none"
                            keyboardType="email-address"
                          />
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldCol}>
                          <Text style={styles.fieldLabel}>Phone</Text>
                          <TextInput
                            value={memberForm.phone}
                            onChangeText={(v) =>
                              setMemberForm((prev) => (prev ? { ...prev, phone: formatPhoneInput(v) } : prev))
                            }
                            placeholder="(555) 555-5555"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.input}
                            keyboardType="phone-pad"
                          />
                        </View>
                        <View style={styles.fieldCol}>
                          <Text style={styles.fieldLabel}>Job Title</Text>
                          <TextInput
                            value={memberForm.job_title}
                            onChangeText={(v) => setMemberForm((prev) => (prev ? { ...prev, job_title: v } : prev))}
                            placeholder="Foreman"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.input}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Profile Picture URL</Text>
                        <TextInput
                          value={memberForm.avatar_url}
                          onChangeText={(v) => setMemberForm((prev) => (prev ? { ...prev, avatar_url: v } : prev))}
                          placeholder="https://..."
                          placeholderTextColor={theme.colors.muted}
                          style={styles.input}
                          autoCapitalize="none"
                        />
                      </View>

                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Preview</Text>
                        <View style={styles.previewCard}>
                          <Avatar
                            name={memberForm.display_name}
                            email={memberForm.email}
                            avatarUrl={memberForm.avatar_url}
                            size={52}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.previewName}>{memberForm.display_name || "Team Member"}</Text>
                            <Text style={styles.previewSub}>{memberForm.email || "No email set"}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Custom Work Location</Text>
                        <View style={styles.fieldRow}>
                          <View style={styles.fieldCol}>
                            <TextInput
                              value={customMemberLocationName}
                              onChangeText={setCustomMemberLocationName}
                              placeholder="Location name"
                              placeholderTextColor={theme.colors.muted}
                              style={styles.input}
                            />
                          </View>

                          <View style={styles.fieldCol}>
                            <TextInput
                              value={customMemberLocationCity}
                              onChangeText={setCustomMemberLocationCity}
                              placeholder="City"
                              placeholderTextColor={theme.colors.muted}
                              style={styles.input}
                            />
                          </View>

                          <StateSelect value={customMemberLocationState} onChange={setCustomMemberLocationState} />
                        </View>

                        <View style={styles.fieldInlineAction}>
                          <Pressable onPress={applyMemberCustomLocation} style={styles.secondaryBtn}>
                            <Text style={styles.secondaryBtnText}>Apply Location</Text>
                          </Pressable>
                        </View>

                        <Text style={styles.locationPreviewText}>
                          {memberForm.work_location || buildCustomLocation(customMemberLocationName, customMemberLocationCity, customMemberLocationState) || "No location set"}
                        </Text>
                      </View>

                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Role</Text>
                        <View style={styles.roleRow}>
                          {roleOptions.map((role) => {
                            const active = memberForm.role === role;
                            return (
                              <Pressable
                                key={role}
                                onPress={() => applyRoleToMember(role)}
                                style={[styles.rolePill, active ? styles.rolePillActive : null]}
                              >
                                <Text style={[styles.rolePillText, active ? styles.rolePillTextActive : null]}>
                                  {titleCase(role)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldCol}>
                          <Text style={styles.fieldLabel}>Custom Role Name</Text>
                          <TextInput
                            value={customMemberRoleInput}
                            onChangeText={setCustomMemberRoleInput}
                            placeholder="Project lead"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.input}
                          />
                        </View>
                        <View style={styles.fieldInlineAction}>
                          <Pressable
                            onPress={() => {
                              const role = normalizeRoleName(customMemberRoleInput);
                              if (!role) return;
                              applyRoleToMember(String(role));
                              setCustomMemberRoleInput("");
                            }}
                            style={styles.secondaryBtn}
                          >
                            <Text style={styles.secondaryBtnText}>Use Custom Role</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.fieldCol}>
                        <Text style={styles.fieldLabel}>Status</Text>
                        <View style={styles.roleRow}>
                          {MEMBER_STATUS_OPTIONS.map((status) => {
                            const active = memberForm.status === status;
                            return (
                              <Pressable
                                key={status}
                                onPress={() => setMemberForm((prev) => (prev ? { ...prev, status } : prev))}
                                style={[styles.rolePill, active ? styles.rolePillActive : null]}
                              >
                                <Text style={[styles.rolePillText, active ? styles.rolePillTextActive : null]}>
                                  {titleCase(status)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Permissions</Text>
                        <View style={styles.permissionGrid}>
                          {PERMISSION_OPTIONS.map((permission) => {
                            const active = memberForm.permissions.includes(permission.key);
                            return (
                              <Pressable
                                key={permission.key}
                                onPress={() => toggleMemberPermission(permission.key)}
                                style={[styles.permissionCard, active ? styles.permissionCardActive : null]}
                              >
                                <Text style={[styles.permissionText, active ? styles.permissionTextActive : null]}>
                                  {permission.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Notes</Text>
                        <TextInput
                          value={memberForm.notes}
                          onChangeText={(v) => setMemberForm((prev) => (prev ? { ...prev, notes: v } : prev))}
                          placeholder="Role details, internal notes, schedule notes"
                          placeholderTextColor={theme.colors.muted}
                          style={[styles.input, styles.textArea]}
                          multiline
                          textAlignVertical="top"
                        />
                      </View>
                    </View>
                  </ScrollView>

                  <View style={styles.modalActions}>
                    <Pressable onPress={closeMemberModal} style={styles.secondaryBtn} disabled={savingMember}>
                      <Text style={styles.secondaryBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveMemberChanges}
                      style={[styles.inviteBtn, savingMember ? { opacity: 0.7 } : null]}
                      disabled={savingMember}
                    >
                      <Text style={styles.inviteText}>{savingMember ? "Saving..." : "Save Changes"}</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </Modal>

        <Modal visible={showInviteEditModal} transparent animationType="fade" onRequestClose={closeInviteEditModal}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Edit Invite</Text>
                  <Text style={styles.modalSub}>Update invite details, access, and custom work location.</Text>
                </View>
                <Pressable onPress={closeInviteEditModal} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </View>

              {inviteEditError ? (
                <View style={styles.formBannerError}>
                  <Text style={styles.formBannerErrorText}>{inviteEditError}</Text>
                </View>
              ) : null}

              {inviteEditForm ? (
                <>
                  <ScrollView style={{ maxHeight: 560 }}>
                    <View style={styles.formGrid}>
                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Invite Email</Text>
                        <TextInput
                          value={inviteEditForm.email}
                          onChangeText={(v) => setInviteEditForm((prev) => (prev ? { ...prev, email: v } : prev))}
                          placeholder="name@email.com"
                          placeholderTextColor={theme.colors.muted}
                          style={styles.input}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldCol}>
                          <Text style={styles.fieldLabel}>Full Name</Text>
                          <TextInput
                            value={inviteEditForm.display_name}
                            onChangeText={(v) => setInviteEditForm((prev) => (prev ? { ...prev, display_name: v } : prev))}
                            placeholder="John Smith"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.input}
                          />
                        </View>
                        <View style={styles.fieldCol}>
                          <Text style={styles.fieldLabel}>Email</Text>
                          <TextInput
                            value={inviteEditForm.email}
                            editable={false}
                            placeholderTextColor={theme.colors.muted}
                            style={[styles.input, styles.disabledInput]}
                            autoCapitalize="none"
                          />
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldCol}>
                          <Text style={styles.fieldLabel}>Phone</Text>
                          <TextInput
                            value={inviteEditForm.phone}
                            onChangeText={(v) =>
                              setInviteEditForm((prev) => (prev ? { ...prev, phone: formatPhoneInput(v) } : prev))
                            }
                            placeholder="(555) 555-5555"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.input}
                            keyboardType="phone-pad"
                          />
                        </View>
                        <View style={styles.fieldCol}>
                          <Text style={styles.fieldLabel}>Job Title</Text>
                          <TextInput
                            value={inviteEditForm.job_title}
                            onChangeText={(v) => setInviteEditForm((prev) => (prev ? { ...prev, job_title: v } : prev))}
                            placeholder="Project Coordinator"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.input}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Profile Picture URL</Text>
                        <TextInput
                          value={inviteEditForm.avatar_url}
                          onChangeText={(v) => setInviteEditForm((prev) => (prev ? { ...prev, avatar_url: v } : prev))}
                          placeholder="https://..."
                          placeholderTextColor={theme.colors.muted}
                          style={styles.input}
                          autoCapitalize="none"
                        />
                      </View>

                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Preview</Text>
                        <View style={styles.previewCard}>
                          <Avatar
                            name={inviteEditForm.display_name}
                            email={inviteEditForm.email}
                            avatarUrl={inviteEditForm.avatar_url}
                            size={52}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.previewName}>{inviteEditForm.display_name || "Invited Member"}</Text>
                            <Text style={styles.previewSub}>{inviteEditForm.email || "No email set"}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Custom Work Location</Text>
                        <View style={styles.fieldRow}>
                          <View style={styles.fieldCol}>
                            <TextInput
                              value={customInviteLocationName}
                              onChangeText={setCustomInviteLocationName}
                              placeholder="Location name"
                              placeholderTextColor={theme.colors.muted}
                              style={styles.input}
                            />
                          </View>

                          <View style={styles.fieldCol}>
                            <TextInput
                              value={customInviteLocationCity}
                              onChangeText={setCustomInviteLocationCity}
                              placeholder="City"
                              placeholderTextColor={theme.colors.muted}
                              style={styles.input}
                            />
                          </View>

                          <StateSelect value={customInviteLocationState} onChange={setCustomInviteLocationState} />
                        </View>

                        <View style={styles.fieldInlineAction}>
                          <Pressable onPress={applyInviteEditCustomLocation} style={styles.secondaryBtn}>
                            <Text style={styles.secondaryBtnText}>Apply Location</Text>
                          </Pressable>
                        </View>

                        <Text style={styles.locationPreviewText}>
                          {inviteEditForm.work_location || buildCustomLocation(customInviteLocationName, customInviteLocationCity, customInviteLocationState) || "No location set"}
                        </Text>
                      </View>

                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Role</Text>
                        <View style={styles.roleRow}>
                          {roleOptions.map((role) => {
                            const active = inviteEditForm.role === role;
                            return (
                              <Pressable
                                key={role}
                                onPress={() => applyRoleToInviteEdit(role)}
                                style={[styles.rolePill, active ? styles.rolePillActive : null]}
                              >
                                <Text style={[styles.rolePillText, active ? styles.rolePillTextActive : null]}>
                                  {titleCase(role)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldCol}>
                          <Text style={styles.fieldLabel}>Custom Role Name</Text>
                          <TextInput
                            value={customInviteRoleInput}
                            onChangeText={setCustomInviteRoleInput}
                            placeholder="Project lead"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.input}
                          />
                        </View>
                        <View style={styles.fieldInlineAction}>
                          <Pressable
                            onPress={() => {
                              const role = normalizeRoleName(customInviteRoleInput);
                              if (!role) return;
                              applyRoleToInviteEdit(String(role));
                              setCustomInviteRoleInput("");
                            }}
                            style={styles.secondaryBtn}
                          >
                            <Text style={styles.secondaryBtnText}>Use Custom Role</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.fieldCol}>
                        <Text style={styles.fieldLabel}>Status</Text>
                        <View style={styles.roleRow}>
                          {STATUS_OPTIONS.map((status) => {
                            const active = inviteEditForm.status === status;
                            return (
                              <Pressable
                                key={status}
                                onPress={() => setInviteEditForm((prev) => (prev ? { ...prev, status } : prev))}
                                style={[styles.rolePill, active ? styles.rolePillActive : null]}
                              >
                                <Text style={[styles.rolePillText, active ? styles.rolePillTextActive : null]}>
                                  {titleCase(status)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Permissions</Text>
                        <View style={styles.permissionGrid}>
                          {PERMISSION_OPTIONS.map((permission) => {
                            const active = inviteEditForm.permissions.includes(permission.key);
                            return (
                              <Pressable
                                key={permission.key}
                                onPress={() => toggleInviteEditPermission(permission.key)}
                                style={[styles.permissionCard, active ? styles.permissionCardActive : null]}
                              >
                                <Text style={[styles.permissionText, active ? styles.permissionTextActive : null]}>
                                  {permission.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.fieldColFull}>
                        <Text style={styles.fieldLabel}>Notes</Text>
                        <TextInput
                          value={inviteEditForm.notes}
                          onChangeText={(v) => setInviteEditForm((prev) => (prev ? { ...prev, notes: v } : prev))}
                          placeholder="Internal notes for this invite"
                          placeholderTextColor={theme.colors.muted}
                          style={[styles.input, styles.textArea]}
                          multiline
                          textAlignVertical="top"
                        />
                      </View>
                    </View>
                  </ScrollView>

                  <View style={styles.modalActions}>
                    <Pressable onPress={closeInviteEditModal} style={styles.secondaryBtn} disabled={savingInviteEdit}>
                      <Text style={styles.secondaryBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveInviteChanges}
                      style={[styles.inviteBtn, savingInviteEdit ? { opacity: 0.7 } : null]}
                      disabled={savingInviteEdit}
                    >
                      <Text style={styles.inviteText}>{savingInviteEdit ? "Saving..." : "Save Changes"}</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}


const PAGE_BG = "#F7F4ED";
const CARD_BG = "#FFFFFF";
const BORDER = "#EDE8DA";
const BORDER_SOFT = "rgba(212,175,55,0.22)";
const GOLD = "#D4AF37";
const GOLD_BRIGHT = "#D4AF37";
const TEXT = "#111111";
const MUTED = "#6B6B6B";
const MUTED_2 = "#6B6B6B";
const DARK_CARD = "#111111";
const DARK_BORDER = "rgba(212,175,55,0.22)";


const styles = StyleSheet.create({
  pagePad: { padding: 24, backgroundColor: PAGE_BG, minHeight: "100%" },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
    backgroundColor: DARK_CARD,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  headerActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  heroTitle: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  heroSub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    color: "rgba(255,255,255,0.76)",
    maxWidth: 760,
  },

  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },

  statCard: {
    flexGrow: 1,
    minWidth: 180,
    backgroundColor: DARK_CARD,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  statLabel: {
    fontSize: 12,
    color: "#A3A3A3",
    fontWeight: "800",
  },

  statValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "900",
    color: GOLD,
  },

  card: {
    padding: 16,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    alignItems: "center",
    gap: 12,
  },

  title: {
    fontSize: 16,
    fontWeight: "900",
    color: TEXT,
  },

  sectionSub: {
    marginTop: 4,
    color: MUTED,
    fontWeight: "700",
    fontSize: 12,
  },

  meta: {
    fontSize: 12,
    color: MUTED,
    fontWeight: "700",
  },

  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  personCard: {
    width: "100%",
    maxWidth: 420,
    flexGrow: 1,
    backgroundColor: DARK_CARD,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    borderRadius: 18,
    padding: 14,
  },

  personTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },

  personIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },

  personIdentityText: {
    flex: 1,
    minWidth: 0,
  },

  personName: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },

  personSub: {
    marginTop: 4,
    color: "#A3A3A3",
    fontWeight: "700",
    fontSize: 12,
  },

  inlineBtnRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  personMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  personMetaItem: {
    width: "48%",
    minWidth: 140,
  },

  personMetaItemFull: {
    width: "100%",
  },

  personMetaLabel: {
    fontSize: 11,
    color: "#A3A3A3",
    fontWeight: "800",
    marginBottom: 4,
  },

  personMetaValue: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "800",
  },

  inviteBtn: {
    backgroundColor: GOLD_BRIGHT,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },

  inviteText: {
    fontWeight: "900",
    color: "#111",
  },

  refreshBtn: {
    backgroundColor: "#1C1C1C",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },

  refreshBtnText: {
    fontWeight: "900",
    color: "#FFFFFF",
  },

  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryBtnText: {
    fontWeight: "900",
    color: TEXT,
  },

  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLD,
    backgroundColor: "#fff8e7",
  },

  editBtnText: {
    fontWeight: "800",
    color: theme.colors.goldDark,
    fontSize: 12,
  },

  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    backgroundColor: "#1C1C1C",
  },

  cancelBtnText: {
    fontWeight: "800",
    color: "#FFFFFF",
    fontSize: 12,
  },

  avatarFallback: {
    backgroundColor: "#F5E6B8",
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarInitials: {
    color: theme.colors.goldDark,
    fontWeight: "900",
    fontSize: 13,
  },

  avatarImage: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
  },

  emptyWrap: {
    paddingVertical: 20,
  },

  empty: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  emptySub: {
    marginTop: 6,
    color: "#A3A3A3",
    fontWeight: "700",
  },

  bannerError: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  bannerErrorText: {
    color: "#991b1b",
    fontWeight: "800",
  },

  bannerSuccess: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  bannerSuccessText: {
    color: "#166534",
    fontWeight: "800",
  },

  bannerWarn: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  bannerWarnText: {
    color: "#92400e",
    fontWeight: "800",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,17,17,0.18)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },

  modalCard: {
    width: "100%",
    maxWidth: 860,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
  },

  modalTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: TEXT,
  },

  modalSub: {
    marginTop: 4,
    color: MUTED,
    fontWeight: "700",
  },

  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },

  closeBtnText: {
    color: TEXT,
    fontWeight: "800",
  },

  formBannerError: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  formBannerErrorText: {
    color: "#991b1b",
    fontWeight: "800",
  },

  formBannerSuccess: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  formBannerSuccessText: {
    color: "#166534",
    fontWeight: "800",
  },

  formGrid: {
    gap: 14,
  },

  fieldRow: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },

  fieldCol: {
    flex: 1,
    minWidth: 240,
  },

  fieldColSmall: {
    width: 110,
  },

  fieldColFull: {
    width: "100%",
  },

  fieldInlineAction: {
    alignItems: "flex-start",
  },

  fieldLabel: {
    marginBottom: 6,
    color: MUTED,
    fontWeight: "800",
    fontSize: 12,
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#D4AF37",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: "700",
    color: TEXT,
    backgroundColor: "#FFFFFF",
  },

  selectInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#D4AF37",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  selectInputText: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT,
  },

  selectPlaceholder: {
    color: MUTED,
  },

  disabledInput: {
    backgroundColor: "#F0F0F0",
    color: MUTED,
  },

  textArea: {
    minHeight: 96,
  },

  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#FFFFFF",
  },

  previewName: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 14,
  },

  previewSub: {
    marginTop: 4,
    color: MUTED,
    fontWeight: "700",
    fontSize: 12,
  },

  locationPreviewText: {
    marginTop: 8,
    color: TEXT,
    fontWeight: "800",
    fontSize: 12,
  },

  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  rolePill: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F7F4ED",
    alignItems: "center",
    justifyContent: "center",
  },

  rolePillActive: {
    backgroundColor: "#D4AF37",
    borderColor: "#D4AF37",
  },

  rolePillText: {
    color: TEXT,
    fontSize: 12,
    fontWeight: "800",
  },

  rolePillTextActive: {
    color: "#111111",
  },

  permissionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  permissionCard: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F7F4ED",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  permissionCardActive: {
    borderColor: GOLD,
    backgroundColor: "#FFF4D6",
  },

  permissionText: {
    color: TEXT,
    fontSize: 12,
    fontWeight: "800",
  },

  permissionTextActive: {
    color: "#B8962E",
  },

  modalActions: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },

  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,17,17,0.18)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },

  dropdownCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },

  dropdownTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },

  dropdownTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: TEXT,
  },

  stateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  statePill: {
    width: 56,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F7F4ED",
    alignItems: "center",
    justifyContent: "center",
  },

  statePillActive: {
    backgroundColor: "#D4AF37",
    borderColor: "#D4AF37",
  },

  statePillText: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 12,
  },

  statePillTextActive: {
    color: "#111111",
  },
});