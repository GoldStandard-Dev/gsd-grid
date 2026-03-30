import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Screen from "../../src/components/Screen";
import GoldButton from "../../src/components/GoldButton";
import { getUserOrgId } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";

type IndustryType =
  | "Window Treatments"
  | "General Construction"
  | "Flooring"
  | "Painting"
  | "Electrical"
  | "Plumbing"
  | "HVAC"
  | "Custom";

type PricingMode = "matrix" | "unit" | "flat" | "labor" | "material" | "formula";
type TabKey = "calculator" | "templates" | "fabrics" | "matrices" | "surcharges";

type PricingCollection = {
  id: string;
  name: string;
  industry_type: IndustryType;
  pricing_mode: PricingMode;
  is_default: boolean;
  description?: string | null;
};

type FabricRow = {
  id: string;
  collection_id: string;
  fabric_style: string;
  price_group: string;
  fabric_width: string;
  fr: boolean;
  roller_shade: boolean;
  panel_track: boolean;
  multi_directional: boolean;
};

type MatrixCell = {
  id: string;
  collection_id: string;
  price_group: string;
  width_to: number;
  height_to: number;
  price: number;
};

type SurchargeRow = {
  id: string;
  collection_id: string;
  surcharge_type: string;
  width_to: number;
  price: number;
};

type TemplateForm = {
  name: string;
  description: string;
  industry_type: IndustryType;
  pricing_mode: PricingMode;
  is_default: boolean;
};

type FabricForm = {
  fabric_style: string;
  price_group: string;
  fabric_width: string;
  fr: boolean;
  roller_shade: boolean;
  panel_track: boolean;
  multi_directional: boolean;
};

type MatrixForm = {
  price_group: string;
  width_to: string;
  height_to: string;
  price: string;
};

type SurchargeForm = {
  surcharge_type: string;
  width_to: string;
  price: string;
};

type HelpStateRow = {
  id: string;
  page_key: string;
  tour_completed: boolean;
  help_mode_enabled: boolean;
};

const INDUSTRY_OPTIONS: IndustryType[] = [
  "Window Treatments",
  "General Construction",
  "Flooring",
  "Painting",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Custom",
];

const PRICING_MODE_OPTIONS: PricingMode[] = [
  "matrix",
  "unit",
  "flat",
  "labor",
  "material",
  "formula",
];

const EMPTY_TEMPLATE_FORM: TemplateForm = {
  name: "",
  description: "",
  industry_type: "Custom",
  pricing_mode: "matrix",
  is_default: false,
};

const EMPTY_FABRIC_FORM: FabricForm = {
  fabric_style: "",
  price_group: "",
  fabric_width: "",
  fr: false,
  roller_shade: true,
  panel_track: false,
  multi_directional: false,
};

const EMPTY_MATRIX_FORM: MatrixForm = {
  price_group: "",
  width_to: "",
  height_to: "",
  price: "",
};

const EMPTY_SURCHARGE_FORM: SurchargeForm = {
  surcharge_type: "",
  width_to: "",
  price: "",
};

const PRICING_TOUR_STEPS = [
  {
    title: "Templates",
    body: "Templates are reusable pricing systems. Create one template for each product line, service type, or industry workflow.",
  },
  {
    title: "Items / Fabrics",
    body: "Items connect your products to pricing. A price group lets the calculator know which matrix table to use.",
  },
  {
    title: "Matrices",
    body: "Matrix cells price by size. Width To and Height To mean the maximum size that row applies to.",
  },
  {
    title: "Surcharges",
    body: "Surcharges are optional add-ons like hems, fascia, rush fees, trim packages, or custom upgrades.",
  },
  {
    title: "Calculator",
    body: "The calculator previews the final price using the selected item, dimensions, and chosen surcharges.",
  },
  {
    title: "Work Order Flow",
    body: "Once your pricing is built, this structure can feed your work orders so pricing auto-fills instead of being entered manually.",
  },
];

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function cleanDecimal(value: string) {
  const next = (value ?? "").replace(/[^0-9.]/g, "");
  const parts = next.split(".");
  if (parts.length <= 1) return next;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function cleanWholeNumber(value: string) {
  return (value ?? "").replace(/[^\d]/g, "");
}

function n(value: string | number | null | undefined) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function yn(value: boolean) {
  return value ? "Yes" : "No";
}

function findMatrixPrice(
  cells: MatrixCell[],
  collectionId: string,
  priceGroup: string,
  width: number,
  height: number
) {
  const groupCells = cells
    .filter(
      (item) =>
        item.collection_id === collectionId &&
        item.price_group.trim().toUpperCase() === priceGroup.trim().toUpperCase()
    )
    .sort((a, b) => {
      if (a.height_to === b.height_to) return a.width_to - b.width_to;
      return a.height_to - b.height_to;
    });

  if (!groupCells.length) return 0;

  const heightMatch = groupCells.filter((item) => item.width_to >= width && item.height_to >= height);

  if (heightMatch.length) {
    const best = [...heightMatch].sort((a, b) => {
      if (a.height_to === b.height_to) return a.width_to - b.width_to;
      return a.height_to - b.height_to;
    })[0];

    return Number(best.price || 0);
  }

  const closest = [...groupCells].sort((a, b) => {
    const aScore = Math.abs(a.width_to - width) + Math.abs(a.height_to - height);
    const bScore = Math.abs(b.width_to - width) + Math.abs(b.height_to - height);
    return aScore - bScore;
  })[0];

  return Number(closest?.price || 0);
}

function findSurchargePrice(
  rows: SurchargeRow[],
  collectionId: string,
  surchargeType: string,
  width: number
) {
  const filtered = rows
    .filter(
      (item) =>
        item.collection_id === collectionId &&
        item.surcharge_type.trim().toLowerCase() === surchargeType.trim().toLowerCase()
    )
    .sort((a, b) => a.width_to - b.width_to);

  if (!filtered.length) return 0;

  const match = filtered.find((item) => item.width_to >= width);
  return Number((match ?? filtered[filtered.length - 1]).price || 0);
}

function ChoicePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active ? styles.pillActive : null]}>
      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function SectionCard({
  icon,
  title,
  sub,
  children,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionTop}>
        <View style={styles.sectionTopLeft}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name={icon} size={18} color={theme.colors.goldDark} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionSub}>{sub}</Text>
          </View>
        </View>

        {right ? <View>{right}</View> : null}
      </View>

      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

function ToggleChip({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.toggleChip, value ? styles.toggleChipActive : null]}>
      <Ionicons
        name={value ? "checkmark-circle" : "ellipse-outline"}
        size={16}
        color={value ? theme.colors.goldDark : theme.colors.muted}
      />
      <Text style={[styles.toggleChipText, value ? styles.toggleChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function HelpTip({
  title,
  text,
  visible,
}: {
  title: string;
  text: string;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <View style={styles.helpTip}>
      <View style={styles.helpTipHeader}>
        <Ionicons name="information-circle-outline" size={16} color={theme.colors.goldDark} />
        <Text style={styles.helpTipTitle}>{title}</Text>
      </View>
      <Text style={styles.helpTipText}>{text}</Text>
    </View>
  );
}

function EmptyHelper({
  title,
  body,
  buttonLabel,
  onPress,
  visible,
}: {
  title: string;
  body: string;
  buttonLabel: string;
  onPress: () => void;
  visible: boolean;
}) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{body}</Text>
      {visible ? (
        <View style={{ marginTop: 12 }}>
          <GoldButton label={buttonLabel} onPress={onPress} style={{ minWidth: 160 }} />
        </View>
      ) : null}
    </View>
  );
}

export default function PricingPage() {
  const [orgId, setOrgId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");

  const [collections, setCollections] = useState<PricingCollection[]>([]);
  const [fabrics, setFabrics] = useState<FabricRow[]>([]);
  const [matrixCells, setMatrixCells] = useState<MatrixCell[]>([]);
  const [surcharges, setSurcharges] = useState<SurchargeRow[]>([]);

  const [tab, setTab] = useState<TabKey>("calculator");
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState<IndustryType | "All">("All");

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showFabricModal, setShowFabricModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showSurchargeModal, setShowSurchargeModal] = useState(false);

  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [helpMode, setHelpMode] = useState(true);

  const [templateForm, setTemplateForm] = useState<TemplateForm>(EMPTY_TEMPLATE_FORM);
  const [fabricForm, setFabricForm] = useState<FabricForm>(EMPTY_FABRIC_FORM);
  const [matrixForm, setMatrixForm] = useState<MatrixForm>(EMPTY_MATRIX_FORM);
  const [surchargeForm, setSurchargeForm] = useState<SurchargeForm>(EMPTY_SURCHARGE_FORM);

  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingFabric, setSavingFabric] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [savingSurcharge, setSavingSurcharge] = useState(false);

  const [selectedFabricId, setSelectedFabricId] = useState("");
  const [calcWidth, setCalcWidth] = useState("48");
  const [calcHeight, setCalcHeight] = useState("60");
  const [selectedSurcharges, setSelectedSurcharges] = useState<string[]>([]);
  const [wrapAdd, setWrapAdd] = useState(false);

  useEffect(() => {
    void loadPricingPage();
  }, []);

  async function resolveSession() {
    const { data: auth, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);

    const currentUserId = auth.user?.id;
    if (!currentUserId) throw new Error("No authenticated user found.");

    const resolvedOrgId = await getUserOrgId(currentUserId);
    if (!resolvedOrgId) throw new Error("Could not determine the active organization.");

    setUserId(currentUserId);
    setOrgId(resolvedOrgId);

    return { currentUserId, resolvedOrgId };
  }

  async function loadPricingPage() {
    setLoading(true);
    setPageError("");
    setPageMessage("");

    try {
      const { currentUserId, resolvedOrgId } = await resolveSession();

      const [collectionsRes, fabricsRes, matricesRes, surchargesRes] = await Promise.all([
        supabase
          .from("pricing_collections")
          .select("id, name, description, industry_type, pricing_mode, is_default")
          .eq("org_id", resolvedOrgId)
          .order("is_default", { ascending: false })
          .order("name", { ascending: true }),
        supabase
          .from("pricing_fabrics")
          .select(
            "id, collection_id, fabric_style, price_group, fabric_width, fr, roller_shade, panel_track, multi_directional"
          )
          .eq("org_id", resolvedOrgId)
          .order("fabric_style", { ascending: true }),
        supabase
          .from("pricing_matrix_cells")
          .select("id, collection_id, price_group, width_to, height_to, price")
          .eq("org_id", resolvedOrgId),
        supabase
          .from("pricing_surcharges")
          .select("id, collection_id, surcharge_type, width_to, price")
          .eq("org_id", resolvedOrgId),
      ]);

      if (collectionsRes.error) throw new Error(collectionsRes.error.message);
      if (fabricsRes.error) throw new Error(fabricsRes.error.message);
      if (matricesRes.error) throw new Error(matricesRes.error.message);
      if (surchargesRes.error) throw new Error(surchargesRes.error.message);

      const nextCollections = (collectionsRes.data ?? []) as PricingCollection[];
      const nextFabrics = (fabricsRes.data ?? []) as FabricRow[];
      const nextMatrices = (matricesRes.data ?? []) as MatrixCell[];
      const nextSurcharges = (surchargesRes.data ?? []) as SurchargeRow[];

      setCollections(nextCollections);
      setFabrics(nextFabrics);
      setMatrixCells(nextMatrices);
      setSurcharges(nextSurcharges);

      const defaultCollection =
        nextCollections.find((item) => item.is_default) ?? nextCollections[0] ?? null;

      setSelectedCollectionId((prev) =>
        nextCollections.some((item) => item.id === prev) ? prev : defaultCollection?.id ?? ""
      );

      if (!nextCollections.length) {
        setPageMessage("No pricing templates yet. Create your first custom template.");
      }

      await loadHelpState(currentUserId, resolvedOrgId);
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to load pricing.");
    } finally {
      setLoading(false);
    }
  }

  async function loadHelpState(currentUserId: string, resolvedOrgId: string) {
    try {
      const res = await supabase
        .from("user_help_state")
        .select("id, page_key, tour_completed, help_mode_enabled")
        .eq("user_id", currentUserId)
        .eq("org_id", resolvedOrgId)
        .eq("page_key", "pricing")
        .maybeSingle();

      if (res.error) {
        setHelpMode(true);
        setShowTourModal(true);
        return;
      }

      const row = res.data as HelpStateRow | null;

      if (!row) {
        setHelpMode(true);
        setShowTourModal(true);
        return;
      }

      setHelpMode(row.help_mode_enabled ?? true);
      if (!row.tour_completed) {
        setShowTourModal(true);
      }
    } catch {
      setHelpMode(true);
      setShowTourModal(true);
    }
  }

  async function saveHelpState(next: { help_mode_enabled?: boolean; tour_completed?: boolean }) {
    if (!userId || !orgId) return;

    try {
      await supabase.from("user_help_state").upsert(
        {
          user_id: userId,
          org_id: orgId,
          page_key: "pricing",
          help_mode_enabled: next.help_mode_enabled ?? helpMode,
          tour_completed: next.tour_completed ?? false,
        },
        { onConflict: "user_id,org_id,page_key" }
      );
    } catch {}
  }

  async function setHelpModeAndPersist(value: boolean) {
    setHelpMode(value);
    await saveHelpState({ help_mode_enabled: value });
  }

  async function completeTour() {
    setShowTourModal(false);
    setTourStepIndex(0);
    await saveHelpState({ tour_completed: true, help_mode_enabled: helpMode });
  }

  const filteredCollections = useMemo(() => {
    const q = search.trim().toLowerCase();

    return collections.filter((item) => {
      if (industryFilter !== "All" && item.industry_type !== industryFilter) return false;
      if (!q) return true;

      return (
        item.name.toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q) ||
        item.industry_type.toLowerCase().includes(q) ||
        item.pricing_mode.toLowerCase().includes(q)
      );
    });
  }, [collections, industryFilter, search]);

  const selectedCollection = useMemo(
    () =>
      collections.find((item) => item.id === selectedCollectionId) ??
      filteredCollections[0] ??
      null,
    [collections, filteredCollections, selectedCollectionId]
  );

  const visibleFabrics = useMemo(() => {
    const collectionId = selectedCollection?.id ?? "";
    return fabrics.filter((item) => item.collection_id === collectionId);
  }, [fabrics, selectedCollection]);

  useEffect(() => {
    if (!selectedCollection) {
      setSelectedFabricId("");
      return;
    }

    const firstFabric = fabrics.find((item) => item.collection_id === selectedCollection.id);
    setSelectedFabricId((prev) =>
      fabrics.some((item) => item.id === prev && item.collection_id === selectedCollection.id)
        ? prev
        : firstFabric?.id ?? ""
    );
  }, [fabrics, selectedCollection]);

  const selectedFabric = useMemo(
    () => fabrics.find((item) => item.id === selectedFabricId) ?? visibleFabrics[0] ?? null,
    [fabrics, selectedFabricId, visibleFabrics]
  );

  const widthNumber = useMemo(() => Number(cleanDecimal(calcWidth) || 0), [calcWidth]);
  const heightNumber = useMemo(() => Number(cleanDecimal(calcHeight) || 0), [calcHeight]);

  const basePrice = useMemo(() => {
    if (!selectedCollection || !selectedFabric || !widthNumber || !heightNumber) return 0;
    return findMatrixPrice(
      matrixCells,
      selectedCollection.id,
      selectedFabric.price_group,
      widthNumber,
      heightNumber
    );
  }, [heightNumber, matrixCells, selectedCollection, selectedFabric, widthNumber]);

  const surchargeOptions = useMemo(() => {
    if (!selectedCollection) return [];
    return Array.from(
      new Set(
        surcharges
          .filter((item) => item.collection_id === selectedCollection.id)
          .map((item) => item.surcharge_type)
      )
    ).sort();
  }, [selectedCollection, surcharges]);

  const surchargeTotal = useMemo(() => {
    if (!selectedCollection || !widthNumber) return 0;

    return selectedSurcharges.reduce((sum, item) => {
      return sum + findSurchargePrice(surcharges, selectedCollection.id, item, widthNumber);
    }, 0);
  }, [selectedCollection, selectedSurcharges, surcharges, widthNumber]);

  const wrapCharge = useMemo(() => (wrapAdd ? 25 : 0), [wrapAdd]);
  const total = useMemo(() => basePrice + surchargeTotal + wrapCharge, [basePrice, surchargeTotal, wrapCharge]);

  const matrixGroups = useMemo(() => {
    if (!selectedCollection) return [];
    return Array.from(
      new Set(
        matrixCells
          .filter((item) => item.collection_id === selectedCollection.id)
          .map((item) => item.price_group.trim().toUpperCase())
      )
    ).sort();
  }, [matrixCells, selectedCollection]);

  const selectedGroup = selectedFabric?.price_group?.trim().toUpperCase() ?? matrixGroups[0] ?? "";

  const currentMatrix = useMemo(() => {
    if (!selectedCollection || !selectedGroup) return [];

    return matrixCells
      .filter(
        (item) =>
          item.collection_id === selectedCollection.id &&
          item.price_group.trim().toUpperCase() === selectedGroup
      )
      .sort((a, b) => {
        if (a.height_to === b.height_to) return a.width_to - b.width_to;
        return a.height_to - b.height_to;
      });
  }, [matrixCells, selectedCollection, selectedGroup]);

  const matrixWidths = useMemo(
    () => Array.from(new Set(currentMatrix.map((item) => item.width_to))).sort((a, b) => a - b),
    [currentMatrix]
  );

  const matrixHeights = useMemo(
    () => Array.from(new Set(currentMatrix.map((item) => item.height_to))).sort((a, b) => a - b),
    [currentMatrix]
  );

  const groupedSurcharges = useMemo(() => {
    if (!selectedCollection) return [];

    const relevant = surcharges.filter((item) => item.collection_id === selectedCollection.id);
    const groups = Array.from(new Set(relevant.map((item) => item.surcharge_type))).sort();

    return groups.map((groupName) => ({
      name: groupName,
      rows: relevant
        .filter((item) => item.surcharge_type === groupName)
        .sort((a, b) => a.width_to - b.width_to),
    }));
  }, [selectedCollection, surcharges]);

  const collectionCount = collections.length;
  const fabricCount = visibleFabrics.length;
  const matrixCount = currentMatrix.length;
  const surchargeCount = surchargeOptions.length;

  function setTemplateField<K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) {
    setTemplateForm((prev) => ({ ...prev, [key]: value }));
  }

  function setFabricField<K extends keyof FabricForm>(key: K, value: FabricForm[K]) {
    setFabricForm((prev) => ({ ...prev, [key]: value }));
  }

  function setMatrixField<K extends keyof MatrixForm>(key: K, value: MatrixForm[K]) {
    setMatrixForm((prev) => ({ ...prev, [key]: value }));
  }

  function setSurchargeField<K extends keyof SurchargeForm>(key: K, value: SurchargeForm[K]) {
    setSurchargeForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetTemplateForm() {
    setTemplateForm(EMPTY_TEMPLATE_FORM);
  }

  function resetFabricForm() {
    setFabricForm(EMPTY_FABRIC_FORM);
  }

  function resetMatrixForm() {
    setMatrixForm(EMPTY_MATRIX_FORM);
  }

  function resetSurchargeForm() {
    setSurchargeForm(EMPTY_SURCHARGE_FORM);
  }

  function openTemplateModal() {
    resetTemplateForm();
    setShowTemplateModal(true);
  }

  function openFabricModal() {
    resetFabricForm();
    if (selectedFabric?.price_group) {
      setFabricForm((prev) => ({ ...prev, price_group: selectedFabric.price_group }));
    }
    setShowFabricModal(true);
  }

  function openMatrixModal() {
    resetMatrixForm();
    if (selectedGroup) {
      setMatrixForm((prev) => ({ ...prev, price_group: selectedGroup }));
    }
    setShowMatrixModal(true);
  }

  function openSurchargeModal() {
    resetSurchargeForm();
    setShowSurchargeModal(true);
  }

  async function saveTemplate() {
    if (savingTemplate) return;

    const name = templateForm.name.trim();
    if (!name) {
      Alert.alert("Missing name", "Enter a template name.");
      return;
    }

    try {
      setSavingTemplate(true);

      const activeOrgId = orgId || (await resolveSession()).resolvedOrgId;

      if (templateForm.is_default) {
        const clearDefault = await supabase
          .from("pricing_collections")
          .update({ is_default: false })
          .eq("org_id", activeOrgId);

        if (clearDefault.error) throw new Error(clearDefault.error.message);
      }

      const insertRes = await supabase
        .from("pricing_collections")
        .insert({
          org_id: activeOrgId,
          name,
          description: templateForm.description.trim() || null,
          industry_type: templateForm.industry_type,
          pricing_mode: templateForm.pricing_mode,
          is_default: templateForm.is_default,
        })
        .select("id, name, description, industry_type, pricing_mode, is_default")
        .single();

      if (insertRes.error) throw new Error(insertRes.error.message);

      const newTemplate = insertRes.data as PricingCollection;
      setCollections((prev) =>
        [...prev, newTemplate].sort((a, b) => {
          if (a.is_default === b.is_default) return a.name.localeCompare(b.name);
          return a.is_default ? -1 : 1;
        })
      );
      setSelectedCollectionId(newTemplate.id);
      setShowTemplateModal(false);
      setPageMessage(`Created template: ${newTemplate.name}`);
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Failed to save template.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function makeTemplateDefault(templateId: string) {
    try {
      const activeOrgId = orgId || (await resolveSession()).resolvedOrgId;

      const clearRes = await supabase
        .from("pricing_collections")
        .update({ is_default: false })
        .eq("org_id", activeOrgId);

      if (clearRes.error) throw new Error(clearRes.error.message);

      const setRes = await supabase
        .from("pricing_collections")
        .update({ is_default: true })
        .eq("id", templateId)
        .eq("org_id", activeOrgId);

      if (setRes.error) throw new Error(setRes.error.message);

      setCollections((prev) =>
        prev
          .map((item) => ({ ...item, is_default: item.id === templateId }))
          .sort((a, b) => {
            if (a.is_default === b.is_default) return a.name.localeCompare(b.name);
            return a.is_default ? -1 : 1;
          })
      );
    } catch (error: any) {
      Alert.alert("Update failed", error?.message ?? "Failed to set default template.");
    }
  }

  async function deleteTemplate(item: PricingCollection) {
    Alert.alert(
      "Delete template",
      `Delete ${item.name}? This should also remove its fabrics, matrices, and surcharges.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const activeOrgId = orgId || (await resolveSession()).resolvedOrgId;

              const s1 = await supabase
                .from("pricing_fabrics")
                .delete()
                .eq("org_id", activeOrgId)
                .eq("collection_id", item.id);
              if (s1.error) throw new Error(s1.error.message);

              const s2 = await supabase
                .from("pricing_matrix_cells")
                .delete()
                .eq("org_id", activeOrgId)
                .eq("collection_id", item.id);
              if (s2.error) throw new Error(s2.error.message);

              const s3 = await supabase
                .from("pricing_surcharges")
                .delete()
                .eq("org_id", activeOrgId)
                .eq("collection_id", item.id);
              if (s3.error) throw new Error(s3.error.message);

              const s4 = await supabase
                .from("pricing_collections")
                .delete()
                .eq("org_id", activeOrgId)
                .eq("id", item.id);
              if (s4.error) throw new Error(s4.error.message);

              setCollections((prev) => prev.filter((x) => x.id !== item.id));
              setFabrics((prev) => prev.filter((x) => x.collection_id !== item.id));
              setMatrixCells((prev) => prev.filter((x) => x.collection_id !== item.id));
              setSurcharges((prev) => prev.filter((x) => x.collection_id !== item.id));
              setSelectedCollectionId((prev) => (prev === item.id ? "" : prev));
              setPageMessage(`Deleted template: ${item.name}`);
            } catch (error: any) {
              Alert.alert("Delete failed", error?.message ?? "Failed to delete template.");
            }
          },
        },
      ]
    );
  }

  async function saveFabric() {
    if (savingFabric || !selectedCollection) return;

    const name = fabricForm.fabric_style.trim();
    if (!name) {
      Alert.alert("Missing item name", "Enter an item or fabric name.");
      return;
    }

    try {
      setSavingFabric(true);

      const activeOrgId = orgId || (await resolveSession()).resolvedOrgId;

      const insertRes = await supabase
        .from("pricing_fabrics")
        .insert({
          org_id: activeOrgId,
          collection_id: selectedCollection.id,
          fabric_style: name,
          price_group: fabricForm.price_group.trim().toUpperCase() || null,
          fabric_width: fabricForm.fabric_width.trim() || null,
          fr: fabricForm.fr,
          roller_shade: fabricForm.roller_shade,
          panel_track: fabricForm.panel_track,
          multi_directional: fabricForm.multi_directional,
        })
        .select(
          "id, collection_id, fabric_style, price_group, fabric_width, fr, roller_shade, panel_track, multi_directional"
        )
        .single();

      if (insertRes.error) throw new Error(insertRes.error.message);

      const newRow = insertRes.data as FabricRow;
      setFabrics((prev) => [...prev, newRow].sort((a, b) => a.fabric_style.localeCompare(b.fabric_style)));
      setSelectedFabricId(newRow.id);
      setShowFabricModal(false);
      setPageMessage(`Added item: ${newRow.fabric_style}`);
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Failed to save item.");
    } finally {
      setSavingFabric(false);
    }
  }

  async function deleteFabric(item: FabricRow) {
    Alert.alert("Delete item", `Delete ${item.fabric_style}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const activeOrgId = orgId || (await resolveSession()).resolvedOrgId;
            const res = await supabase
              .from("pricing_fabrics")
              .delete()
              .eq("org_id", activeOrgId)
              .eq("id", item.id);

            if (res.error) throw new Error(res.error.message);

            setFabrics((prev) => prev.filter((x) => x.id !== item.id));
          } catch (error: any) {
            Alert.alert("Delete failed", error?.message ?? "Failed to delete item.");
          }
        },
      },
    ]);
  }

  async function saveMatrixCell() {
    if (savingMatrix || !selectedCollection) return;

    const priceGroup = matrixForm.price_group.trim().toUpperCase();
    if (!priceGroup || !matrixForm.width_to || !matrixForm.height_to || !matrixForm.price) {
      Alert.alert("Missing values", "Enter a price group, width, height, and price.");
      return;
    }

    try {
      setSavingMatrix(true);

      const activeOrgId = orgId || (await resolveSession()).resolvedOrgId;

      const insertRes = await supabase
        .from("pricing_matrix_cells")
        .insert({
          org_id: activeOrgId,
          collection_id: selectedCollection.id,
          price_group: priceGroup,
          width_to: n(matrixForm.width_to),
          height_to: n(matrixForm.height_to),
          price: n(matrixForm.price),
        })
        .select("id, collection_id, price_group, width_to, height_to, price")
        .single();

      if (insertRes.error) throw new Error(insertRes.error.message);

      const newCell = insertRes.data as MatrixCell;
      setMatrixCells((prev) => [...prev, newCell]);
      setShowMatrixModal(false);
      setPageMessage(`Added matrix cell for group ${newCell.price_group}.`);
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Failed to save matrix cell.");
    } finally {
      setSavingMatrix(false);
    }
  }

  async function deleteMatrixCell(item: MatrixCell) {
    Alert.alert(
      "Delete matrix cell",
      `Delete ${item.price_group} • ${item.width_to}" x ${item.height_to}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const activeOrgId = orgId || (await resolveSession()).resolvedOrgId;
              const res = await supabase
                .from("pricing_matrix_cells")
                .delete()
                .eq("org_id", activeOrgId)
                .eq("id", item.id);

              if (res.error) throw new Error(res.error.message);

              setMatrixCells((prev) => prev.filter((x) => x.id !== item.id));
            } catch (error: any) {
              Alert.alert("Delete failed", error?.message ?? "Failed to delete matrix cell.");
            }
          },
        },
      ]
    );
  }

  async function saveSurcharge() {
    if (savingSurcharge || !selectedCollection) return;

    const name = surchargeForm.surcharge_type.trim();
    if (!name || !surchargeForm.width_to || !surchargeForm.price) {
      Alert.alert("Missing values", "Enter a surcharge name, width, and price.");
      return;
    }

    try {
      setSavingSurcharge(true);

      const activeOrgId = orgId || (await resolveSession()).resolvedOrgId;

      const insertRes = await supabase
        .from("pricing_surcharges")
        .insert({
          org_id: activeOrgId,
          collection_id: selectedCollection.id,
          surcharge_type: name,
          width_to: n(surchargeForm.width_to),
          price: n(surchargeForm.price),
        })
        .select("id, collection_id, surcharge_type, width_to, price")
        .single();

      if (insertRes.error) throw new Error(insertRes.error.message);

      const newRow = insertRes.data as SurchargeRow;
      setSurcharges((prev) => [...prev, newRow]);
      setShowSurchargeModal(false);
      setPageMessage(`Added surcharge: ${newRow.surcharge_type}`);
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Failed to save surcharge.");
    } finally {
      setSavingSurcharge(false);
    }
  }

  async function deleteSurcharge(item: SurchargeRow) {
    Alert.alert("Delete surcharge", `Delete ${item.surcharge_type}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const activeOrgId = orgId || (await resolveSession()).resolvedOrgId;
            const res = await supabase
              .from("pricing_surcharges")
              .delete()
              .eq("org_id", activeOrgId)
              .eq("id", item.id);

            if (res.error) throw new Error(res.error.message);

            setSurcharges((prev) => prev.filter((x) => x.id !== item.id));
          } catch (error: any) {
            Alert.alert("Delete failed", error?.message ?? "Failed to delete surcharge.");
          }
        },
      },
    ]);
  }

  function toggleSurcharge(type: string) {
    setSelectedSurcharges((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  }

  const tourStep = PRICING_TOUR_STEPS[tourStepIndex];

  return (
    <Screen padded={false}>
      <View style={styles.page}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Pricing</Text>
            <Text style={styles.heroSub}>
              Build custom pricing templates, matrix grids, item libraries, and surcharges by industry.
            </Text>
          </View>

          <View style={styles.heroActions}>
            <GoldButton
              label="New Template"
              onPress={openTemplateModal}
              disabled={loading}
              style={{ minWidth: 170 }}
            />

            <Pressable
              onPress={() => {
                setTourStepIndex(0);
                setShowTourModal(true);
              }}
              style={({ pressed }) => [styles.secondaryBtn, pressed ? styles.pressed : null]}
            >
              <Text style={styles.secondaryBtnText}>Start Tour</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowHowItWorksModal(true)}
              style={({ pressed }) => [styles.secondaryBtn, pressed ? styles.pressed : null]}
            >
              <Text style={styles.secondaryBtnText}>How It Works</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.helpBar}>
          <View style={styles.helpBarLeft}>
            <Ionicons name="help-circle-outline" size={18} color={theme.colors.goldDark} />
            <Text style={styles.helpBarText}>Help Mode</Text>
          </View>

          <Switch
            value={helpMode}
            onValueChange={setHelpModeAndPersist}
            trackColor={{ false: "#E7DDC6", true: "#E7C55A" }}
            thumbColor={helpMode ? "#B8962E" : "#FFFFFF"}
          />
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
          <StatCard label="Templates" value={String(collectionCount)} sub="Custom price books" />
          <StatCard label="Items" value={String(fabricCount)} sub="Rows in selected template" />
          <StatCard label="Matrix Cells" value={String(matrixCount)} sub="Active group matrix" />
          <StatCard label="Surcharges" value={String(surchargeCount)} sub="Available add-ons" />
        </View>

        <SectionCard
          icon="layers-outline"
          title="Templates"
          sub="Each template can be customized for a different industry, workflow, and pricing method."
          right={
            helpMode ? (
              <Pressable onPress={() => setShowHowItWorksModal(true)} style={styles.inlineHelpBtn}>
                <Ionicons name="information-circle-outline" size={15} color={theme.colors.goldDark} />
                <Text style={styles.inlineHelpBtnText}>What is this?</Text>
              </Pressable>
            ) : null
          }
        >
          <HelpTip
            visible={helpMode}
            title="Templates explained"
            text="Templates are reusable pricing systems. You might make one for roller shades, one for flooring, one for service labor, or one for premium upgrades."
          />

          <View style={styles.filtersRow}>
            <View style={styles.field}>
              <Text style={styles.label}>Search</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search templates..."
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Industry</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                <ChoicePill label="All" active={industryFilter === "All"} onPress={() => setIndustryFilter("All")} />
                {INDUSTRY_OPTIONS.map((option) => (
                  <ChoicePill
                    key={option}
                    label={option}
                    active={industryFilter === option}
                    onPress={() => setIndustryFilter(option)}
                  />
                ))}
              </ScrollView>
            </View>
          </View>

          {!filteredCollections.length ? (
            <EmptyHelper
              visible
              title="No templates yet"
              body="Templates are your reusable pricing systems. Create one template for each service, product line, or industry workflow."
              buttonLabel="Create Template"
              onPress={openTemplateModal}
            />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.collectionRow}>
                {filteredCollections.map((item) => {
                  const active = selectedCollection?.id === item.id;

                  return (
                    <View key={item.id} style={[styles.collectionCard, active ? styles.collectionCardActive : null]}>
                      <Pressable onPress={() => setSelectedCollectionId(item.id)}>
                        <Text style={[styles.collectionName, active ? styles.collectionNameActive : null]}>
                          {item.name}
                        </Text>
                        <Text style={styles.collectionMeta}>{item.industry_type}</Text>
                        <Text style={styles.collectionMeta}>
                          {item.pricing_mode.toUpperCase()}
                          {item.is_default ? " • Default" : ""}
                        </Text>
                        {item.description ? (
                          <Text style={styles.collectionDesc}>{item.description}</Text>
                        ) : null}
                      </Pressable>

                      <View style={styles.collectionActions}>
                        {!item.is_default ? (
                          <Pressable
                            onPress={() => makeTemplateDefault(item.id)}
                            style={({ pressed }) => [styles.smallBtn, pressed ? styles.pressed : null]}
                          >
                            <Text style={styles.smallBtnText}>Set Default</Text>
                          </Pressable>
                        ) : null}

                        <Pressable
                          onPress={() => deleteTemplate(item)}
                          style={({ pressed }) => [styles.smallBtnDanger, pressed ? styles.pressed : null]}
                        >
                          <Text style={styles.smallBtnDangerText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </SectionCard>

        <View style={styles.tabRow}>
          <ChoicePill label="Calculator" active={tab === "calculator"} onPress={() => setTab("calculator")} />
          <ChoicePill label="Templates" active={tab === "templates"} onPress={() => setTab("templates")} />
          <ChoicePill label="Fabrics / Items" active={tab === "fabrics"} onPress={() => setTab("fabrics")} />
          <ChoicePill label="Matrices" active={tab === "matrices"} onPress={() => setTab("matrices")} />
          <ChoicePill label="Surcharges" active={tab === "surcharges"} onPress={() => setTab("surcharges")} />
        </View>

        {tab === "calculator" ? (
          <SectionCard
            icon="calculator-outline"
            title="Calculator"
            sub="Use your selected template to calculate pricing from matrix values and surcharges."
          >
            <HelpTip
              visible={helpMode}
              title="Calculator explained"
              text="The calculator previews the final price. It uses the selected item, its price group, your width and height, and any surcharges you enable."
            />

            {!selectedCollection ? (
              <EmptyHelper
                visible
                title="No template selected"
                body="Create a template first, then add items and matrix cells so the calculator has something to price."
                buttonLabel="Create Template"
                onPress={openTemplateModal}
              />
            ) : (
              <>
                <View style={styles.grid2}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Template</Text>
                    <View style={styles.selectLike}>
                      <Text style={styles.selectLikeText}>{selectedCollection.name}</Text>
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Fabric / Item</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.pillRow}
                    >
                      {visibleFabrics.map((item) => (
                        <ChoicePill
                          key={item.id}
                          label={`${item.fabric_style}${item.price_group ? ` (${item.price_group})` : ""}`}
                          active={(selectedFabric?.id ?? "") === item.id}
                          onPress={() => setSelectedFabricId(item.id)}
                        />
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Width</Text>
                    <TextInput
                      value={calcWidth}
                      onChangeText={(v) => setCalcWidth(cleanDecimal(v))}
                      placeholder="48"
                      placeholderTextColor={theme.colors.muted}
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Height</Text>
                    <TextInput
                      value={calcHeight}
                      onChangeText={(v) => setCalcHeight(cleanDecimal(v))}
                      placeholder="60"
                      placeholderTextColor={theme.colors.muted}
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>
                </View>

                {selectedFabric ? (
                  <View style={styles.fabricInfoCard}>
                    <Text style={styles.fabricInfoTitle}>{selectedFabric.fabric_style}</Text>
                    <Text style={styles.fabricInfoText}>Group: {selectedFabric.price_group || "—"}</Text>
                    <Text style={styles.fabricInfoText}>Width: {selectedFabric.fabric_width || "—"}</Text>
                    <Text style={styles.fabricInfoText}>FR: {yn(selectedFabric.fr)}</Text>
                    <Text style={styles.fabricInfoText}>Roller Shade: {yn(selectedFabric.roller_shade)}</Text>
                    <Text style={styles.fabricInfoText}>Panel Track: {yn(selectedFabric.panel_track)}</Text>
                    <Text style={styles.fabricInfoText}>
                      Multi Directional: {yn(selectedFabric.multi_directional)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.toggleWrap}>
                  <ToggleChip label="Add wrap allowance" value={wrapAdd} onPress={() => setWrapAdd((prev) => !prev)} />
                </View>

                <View style={styles.surchargePickerWrap}>
                  <Text style={styles.miniHeading}>Surcharges</Text>
                  <View style={styles.pillRow}>
                    {surchargeOptions.map((item) => (
                      <ChoicePill
                        key={item}
                        label={item}
                        active={selectedSurcharges.includes(item)}
                        onPress={() => toggleSurcharge(item)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.calculatorSummary}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Base Price</Text>
                    <Text style={styles.summaryValue}>{money(basePrice)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Surcharges</Text>
                    <Text style={styles.summaryValue}>{money(surchargeTotal)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Wrap</Text>
                    <Text style={styles.summaryValue}>{money(wrapCharge)}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                    <Text style={styles.summaryTotalLabel}>Total</Text>
                    <Text style={styles.summaryTotalValue}>{money(total)}</Text>
                  </View>
                </View>
              </>
            )}
          </SectionCard>
        ) : null}

        {tab === "templates" ? (
          <SectionCard
            icon="build-outline"
            title="Template Builder"
            sub="Create custom templates for any industry. Use different pricing modes for different business types."
          >
            <HelpTip
              visible={helpMode}
              title="Pricing modes"
              text="Matrix is best for width × height pricing. Unit works for sqft or each. Labor and material are great for contractor-style estimates. Formula and flat work for custom logic and fixed prices."
            />

            <View style={styles.infoGrid}>
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Matrix</Text>
                <Text style={styles.infoCardText}>Best for width × height price books and shade-style grids.</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Unit</Text>
                <Text style={styles.infoCardText}>Best for square foot, linear foot, each, or quantity pricing.</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Labor / Material</Text>
                <Text style={styles.infoCardText}>Best for contractor price books and service-based work orders.</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Formula / Flat</Text>
                <Text style={styles.infoCardText}>Best for custom calculations or one fixed rate per item.</Text>
              </View>
            </View>
          </SectionCard>
        ) : null}

        {tab === "fabrics" ? (
          <SectionCard
            icon="albums-outline"
            title="Fabrics / Items"
            sub="Build the item library for the selected template."
          >
            <HelpTip
              visible={helpMode}
              title="Items explained"
              text="Items or fabrics are the products you actually sell. A price group links an item to the correct matrix grid."
            />

            {!selectedCollection ? (
              <EmptyHelper
                visible
                title="No template selected"
                body="Create a template first. Then add items or fabrics that belong to that pricing system."
                buttonLabel="Create Template"
                onPress={openTemplateModal}
              />
            ) : (
              <>
                <View style={styles.inlineActions}>
                  <GoldButton
                    label="Add Item"
                    onPress={openFabricModal}
                    disabled={!selectedCollection}
                    style={{ minWidth: 150 }}
                  />
                </View>

                {!visibleFabrics.length ? (
                  <EmptyHelper
                    visible
                    title="No items yet"
                    body="Add items or fabrics here. Each one can have a price group, width, and feature settings."
                    buttonLabel="Add Item"
                    onPress={openFabricModal}
                  />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.table}>
                      <View style={styles.tableHead}>
                        <Text style={[styles.th, styles.colFabric]}>Item / Fabric</Text>
                        <Text style={[styles.th, styles.colSmall]}>Group</Text>
                        <Text style={[styles.th, styles.colSmall]}>Width</Text>
                        <Text style={[styles.th, styles.colTiny]}>FR</Text>
                        <Text style={[styles.th, styles.colSmall]}>Roller</Text>
                        <Text style={[styles.th, styles.colSmall]}>Panel</Text>
                        <Text style={[styles.th, styles.colSmall]}>Multi</Text>
                        <Text style={[styles.th, styles.colAction]}>Actions</Text>
                      </View>

                      {visibleFabrics.map((item, index) => (
                        <View
                          key={item.id}
                          style={[
                            styles.tr,
                            index % 2 === 0 ? styles.trStriped : null,
                            selectedFabric?.id === item.id ? styles.trActive : null,
                          ]}
                        >
                          <Pressable
                            onPress={() => {
                              setSelectedFabricId(item.id);
                              setTab("calculator");
                            }}
                            style={styles.rowMain}
                          >
                            <Text style={[styles.td, styles.colFabric]}>{item.fabric_style}</Text>
                            <Text style={[styles.td, styles.colSmall]}>{item.price_group || "—"}</Text>
                            <Text style={[styles.td, styles.colSmall]}>{item.fabric_width || "—"}</Text>
                            <Text style={[styles.td, styles.colTiny]}>{yn(item.fr)}</Text>
                            <Text style={[styles.td, styles.colSmall]}>{yn(item.roller_shade)}</Text>
                            <Text style={[styles.td, styles.colSmall]}>{yn(item.panel_track)}</Text>
                            <Text style={[styles.td, styles.colSmall]}>{yn(item.multi_directional)}</Text>
                          </Pressable>

                          <View style={styles.actionCell}>
                            <Pressable
                              onPress={() => deleteFabric(item)}
                              style={({ pressed }) => [styles.smallBtnDanger, pressed ? styles.pressed : null]}
                            >
                              <Text style={styles.smallBtnDangerText}>Delete</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </>
            )}
          </SectionCard>
        ) : null}

        {tab === "matrices" ? (
          <SectionCard
            icon="grid-outline"
            title={selectedGroup ? `Matrix • Group ${selectedGroup}` : "Matrix Builder"}
            sub="Build your width × height pricing cells for each price group."
          >
            <HelpTip
              visible={helpMode}
              title="Matrix cells explained"
              text="Width To and Height To mean the maximum size this price applies to. The calculator finds the first matching size that is large enough."
            />

            {!selectedCollection ? (
              <EmptyHelper
                visible
                title="No template selected"
                body="Create a template first. Then add matrix cells for widths, heights, and prices."
                buttonLabel="Create Template"
                onPress={openTemplateModal}
              />
            ) : (
              <>
                <View style={styles.inlineActions}>
                  <GoldButton
                    label="Add Matrix Cell"
                    onPress={openMatrixModal}
                    disabled={!selectedCollection}
                    style={{ minWidth: 170 }}
                  />
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  {matrixGroups.map((group) => (
                    <ChoicePill
                      key={group}
                      label={`Group ${group}`}
                      active={selectedGroup === group}
                      onPress={() => {
                        const firstMatching = visibleFabrics.find(
                          (item) => item.price_group.trim().toUpperCase() === group
                        );
                        if (firstMatching) setSelectedFabricId(firstMatching.id);
                      }}
                    />
                  ))}
                </ScrollView>

                {currentMatrix.length === 0 ? (
                  <EmptyHelper
                    visible
                    title="No matrix cells yet"
                    body="Start by adding a price group, then enter widths, heights, and prices. This is what powers matrix-based pricing."
                    buttonLabel="Add Matrix Cell"
                    onPress={openMatrixModal}
                  />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.matrixTable}>
                      <View style={styles.matrixHeadRow}>
                        <Text style={[styles.matrixHeadCell, styles.matrixStubCell]}>Height / Width</Text>
                        {matrixWidths.map((width) => (
                          <Text key={`w-${width}`} style={styles.matrixHeadCell}>
                            {width}"
                          </Text>
                        ))}
                      </View>

                      {matrixHeights.map((height) => (
                        <View key={`h-${height}`} style={styles.matrixBodyRow}>
                          <Text style={[styles.matrixBodyCell, styles.matrixStubCell]}>{height}"</Text>

                          {matrixWidths.map((width) => {
                            const match = currentMatrix.find(
                              (item) => item.width_to === width && item.height_to === height
                            );

                            const active =
                              width >= widthNumber &&
                              height >= heightNumber &&
                              Number(match?.price || 0) === basePrice;

                            return (
                              <View
                                key={`${width}-${height}`}
                                style={[styles.matrixBodyCell, active ? styles.matrixBodyCellActive : null]}
                              >
                                <Text style={[styles.matrixBodyText, active ? styles.matrixBodyTextActive : null]}>
                                  {match ? money(match.price) : "—"}
                                </Text>

                                {match ? (
                                  <Pressable
                                    onPress={() => deleteMatrixCell(match)}
                                    style={({ pressed }) => [styles.deleteInlineBtn, pressed ? styles.pressed : null]}
                                  >
                                    <Text style={styles.deleteInlineBtnText}>×</Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </>
            )}
          </SectionCard>
        ) : null}

        {tab === "surcharges" ? (
          <SectionCard
            icon="add-circle-outline"
            title="Surcharges"
            sub="Add optional pricing for hems, fascia, freight, rush, trim, or any custom add-on."
          >
            <HelpTip
              visible={helpMode}
              title="Surcharges explained"
              text="Surcharges are add-ons that stack on top of the base matrix price. They can be size-based or feature-based."
            />

            {!selectedCollection ? (
              <EmptyHelper
                visible
                title="No template selected"
                body="Create a template first. Then add surcharges for upgrades, rush fees, trim, freight, or other options."
                buttonLabel="Create Template"
                onPress={openTemplateModal}
              />
            ) : (
              <>
                <View style={styles.inlineActions}>
                  <GoldButton
                    label="Add Surcharge"
                    onPress={openSurchargeModal}
                    disabled={!selectedCollection}
                    style={{ minWidth: 170 }}
                  />
                </View>

                {groupedSurcharges.length === 0 ? (
                  <EmptyHelper
                    visible
                    title="No surcharges yet"
                    body="Add surcharge rows to make your pricing more complete. Common examples are decorative hems, fascia, freight, rush fees, and installation upgrades."
                    buttonLabel="Add Surcharge"
                    onPress={openSurchargeModal}
                  />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.table}>
                      <View style={styles.tableHead}>
                        <Text style={[styles.th, styles.colSurchargeName]}>Surcharge</Text>
                        <Text style={[styles.th, styles.colSmall]}>Width To</Text>
                        <Text style={[styles.th, styles.colSmall]}>Price</Text>
                        <Text style={[styles.th, styles.colAction]}>Actions</Text>
                      </View>

                      {groupedSurcharges.flatMap((group) =>
                        group.rows.map((row, index) => (
                          <View
                            key={row.id}
                            style={[
                              styles.tr,
                              index % 2 === 0 ? styles.trStriped : null,
                              selectedSurcharges.includes(group.name) ? styles.trActiveSoft : null,
                            ]}
                          >
                            <View style={styles.rowMain}>
                              <Text style={[styles.td, styles.colSurchargeName]}>{group.name}</Text>
                              <Text style={[styles.td, styles.colSmall]}>{row.width_to}"</Text>
                              <Text style={[styles.td, styles.colSmall]}>{money(row.price)}</Text>
                            </View>

                            <View style={styles.actionCell}>
                              <Pressable
                                onPress={() => deleteSurcharge(row)}
                                style={({ pressed }) => [styles.smallBtnDanger, pressed ? styles.pressed : null]}
                              >
                                <Text style={styles.smallBtnDangerText}>Delete</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  </ScrollView>
                )}
              </>
            )}
          </SectionCard>
        ) : null}

        <Modal visible={showTemplateModal} transparent animationType="fade" onRequestClose={() => setShowTemplateModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTop}>
                <Text style={styles.modalTitle}>New Template</Text>
                <Pressable onPress={() => setShowTemplateModal(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </View>

              <HelpTip
                visible={helpMode}
                title="Template form"
                text="Start simple. Pick an industry, choose a pricing mode, and decide whether this should be the default template for your team."
              />

              <View style={styles.grid2}>
                <View style={styles.field}>
                  <Text style={styles.label}>Template Name</Text>
                  <TextInput
                    value={templateForm.name}
                    onChangeText={(v) => setTemplateField("name", v)}
                    placeholder="Roller Shades 2026"
                    placeholderTextColor={theme.colors.muted}
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    value={templateForm.description}
                    onChangeText={(v) => setTemplateField("description", v)}
                    placeholder="Custom price book for shades"
                    placeholderTextColor={theme.colors.muted}
                    style={styles.input}
                  />
                </View>
              </View>

              <Text style={styles.label}>Industry</Text>
              <View style={styles.pillRow}>
                {INDUSTRY_OPTIONS.map((option) => (
                  <ChoicePill
                    key={option}
                    label={option}
                    active={templateForm.industry_type === option}
                    onPress={() => setTemplateField("industry_type", option)}
                  />
                ))}
              </View>

              <Text style={styles.label}>Pricing Mode</Text>
              <View style={styles.pillRow}>
                {PRICING_MODE_OPTIONS.map((option) => (
                  <ChoicePill
                    key={option}
                    label={option.toUpperCase()}
                    active={templateForm.pricing_mode === option}
                    onPress={() => setTemplateField("pricing_mode", option)}
                  />
                ))}
              </View>

              <View style={styles.toggleWrap}>
                <ToggleChip
                  label="Set as default"
                  value={templateForm.is_default}
                  onPress={() => setTemplateField("is_default", !templateForm.is_default)}
                />
              </View>

              <View style={styles.modalActions}>
                <GoldButton
                  label={savingTemplate ? "Saving..." : "Create Template"}
                  onPress={saveTemplate}
                  disabled={savingTemplate}
                  style={{ minWidth: 180 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showFabricModal} transparent animationType="fade" onRequestClose={() => setShowFabricModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTop}>
                <Text style={styles.modalTitle}>Add Item / Fabric</Text>
                <Pressable onPress={() => setShowFabricModal(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </View>

              <HelpTip
                visible={helpMode}
                title="Price Group"
                text="Price Group is the link between an item and a matrix table. If an item is in Group B, the calculator looks in Group B for size-based pricing."
              />

              <View style={styles.grid2}>
                <View style={styles.field}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    value={fabricForm.fabric_style}
                    onChangeText={(v) => setFabricField("fabric_style", v)}
                    placeholder="Bali Linen"
                    placeholderTextColor={theme.colors.muted}
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Price Group</Text>
                  <TextInput
                    value={fabricForm.price_group}
                    onChangeText={(v) => setFabricField("price_group", v.toUpperCase())}
                    placeholder="A"
                    placeholderTextColor={theme.colors.muted}
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Width</Text>
                  <TextInput
                    value={fabricForm.fabric_width}
                    onChangeText={(v) => setFabricField("fabric_width", v)}
                    placeholder='86"'
                    placeholderTextColor={theme.colors.muted}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.pillRow}>
                <ToggleChip label="FR" value={fabricForm.fr} onPress={() => setFabricField("fr", !fabricForm.fr)} />
                <ToggleChip
                  label="Roller Shade"
                  value={fabricForm.roller_shade}
                  onPress={() => setFabricField("roller_shade", !fabricForm.roller_shade)}
                />
                <ToggleChip
                  label="Panel Track"
                  value={fabricForm.panel_track}
                  onPress={() => setFabricField("panel_track", !fabricForm.panel_track)}
                />
                <ToggleChip
                  label="Multi Directional"
                  value={fabricForm.multi_directional}
                  onPress={() => setFabricField("multi_directional", !fabricForm.multi_directional)}
                />
              </View>

              <View style={styles.modalActions}>
                <GoldButton
                  label={savingFabric ? "Saving..." : "Add Item"}
                  onPress={saveFabric}
                  disabled={savingFabric}
                  style={{ minWidth: 180 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showMatrixModal} transparent animationType="fade" onRequestClose={() => setShowMatrixModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTop}>
                <Text style={styles.modalTitle}>Add Matrix Cell</Text>
                <Pressable onPress={() => setShowMatrixModal(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </View>

              <HelpTip
                visible={helpMode}
                title="Width To / Height To"
                text="These values mean the maximum size this price applies to. Example: Width To 48 and Height To 60 means up to 48 by 60."
              />

              <View style={styles.grid2}>
                <View style={styles.field}>
                  <Text style={styles.label}>Price Group</Text>
                  <TextInput
                    value={matrixForm.price_group}
                    onChangeText={(v) => setMatrixField("price_group", v.toUpperCase())}
                    placeholder="A"
                    placeholderTextColor={theme.colors.muted}
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Width To</Text>
                  <TextInput
                    value={matrixForm.width_to}
                    onChangeText={(v) => setMatrixField("width_to", cleanWholeNumber(v))}
                    placeholder="48"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Height To</Text>
                  <TextInput
                    value={matrixForm.height_to}
                    onChangeText={(v) => setMatrixField("height_to", cleanWholeNumber(v))}
                    placeholder="60"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Price</Text>
                  <TextInput
                    value={matrixForm.price}
                    onChangeText={(v) => setMatrixField("price", cleanDecimal(v))}
                    placeholder="199"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <GoldButton
                  label={savingMatrix ? "Saving..." : "Add Matrix Cell"}
                  onPress={saveMatrixCell}
                  disabled={savingMatrix}
                  style={{ minWidth: 180 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showSurchargeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSurchargeModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTop}>
                <Text style={styles.modalTitle}>Add Surcharge</Text>
                <Pressable onPress={() => setShowSurchargeModal(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </View>

              <HelpTip
                visible={helpMode}
                title="Surcharge rows"
                text="Use surcharge rows for upgrades and optional add-ons. You can make them size-based by setting Width To."
              />

              <View style={styles.grid2}>
                <View style={styles.field}>
                  <Text style={styles.label}>Surcharge Name</Text>
                  <TextInput
                    value={surchargeForm.surcharge_type}
                    onChangeText={(v) => setSurchargeField("surcharge_type", v)}
                    placeholder="Decorative Hem A"
                    placeholderTextColor={theme.colors.muted}
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Width To</Text>
                  <TextInput
                    value={surchargeForm.width_to}
                    onChangeText={(v) => setSurchargeField("width_to", cleanWholeNumber(v))}
                    placeholder="72"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Price</Text>
                  <TextInput
                    value={surchargeForm.price}
                    onChangeText={(v) => setSurchargeField("price", cleanDecimal(v))}
                    placeholder="88"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <GoldButton
                  label={savingSurcharge ? "Saving..." : "Add Surcharge"}
                  onPress={saveSurcharge}
                  disabled={savingSurcharge}
                  style={{ minWidth: 180 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showHowItWorksModal} transparent animationType="fade" onRequestClose={() => setShowHowItWorksModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { maxWidth: 900 }]}>
              <View style={styles.modalTop}>
                <Text style={styles.modalTitle}>How Pricing Works</Text>
                <Pressable onPress={() => setShowHowItWorksModal(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </View>

              <View style={styles.helpStepsWrap}>
                <View style={styles.helpStepCard}>
                  <Text style={styles.helpStepTitle}>1. Create a template</Text>
                  <Text style={styles.helpStepText}>
                    Make a reusable pricing system for one industry, service line, or product category.
                  </Text>
                </View>

                <View style={styles.helpStepCard}>
                  <Text style={styles.helpStepTitle}>2. Add items or fabrics</Text>
                  <Text style={styles.helpStepText}>
                    Add the products you sell. Assign a price group so each item knows which matrix to use.
                  </Text>
                </View>

                <View style={styles.helpStepCard}>
                  <Text style={styles.helpStepTitle}>3. Build matrix cells</Text>
                  <Text style={styles.helpStepText}>
                    Add width and height breakpoints with prices. These are the core size-based prices.
                  </Text>
                </View>

                <View style={styles.helpStepCard}>
                  <Text style={styles.helpStepTitle}>4. Add surcharges</Text>
                  <Text style={styles.helpStepText}>
                    Add upgrades or optional add-ons like freight, fascia, trim, rush fees, labor packages, or accessories.
                  </Text>
                </View>

                <View style={styles.helpStepCard}>
                  <Text style={styles.helpStepTitle}>5. Test in the calculator</Text>
                  <Text style={styles.helpStepText}>
                    Choose an item, enter dimensions, select surcharges, and verify the total looks correct.
                  </Text>
                </View>

                <View style={styles.helpStepCard}>
                  <Text style={styles.helpStepTitle}>6. Use in work orders</Text>
                  <Text style={styles.helpStepText}>
                    After the pricing structure is built, this can feed your work orders so pricing becomes faster and more consistent.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showTourModal} transparent animationType="fade" onRequestClose={() => setShowTourModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { maxWidth: 760 }]}>
              <View style={styles.modalTop}>
                <Text style={styles.modalTitle}>Pricing Tour</Text>
                <Pressable onPress={completeTour} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>Skip</Text>
                </Pressable>
              </View>

              <View style={styles.tourProgressWrap}>
                {PRICING_TOUR_STEPS.map((_, index) => (
                  <View
                    key={`tour-${index}`}
                    style={[styles.tourDot, index === tourStepIndex ? styles.tourDotActive : null]}
                  />
                ))}
              </View>

              <View style={styles.tourCard}>
                <Text style={styles.tourTitle}>{tourStep.title}</Text>
                <Text style={styles.tourBody}>{tourStep.body}</Text>
              </View>

              <View style={styles.modalActionsSpread}>
                <Pressable
                  onPress={() => setTourStepIndex((prev) => Math.max(0, prev - 1))}
                  disabled={tourStepIndex === 0}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    tourStepIndex === 0 ? styles.disabledBtn : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </Pressable>

                {tourStepIndex < PRICING_TOUR_STEPS.length - 1 ? (
                  <GoldButton
                    label="Next"
                    onPress={() => setTourStepIndex((prev) => Math.min(PRICING_TOUR_STEPS.length - 1, prev + 1))}
                    style={{ minWidth: 150 }}
                  />
                ) : (
                  <GoldButton label="Finish Tour" onPress={completeTour} style={{ minWidth: 150 }} />
                )}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}


const PAGE_BG = "#FFFFFF";
const CARD_BG = "#fffdf8";
const BORDER = "#e4d6b2";
const BORDER_SOFT = "#dcc89a";
const GOLD = "#c9a227";
const GOLD_BRIGHT = "#d4af37";
const TEXT = "#111111";
const MUTED = "#6f6a63";
const MUTED_2 = "#7b746b";
const DARK_CARD = "#111111";
const DARK_BORDER = "rgba(212, 175, 55, 0.35)";


const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: 24,
    gap: 16,
    backgroundColor: PAGE_BG,
  },

  hero: {
    marginBottom: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
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

  heroTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  heroSub: {
    marginTop: 6,
    color: "rgba(255,255,255,0.76)",
    fontSize: 14,
    fontWeight: "700",
  },

  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  helpBar: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  helpBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  helpBarText: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  sectionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
  },

  sectionTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 260,
  },

  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(212, 175, 55, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  sectionSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  sectionBody: {
    gap: 14,
  },

  inlineHelpBtn: {
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },

  inlineHelpBtnText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 12,
  },

  helpTip: {
    borderWidth: 1,
    borderColor: "#ECD189",
    backgroundColor: "#FFF8E8",
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },

  helpTipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  helpTipTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.goldDark,
  },

  helpTipText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: theme.colors.ink,
  },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  statCard: {
    flexGrow: 1,
    minWidth: 180,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    padding: 16,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.mutedSoft,
  },

  statValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  statSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  filtersRow: {
    gap: 12,
  },

  field: {
    flex: 1,
    minWidth: 220,
  },

  grid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  label: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.mutedSoft,
    letterSpacing: 0.2,
  },

  miniHeading: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.mutedSoft,
    letterSpacing: 0.2,
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.ink,
    backgroundColor: CARD_BG
  },

  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  pill: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    alignItems: "center",
    justifyContent: "center",
  },

  pillActive: {
    backgroundColor: "#F5E6B8",
    borderColor: GOLD,
  },

  pillText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 12.5,
  },

  pillTextActive: {
    color: theme.colors.goldDark,
  },

  collectionRow: {
    flexDirection: "row",
    gap: 12,
  },

  collectionCard: {
    width: 260,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    backgroundColor: CARD_BG,
    padding: 16,
    gap: 8,
  },

  collectionCardActive: {
    borderColor: GOLD,
    backgroundColor: "rgba(212, 175, 55, 0.14)",
  },

  collectionName: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  collectionNameActive: {
    color: theme.colors.goldDark,
  },

  collectionMeta: {
    fontSize: 12.5,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  collectionDesc: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
    color: theme.colors.ink,
  },

  collectionActions: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  infoCard: {
    flexGrow: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    backgroundColor: CARD_BG,
    padding: 16,
  },

  infoCardTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  infoCardText: {
    marginTop: 8,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  selectLike: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: "#FFFCF6",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  selectLikeText: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.ink,
  },

  fabricInfoCard: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },

  fabricInfoTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  fabricInfoText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  toggleWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  toggleChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  toggleChipActive: {
    backgroundColor: "#F5E6B8",
    borderColor: GOLD,
  },

  toggleChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.ink,
  },

  toggleChipTextActive: {
    color: theme.colors.goldDark,
  },

  surchargePickerWrap: {
    gap: 10,
  },

  calculatorSummary: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    backgroundColor: "#111111",
    padding: 16,
    gap: 10,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  summaryLabel: {
    color: "#E8DFC7",
    fontSize: 14,
    fontWeight: "700",
  },

  summaryValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  summaryRowTotal: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },

  summaryTotalLabel: {
    color: "#D4AF37",
    fontSize: 15,
    fontWeight: "900",
  },

  summaryTotalValue: {
    color: "#D4AF37",
    fontSize: 20,
    fontWeight: "900",
  },

  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  table: {
    minWidth: 1060,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: CARD_BG
  },

  tableHead: {
    flexDirection: "row",
    backgroundColor: "#FFF4D6",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  th: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  tr: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: "#F2EBDA",
  },

  trStriped: {
    backgroundColor: CARD_BG
  },

  trActive: {
    backgroundColor: "#FFF4D6",
  },

  trActiveSoft: {
    backgroundColor: "#FFFBF1",
  },

  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  td: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.ink,
  },

  actionCell: {
    width: 110,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyRow: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  emptyText: {
    color: theme.colors.muted,
    fontWeight: "700",
  },

  emptyCard: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 18,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  emptySub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  colFabric: {
    width: 260,
  },

  colSmall: {
    width: 140,
  },

  colTiny: {
    width: 90,
  },

  colSurchargeName: {
    width: 280,
  },

  colAction: {
    width: 110,
  },

  matrixTable: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: CARD_BG
  },

  matrixHeadRow: {
    flexDirection: "row",
    backgroundColor: "#FFF4D6",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  matrixBodyRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F2EBDA",
  },

  matrixHeadCell: {
    width: 110,
    minHeight: 48,
    textAlign: "center",
    textAlignVertical: "center",
    paddingHorizontal: 8,
    paddingVertical: 14,
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.ink,
    borderRightWidth: 1,
    borderRightColor: "#F2EBDA",
  },

  matrixBodyCell: {
    width: 110,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#F2EBDA",
    paddingHorizontal: 8,
    paddingVertical: 10,
    position: "relative",
  },

  matrixStubCell: {
    width: 132,
    backgroundColor: "#FFFCF6",
  },

  matrixBodyCellActive: {
    backgroundColor: "#F5E6B8",
  },

  matrixBodyText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: theme.colors.ink,
  },

  matrixBodyTextActive: {
    color: theme.colors.goldDark,
  },

  deleteInlineBtn: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteInlineBtnText: {
    color: "#b91c1c",
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 11,
  },

  secondaryBtn: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  secondaryBtnText: {
    color: theme.colors.ink,
    fontWeight: "900",
    fontSize: 14,
  },

  disabledBtn: {
    opacity: 0.5,
  },

  smallBtn: {
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  smallBtnText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 12,
  },

  smallBtnDanger: {
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  smallBtnDangerText: {
    color: "#b91c1c",
    fontWeight: "800",
    fontSize: 12,
  },

  bannerError: {
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
    backgroundColor: "rgba(17,17,17,0.32)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    width: "100%",
    maxWidth: 860,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    padding: 18,
    gap: 14,
  },

  modalTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  closeBtn: {
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  closeBtnText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 12,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  modalActionsSpread: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  helpStepsWrap: {
    gap: 10,
  },

  helpStepCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    padding: 14,
  },

  helpStepTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  helpStepText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  tourProgressWrap: {
    flexDirection: "row",
    gap: 8,
  },

  tourDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E8DFC7",
  },

  tourDotActive: {
    backgroundColor: "#D4AF37",
  },

  tourCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    backgroundColor: CARD_BG,
    padding: 18,
  },

  tourTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  tourBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  pressed: {
    opacity: 0.9,
  },
});