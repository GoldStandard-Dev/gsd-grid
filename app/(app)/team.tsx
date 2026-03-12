import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import { supabase } from "../../src/lib/supabase";
import { getUserOrgId } from "../../src/lib/auth";
import { theme } from "../../src/theme/theme";
import { ui } from "../../src/theme/ui";

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  display_name: string | null;
  created_at: string;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

type InviteForm = {
  email: string;
  role: string;
};

function TeamStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const emptyForm: InviteForm = {
  email: "",
  role: "viewer",
};

const ROLE_OPTIONS = ["owner", "manager", "dispatcher", "technician", "bookkeeper", "viewer"];

export default function Team() {
  const [orgId, setOrgId] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [form, setForm] = useState<InviteForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [acceptingInvites, setAcceptingInvites] = useState(false);

  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

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
      const { orgId: activeOrgId } = await resolveOrg();

      const membersRes = await supabase
        .from("org_members")
        .select("id, user_id, role, status, display_name, created_at")
        .eq("org_id", activeOrgId)
        .order("created_at", { ascending: false });

      if (membersRes.error) throw new Error(membersRes.error.message);

      const invitesRes = await supabase
        .from("org_invites")
        .select("id, email, role, status, created_at")
        .eq("org_id", activeOrgId)
        .order("created_at", { ascending: false });

      if (invitesRes.error) throw new Error(invitesRes.error.message);

      setMembers((membersRes.data as MemberRow[]) ?? []);
      setInvites((invitesRes.data as InviteRow[]) ?? []);
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to load team data.");
    } finally {
      setLoading(false);
    }
  }

  function openInviteModal() {
    setForm(emptyForm);
    setFormError("");
    setFormSuccess("");
    setShowInviteModal(true);
  }

  function closeInviteModal() {
    if (saving) return;
    setShowInviteModal(false);
    setForm(emptyForm);
    setFormError("");
    setFormSuccess("");
  }

  async function sendInviteEmail(email: string, inviteId: string) {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";

    const invokeRes = await supabase.functions.invoke("send-invite", {
      body: {
        email,
        invite_id: inviteId,
        app_url: origin,
      },
    });

    if (invokeRes.error) {
      throw new Error(invokeRes.error.message);
    }
  }

  async function sendInvite() {
    if (saving) return;

    setFormError("");
    setFormSuccess("");
    setPageMessage("");

    const email = form.email.trim().toLowerCase();
    const role = form.role.trim().toLowerCase();

    if (!email) {
      setFormError("Please enter an email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (!ROLE_OPTIONS.includes(role)) {
      setFormError("Please choose a valid role.");
      return;
    }

    setSaving(true);

    try {
      const { userId, orgId: activeOrgId } = await resolveOrg();

      const existingInviteRes = await supabase
        .from("org_invites")
        .select("id, email, status")
        .eq("org_id", activeOrgId)
        .eq("email", email)
        .maybeSingle();

      if (existingInviteRes.error) throw new Error(existingInviteRes.error.message);

      if (existingInviteRes.data && existingInviteRes.data.status === "pending") {
        throw new Error("That email already has a pending invite.");
      }

      const insertRes = await supabase
        .from("org_invites")
        .insert({
          org_id: activeOrgId,
          email,
          role,
          status: "pending",
          invited_by_user_id: userId,
        })
        .select("id, email, role, status, created_at")
        .single();

      if (insertRes.error) throw new Error(insertRes.error.message);

      const newInvite: InviteRow = {
        id: insertRes.data.id,
        email: insertRes.data.email,
        role: insertRes.data.role,
        status: insertRes.data.status,
        created_at: insertRes.data.created_at,
      };

      await sendInviteEmail(newInvite.email, newInvite.id);

      setInvites((prev) => [newInvite, ...prev]);
      setFormSuccess("Invite created and email sent.");
      setPageMessage(`Invite email sent to ${email}.`);

      setTimeout(() => {
        setShowInviteModal(false);
        setForm(emptyForm);
        setFormError("");
        setFormSuccess("");
      }, 300);
    } catch (error: any) {
      setFormError(error?.message ?? "Failed to create invite.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelInvite(inviteId: string) {
    setPageError("");
    setPageMessage("");

    try {
      const res = await supabase
        .from("org_invites")
        .update({ status: "cancelled" })
        .eq("id", inviteId);

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
        const role = (x.role ?? "").toLowerCase();
        return role === "owner" || role === "admin";
      }).length,
    [members]
  );

  return (
    <Screen padded={false}>
      <View style={[ui.container, styles.pagePad]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={ui.h1}>Team</Text>
            <Text style={ui.sub}>Manage members, roles, and invites.</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable style={styles.refreshBtn} onPress={acceptMyInvitesAndLoad}>
              <Text style={styles.refreshBtnText}>{acceptingInvites ? "Checking..." : "Check My Invites"}</Text>
            </Pressable>

            <Pressable style={styles.inviteBtn} onPress={openInviteModal}>
              <Text style={styles.inviteText}>Invite Member</Text>
            </Pressable>
          </View>
        </View>

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
          <TeamStat label="Admins" value={String(adminCount)} />
        </View>

        <View style={[ui.card, styles.card]}>
          <View style={styles.top}>
            <Text style={styles.title}>Members</Text>
            <Text style={styles.meta}>{loading ? "Loading..." : `${members.length} total`}</Text>
          </View>

          <View style={styles.tableHead}>
            <Text style={[styles.th, { flex: 1 }]}>Name</Text>
            <Text style={[styles.th, { width: 180 }]}>Role</Text>
            <Text style={[styles.th, { width: 160 }]}>Status</Text>
          </View>

          <ScrollView>
            {loading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>Loading members...</Text>
              </View>
            ) : members.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>No team members yet.</Text>
                <Text style={styles.emptySub}>Invite members to collaborate inside GSD Grid.</Text>
              </View>
            ) : (
              members.map((item, index) => (
                <View key={item.id} style={[styles.tr, index % 2 === 0 ? styles.trStriped : null]}>
                  <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>
                    {item.display_name || item.user_id}
                  </Text>
                  <Text style={[styles.td, { width: 180 }]} numberOfLines={1}>
                    {item.role}
                  </Text>
                  <Text style={[styles.td, { width: 160 }]} numberOfLines={1}>
                    {item.status}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        <View style={[ui.card, styles.card, { marginTop: 14 }]}>
          <View style={styles.top}>
            <Text style={styles.title}>Invites</Text>
            <Text style={styles.meta}>{loading ? "Loading..." : `${invites.length} total`}</Text>
          </View>

          <View style={styles.tableHead}>
            <Text style={[styles.th, { flex: 1 }]}>Email</Text>
            <Text style={[styles.th, { width: 180 }]}>Role</Text>
            <Text style={[styles.th, { width: 140 }]}>Status</Text>
            <Text style={[styles.th, { width: 120, textAlign: "right" }]}>Action</Text>
          </View>

          <ScrollView>
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
              invites.map((item, index) => (
                <View key={item.id} style={[styles.tr, index % 2 === 0 ? styles.trStriped : null]}>
                  <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>
                    {item.email}
                  </Text>
                  <Text style={[styles.td, { width: 180 }]} numberOfLines={1}>
                    {item.role}
                  </Text>
                  <Text style={[styles.td, { width: 140 }]} numberOfLines={1}>
                    {item.status}
                  </Text>
                  <View style={[styles.actionCell, { width: 120 }]}>
                    {item.status === "pending" ? (
                      <Pressable onPress={() => cancelInvite(item.id)} style={styles.cancelBtn}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.doneText}>—</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={closeInviteModal}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Invite Team Member</Text>
                  <Text style={styles.modalSub}>Create a pending invite for this organization.</Text>
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

              <View style={styles.formGrid}>
                <View style={styles.fieldColFull}>
                  <Text style={styles.fieldLabel}>Email</Text>
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

                <View style={styles.fieldColFull}>
                  <Text style={styles.fieldLabel}>Role</Text>
                  <View style={styles.roleRow}>
                    {ROLE_OPTIONS.map((role) => {
                      const active = form.role === role;
                      return (
                        <Pressable
                          key={role}
                          onPress={() => setForm((prev) => ({ ...prev, role }))}
                          style={[styles.rolePill, active ? styles.rolePillActive : null]}
                        >
                          <Text style={[styles.rolePillText, active ? styles.rolePillTextActive : null]}>
                            {role}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pagePad: { padding: 22 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 14,
  },

  headerActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },

  statCard: {
    flexGrow: 1,
    minWidth: 220,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  statLabel: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "800",
  },

  statValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.gold,
  },

  card: {
    padding: 16,
  },

  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    alignItems: "center",
  },

  title: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  meta: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "700",
  },

  inviteBtn: {
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },

  inviteText: {
    fontWeight: "900",
    color: "#111",
  },

  refreshBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  refreshBtnText: {
    fontWeight: "900",
    color: theme.colors.ink,
  },

  secondaryBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryBtnText: {
    fontWeight: "900",
    color: theme.colors.ink,
  },

  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#fff",
  },

  cancelBtnText: {
    fontWeight: "800",
    color: theme.colors.ink,
    fontSize: 12,
  },

  doneText: {
    color: theme.colors.muted,
    fontWeight: "700",
  },

  tableHead: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    gap: 10,
  },

  th: {
    fontWeight: "800",
    fontSize: 12,
    color: theme.colors.muted,
  },

  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },

  trStriped: {
    backgroundColor: "#fcfcfc",
  },

  td: {
    color: theme.colors.ink,
    fontWeight: "700",
    fontSize: 13,
  },

  actionCell: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  emptyWrap: {
    paddingVertical: 20,
  },

  empty: {
    color: theme.colors.ink,
    fontWeight: "800",
  },

  emptySub: {
    marginTop: 6,
    color: theme.colors.muted,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,17,17,0.18)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },

  modalCard: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    color: theme.colors.ink,
  },

  modalSub: {
    marginTop: 4,
    color: theme.colors.muted,
    fontWeight: "700",
  },

  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#fff",
  },

  closeBtnText: {
    color: theme.colors.ink,
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

  fieldColFull: {
    width: "100%",
  },

  fieldLabel: {
    marginBottom: 6,
    color: theme.colors.muted,
    fontWeight: "800",
    fontSize: 12,
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.ink,
    backgroundColor: "#fff",
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
    borderColor: theme.colors.border,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  rolePillActive: {
    backgroundColor: "#F5E6B8",
    borderColor: theme.colors.gold,
  },

  rolePillText: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },

  rolePillTextActive: {
    color: theme.colors.goldDark,
  },

  modalActions: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
});