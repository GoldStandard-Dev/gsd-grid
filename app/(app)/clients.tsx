import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import { supabase } from "../../src/lib/supabase";
import { getUserOrgId } from "../../src/lib/auth";
import { theme } from "../../src/theme/theme";
import { ui } from "../../src/theme/ui";

type ClientRow = {
  id: string;
  org_id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

type ClientForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

type AddressSuggestion = {
  place_id: string;
  display_name: string;
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const emptyForm: ClientForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
};

function formatPhoneNumber(value: string) {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function Clients() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ClientForm>(emptyForm);

  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [loadingAddressSuggestions, setLoadingAddressSuggestions] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);

  const [pageMessage, setPageMessage] = useState<string>("");
  const [pageError, setPageError] = useState<string>("");
  const [formError, setFormError] = useState<string>("");
  const [formSuccess, setFormSuccess] = useState<string>("");

  const addressSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadClients();

    return () => {
      if (addressSearchTimeout.current) {
        clearTimeout(addressSearchTimeout.current);
      }
    };
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
        .select("id, org_id, name, phone, email, address")
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
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    setLoadingAddressSuggestions(false);
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

  function onAddressChange(value: string) {
    setFormField("address", value);
    setShowAddressSuggestions(true);

    if (addressSearchTimeout.current) {
      clearTimeout(addressSearchTimeout.current);
    }

    const query = value.trim();

    if (query.length < 4) {
      setAddressSuggestions([]);
      setLoadingAddressSuggestions(false);
      return;
    }

    addressSearchTimeout.current = setTimeout(() => {
      void fetchAddressSuggestions(query);
    }, 350);
  }

  async function fetchAddressSuggestions(query: string) {
    setLoadingAddressSuggestions(true);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=us&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error("Address lookup failed.");
      }

      const data = await res.json();

      const suggestions: AddressSuggestion[] = Array.isArray(data)
        ? data.map((item: any) => ({
            place_id: String(item.place_id),
            display_name: item.display_name ?? "",
          }))
        : [];

      setAddressSuggestions(suggestions);
      setShowAddressSuggestions(true);
    } catch {
      setAddressSuggestions([]);
    } finally {
      setLoadingAddressSuggestions(false);
    }
  }

  function chooseAddress(displayName: string) {
    setFormField("address", displayName);
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
  }

  async function createClient() {
    if (saving) return;

    setFormError("");
    setFormSuccess("");
    setPageMessage("");

    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    const address = form.address.trim();

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
      };

      const insertRes = await supabase
        .from("clients")
        .insert(insertPayload)
        .select("id, org_id, name, phone, email, address")
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
      };

      setItems((prev) => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
      setFormSuccess("Client saved successfully.");
      setPageMessage(`Added client: ${newClient.name}`);

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
        (it.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const emailCount = useMemo(() => items.filter((x) => (x.email ?? "").trim()).length, [items]);

  return (
    <Screen padded={false}>
      <View style={[ui.container, styles.pagePad]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Clients</Text>
            <Text style={styles.heroSub}>Manage customer records and create work orders faster.</Text>
          </View>

          <Pressable style={styles.primaryBtn} onPress={openCreateModal}>
            <Text style={styles.primaryBtnText}>New Client</Text>
          </Pressable>
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
          <StatCard label="Total Clients" value={String(items.length)} />
          <StatCard label="Shown" value={String(filtered.length)} />
          <StatCard label="With Email" value={String(emailCount)} />
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search clients..."
            placeholderTextColor={MUTED_2}
            style={styles.search}
          />
        </View>

        <View style={[ui.card, styles.tableCard]}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { flex: 1.2 }]}>Name</Text>
            <Text style={[styles.th, { width: 180 }]}>Phone</Text>
            <Text style={[styles.th, { width: 240 }]}>Email</Text>
            <Text style={[styles.th, { flex: 1.1 }]}>Address</Text>
          </View>

          <ScrollView>
            {loading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>Loading clients...</Text>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>No clients yet.</Text>
                <Text style={styles.emptySub}>Add a client to start creating work orders.</Text>
              </View>
            ) : (
              filtered.map((item, index) => (
                <View key={item.id} style={[styles.tr, index % 2 === 0 ? styles.trStriped : null]}>
                  <Text style={[styles.td, { flex: 1.2 }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.td, { width: 180 }]} numberOfLines={1}>
                    {item.phone || "—"}
                  </Text>
                  <Text style={[styles.td, { width: 240 }]} numberOfLines={1}>
                    {item.email || "—"}
                  </Text>
                  <Text style={[styles.td, { flex: 1.1 }]} numberOfLines={1}>
                    {item.address || "—"}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        <Modal visible={showCreate} transparent animationType="fade" onRequestClose={closeCreateModal}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>New Client</Text>
                  <Text style={styles.modalSub}>Add a customer record to GSD Grid.</Text>
                </View>

                <Pressable onPress={closeCreateModal} style={styles.closeBtn}>
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
                  <TextInput
                    value={form.address}
                    onChangeText={onAddressChange}
                    onFocus={() => {
                      if (addressSuggestions.length) setShowAddressSuggestions(true);
                    }}
                    placeholder="Start typing an address..."
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, styles.inputMultiline]}
                    multiline
                  />

                  {showAddressSuggestions ? (
                    <View style={styles.suggestionsBox}>
                      {loadingAddressSuggestions ? (
                        <Text style={styles.suggestionLoading}>Searching addresses...</Text>
                      ) : addressSuggestions.length === 0 ? (
                        form.address.trim().length >= 4 ? (
                          <Text style={styles.suggestionLoading}>No address matches found.</Text>
                        ) : null
                      ) : (
                        addressSuggestions.map((item) => (
                          <Pressable
                            key={item.place_id}
                            onPress={() => chooseAddress(item.display_name)}
                            style={({ pressed }) => [styles.suggestionItem, pressed ? styles.suggestionItemPressed : null]}
                          >
                            <Text style={styles.suggestionText}>{item.display_name}</Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  ) : null}
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
      </View>
    </Screen>
  );
}


const PAGE_BG = "#FFFFFF";
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
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
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

  primaryBtn: {
    backgroundColor: GOLD_BRIGHT,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtnDisabled: {
    opacity: 0.7,
  },

  primaryBtnText: {
    fontWeight: "900",
    color: "#111",
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
    maxWidth: 720,
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

  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },

  statCard: {
    flexGrow: 1,
    minWidth: 220,
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
    color: GOLD_BRIGHT,
  },

  searchWrap: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    justifyContent: "center",
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
  },

  search: {
    fontSize: 14,
    color: TEXT,
  },

  tableCard: {
    padding: 0,
    overflow: "hidden",
  },

  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: DARK_BORDER,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#1C1C1C",
  },

  th: {
    fontWeight: "800",
    fontSize: 12,
    color: "#A3A3A3",
  },

  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: DARK_BORDER,
    backgroundColor: DARK_CARD,
  },

  trStriped: {
    backgroundColor: "#1C1C1C",
  },

  td: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },

  emptyWrap: {
    paddingVertical: 22,
    paddingHorizontal: 16,
  },

  empty: {
    fontWeight: "800",
    color: "#FFFFFF",
  },

  emptySub: {
    marginTop: 6,
    color: "#A3A3A3",
  },

  bannerError: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
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
    backgroundColor: "rgba(10,10,10,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
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
    color: TEXT,
  },

  modalSub: {
    marginTop: 4,
    color: MUTED,
    fontWeight: "700",
  },

  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    color: MUTED,
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 6,
  },

  input: {
    height: 46,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    color: TEXT,
    fontWeight: "800",
  },

  inputMultiline: {
    minHeight: 92,
    height: 92,
    paddingTop: 12,
    textAlignVertical: "top",
  },

  suggestionsBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },

  suggestionLoading: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: MUTED,
    fontWeight: "700",
  },

  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#EDE8DA",
  },

  suggestionItemPressed: {
    backgroundColor: "#F7F4ED",
  },

  suggestionText: {
    color: TEXT,
    fontWeight: "700",
    lineHeight: 19,
  },

  modalActions: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
});