import { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import {
  AppPage,
  ContentCard,
  PageHeader,
  SummaryCard,
  SummaryStrip,
} from "../../src/components/AppPage";
import EmptyState from "../../src/components/EmptyState";
import { supabase } from "../../src/lib/supabase";
import { getUserOrgId } from "../../src/lib/auth";
import { logActivity } from "../../src/lib/activity";
import { theme } from "../../src/theme/theme";

type ClientRow = {
  id: string;
  org_id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

type ClientForm = {
  name: string;
  phone: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
};

const emptyForm: ClientForm = {
  name: "",
  phone: "",
  email: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
};

function formatPhoneNumber(value: string) {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatAddressFields(address: {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) {
  const line1 = [address.address1, address.address2].filter(Boolean).join(", ");
  const line2 = [address.city, address.state, address.zip].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join(" - ");
}

export default function Clients() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ClientForm>(emptyForm);

  const [pageMessage, setPageMessage] = useState<string>("");
  const [pageError, setPageError] = useState<string>("");
  const [formError, setFormError] = useState<string>("");
  const [formSuccess, setFormSuccess] = useState<string>("");

  useEffect(() => {
    void loadClients();
  }, []);

  async function resolveOrgId() {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) {
      throw new Error(authError.message);
    }

    const userId = auth.user?.id;
    if (!userId) {
      throw new Error("No authenticated user found.");
    }

    const resolvedOrgId = await getUserOrgId(userId);
    if (!resolvedOrgId) {
      throw new Error("Could not determine the active organization.");
    }

    setOrgId(resolvedOrgId);
    setUserId(userId);
    return resolvedOrgId;
  }

  async function loadClients() {
    setLoading(true);
    setPageError("");
    setPageMessage("");

    try {
      const resolvedOrgId = await resolveOrgId();

      const res = await supabase
        .from("clients")
        .select("id, org_id, name, phone, email, address, address1, address2, city, state, zip")
        .eq("org_id", resolvedOrgId)
        .order("name", { ascending: true })
        .limit(200);

      if (res.error) {
        throw new Error(res.error.message);
      }

      const mapped: ClientRow[] = (res.data ?? []).map((r: any) => ({
        id: r.id,
        org_id: r.org_id,
        name: r.name ?? "Unnamed Client",
        phone: r.phone ?? "",
        email: r.email ?? "",
        address: r.address ?? "",
        address1: r.address1 ?? "",
        address2: r.address2 ?? "",
        city: r.city ?? "",
        state: r.state ?? "",
        zip: r.zip ?? "",
      }));

      setItems(mapped);
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }

  function setFormField<K extends keyof ClientForm>(key: K, value: ClientForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setFormError("");
    setFormSuccess("");
  }

  function openCreateModal() {
    resetForm();
    setShowCreate(true);
  }

  function closeCreateModal() {
    if (saving) return;
    setShowCreate(false);
    resetForm();
  }

  function onPhoneChange(value: string) {
    setFormField("phone", formatPhoneNumber(value));
  }

  async function createClient() {
    if (saving) return;

    setFormError("");
    setFormSuccess("");
    setPageMessage("");

    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    const address1 = form.address1.trim();
    const address2 = form.address2.trim();
    const city = form.city.trim();
    const state = form.state.trim().toUpperCase();
    const zip = form.zip.trim();
    const address = formatAddressFields({ address1, address2, city, state, zip });

    if (!name) {
      setFormError("Please enter a client name.");
      return;
    }

    const emailLooksInvalid = email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (emailLooksInvalid) {
      setFormError("Please enter a valid email address.");
      return;
    }

    const digits = phone.replace(/\D/g, "");
    if (phone.length > 0 && digits.length < 10) {
      setFormError("Please enter a full 10-digit phone number.");
      return;
    }

    setSaving(true);

    try {
      const activeOrgId = orgId || (await resolveOrgId());

      const insertPayload = {
        org_id: activeOrgId,
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        address1: address1 || null,
        address2: address2 || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
      };

      const insertRes = await supabase
        .from("clients")
        .insert(insertPayload)
        .select("id, org_id, name, phone, email, address, address1, address2, city, state, zip")
        .single();

      if (insertRes.error) {
        throw new Error(insertRes.error.message);
      }

      const newClient: ClientRow = {
        id: insertRes.data.id,
        org_id: insertRes.data.org_id,
        name: insertRes.data.name ?? name,
        phone: insertRes.data.phone ?? "",
        email: insertRes.data.email ?? "",
        address: insertRes.data.address ?? "",
        address1: insertRes.data.address1 ?? "",
        address2: insertRes.data.address2 ?? "",
        city: insertRes.data.city ?? "",
        state: insertRes.data.state ?? "",
        zip: insertRes.data.zip ?? "",
      };

      setItems((prev) => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
      setFormSuccess("Client saved successfully.");
      setPageMessage(`Added client: ${newClient.name}`);

      void logActivity(supabase, {
        org_id: newClient.org_id ?? activeOrgId,
        actor_user_id: userId || null,
        actor_name: null,
        action: `added client ${newClient.name}`,
        entity_type: "client",
        entity_id: newClient.id,
      });

      setTimeout(() => {
        setShowCreate(false);
        resetForm();
      }, 350);
    } catch (error: any) {
      setFormError(error?.message ?? "Failed to save client.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((it) => {
      return (
        it.name.toLowerCase().includes(q) ||
        (it.phone ?? "").toLowerCase().includes(q) ||
        (it.email ?? "").toLowerCase().includes(q) ||
        (formatAddressFields(it) || it.address || "").toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const emailCount = useMemo(() => items.filter((x) => (x.email ?? "").trim()).length, [items]);

  return (
    <Screen padded={false}>
      <AppPage>
        <PageHeader
          eyebrow="Clients"
          title="Directory"
          subtitle="Keep customer records clean, searchable, and ready for new work orders."
          actions={[
            { label: "Refresh", onPress: () => void loadClients() },
            { label: "New Client", primary: true, onPress: openCreateModal },
          ]}
        />

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

        <SummaryStrip>
          <SummaryCard label="Total Clients" value={String(items.length)} meta="All customer records" accent="teal" />
          <SummaryCard label="Visible" value={String(filtered.length)} meta="Current filter results" accent="lavender" />
          <SummaryCard label="With Email" value={String(emailCount)} meta="Ready for invoice delivery" accent="purple" />
        </SummaryStrip>

        <ContentCard title="Client list" subtitle="Search, review, and open details without overloading the page.">
          <View style={styles.searchWrap}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search clients"
              placeholderTextColor={theme.colors.muted}
              style={styles.search}
            />
          </View>

          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 1.2 }]}>Name</Text>
              <Text style={[styles.th, { width: 180 }]}>Contact</Text>
              <Text style={[styles.th, { width: 240 }]}>Email</Text>
              <Text style={[styles.th, { flex: 1.1 }]}>Address</Text>
            </View>

            <ScrollView>
              {loading ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.empty}>Loading clients...</Text>
                </View>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title="No clients yet"
                  body="Add your first client to speed up work orders, billing, and follow-up communication."
                  actionLabel="New Client"
                  onAction={openCreateModal}
                />
              ) : (
                filtered.map((item, index) => (
                  <View key={item.id} style={[styles.tr, index % 2 === 0 ? styles.trStriped : null]}>
                    <Text style={[styles.td, { flex: 1.2 }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.td, { width: 180 }]} numberOfLines={1}>
                      {item.phone || "-"}
                    </Text>
                    <Text style={[styles.td, { width: 240 }]} numberOfLines={1}>
                      {item.email || "-"}
                    </Text>
                    <Text style={[styles.td, { flex: 1.1 }]} numberOfLines={1}>
                      {formatAddressFields(item) || item.address || "-"}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </ContentCard>

        <Modal visible={showCreate} transparent animationType="fade" onRequestClose={closeCreateModal}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>New Client</Text>
                  <Text style={styles.modalSub}>Add a customer record to GSD Grid.</Text>
                </View>

                <Pressable onPress={closeCreateModal} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Close</Text>
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
                  <Text style={styles.fieldLabel}>Client Name</Text>
                  <TextInput
                    value={form.name}
                    onChangeText={(v) => setFormField("name", v)}
                    placeholder="John Smith"
                    placeholderTextColor={theme.colors.muted}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Phone</Text>
                  <TextInput
                    value={form.phone}
                    onChangeText={onPhoneChange}
                    placeholder="(555) 555-5555"
                    placeholderTextColor={theme.colors.muted}
                    style={styles.input}
                    keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "phone-pad"}
                  />
                </View>

                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    value={form.email}
                    onChangeText={(v) => setFormField("email", v)}
                    placeholder="client@email.com"
                    placeholderTextColor={theme.colors.muted}
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.fieldColFull}>
                  <Text style={styles.fieldLabel}>Address</Text>
                  <View style={styles.addressGrid}>
                    <TextInput
                      value={form.address1}
                      onChangeText={(v) => setFormField("address1", v)}
                      placeholder="Street address"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />

                    <TextInput
                      value={form.address2}
                      onChangeText={(v) => setFormField("address2", v)}
                      placeholder="Apt, suite, unit"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />

                    <View style={styles.addressCityCol}>
                      <TextInput
                        value={form.city}
                        onChangeText={(v) => setFormField("city", v)}
                        placeholder="City"
                        placeholderTextColor={theme.colors.muted}
                        style={styles.input}
                      />
                    </View>

                    <View style={styles.addressStateCol}>
                      <TextInput
                        value={form.state}
                        onChangeText={(v) => setFormField("state", v.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase())}
                        placeholder="ST"
                        placeholderTextColor={theme.colors.muted}
                        autoCapitalize="characters"
                        style={styles.input}
                      />
                    </View>

                    <View style={styles.addressZipCol}>
                      <TextInput
                        value={form.zip}
                        onChangeText={(v) => setFormField("zip", v.replace(/[^\d-]/g, "").slice(0, 10))}
                        placeholder="ZIP"
                        placeholderTextColor={theme.colors.muted}
                        keyboardType="numeric"
                        style={styles.input}
                      />
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.modalActions}>
                <Pressable onPress={closeCreateModal} style={styles.secondaryBtn} disabled={saving}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>

                <Pressable onPress={createClient} style={[styles.primaryBtn, saving ? styles.primaryBtnDisabled : null]} disabled={saving}>
                  <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Save Client"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </AppPage>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bannerError: {
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerErrorText: {
    color: "#991B1B",
    fontWeight: "800",
  },
  bannerSuccess: {
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerSuccessText: {
    color: "#166534",
    fontWeight: "800",
  },
  searchWrap: {
    height: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  search: {
    fontSize: 14,
    color: theme.colors.ink,
    fontWeight: "500",
  },
  table: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.bg,
  },
  th: {
    fontWeight: "800",
    fontSize: 12,
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  trStriped: {
    backgroundColor: "#F8FAFC",
  },
  td: {
    color: theme.colors.ink,
    fontWeight: "600",
    fontSize: 13,
  },
  emptyWrap: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  empty: {
    fontWeight: "800",
    color: theme.colors.ink,
  },
  emptySub: {
    marginTop: 6,
    color: theme.colors.muted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: theme.colors.surface,
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: theme.colors.ink,
  },
  modalSub: {
    marginTop: 4,
    color: theme.colors.muted,
    fontWeight: "500",
  },
  formBannerError: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  formBannerErrorText: {
    color: "#991B1B",
    fontWeight: "800",
  },
  formBannerSuccess: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  formBannerSuccessText: {
    color: "#166534",
    fontWeight: "800",
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  fieldCol: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 220,
  },
  fieldColFull: {
    width: "100%",
  },
  fieldLabel: {
    color: theme.colors.muted,
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    fontWeight: "500",
  },
  addressGrid: {
    gap: 12,
  },
  addressCityCol: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
  },
  addressStateCol: {
    flexGrow: 0,
    flexBasis: 96,
    minWidth: 84,
  },
  addressZipCol: {
    flexGrow: 0,
    flexBasis: 132,
    minWidth: 116,
  },
  modalActions: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  secondaryBtn: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  primaryBtn: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
