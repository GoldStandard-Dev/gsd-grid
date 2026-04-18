import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Print from "expo-print";
import Screen from "../../../src/components/Screen";
import { AppPage, ContentCard, PageHeader, SummaryCard, SummaryStrip } from "../../../src/components/AppPage";
import EmptyState from "../../../src/components/EmptyState";
import { getUserOrgId } from "../../../src/lib/auth";
import { logActivity } from "../../../src/lib/activity";
import { cleanDecimalInput, formatCurrencyDisplay, formatInvoiceNumber, formatPercentDisplay } from "../../../src/lib/format";
import { supabase } from "../../../src/lib/supabase";
import { theme } from "../../../src/theme/theme";

type InvoiceStatus = "draft" | "sent" | "unpaid" | "partial" | "overdue" | "paid" | "void";

type InvoiceDetail = {
  id: string;
  org_id: string;
  client_id: string | null;
  invoice_number: number | null;
  client_name: string | null;
  bill_to: string | null;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  subtotal: number;
  tax: number;
  total: number;
  deposit: number;
  balance_due: number;
  notes: string | null;
};

type InvoiceItem = {
  id: string;
  sort_order: number;
  qty: number;
  unit: string | null;
  item: string | null;
  description: string | null;
  unit_price: number;
};

type InvoicePayment = {
  id: string;
  amount: number;
  payment_date: string;
  method: string | null;
  note: string | null;
};

const STATUS_OPTIONS: InvoiceStatus[] = ["draft", "sent", "unpaid", "partial", "overdue", "paid", "void"];

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function inferTaxRate(taxAmount: number, subtotalAmount: number) {
  if (!subtotalAmount || !Number.isFinite(subtotalAmount)) return "";
  const rate = (Number(taxAmount || 0) / subtotalAmount) * 100;
  return rate ? formatPercentDisplay(rate.toFixed(3)) : "";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function statusLabel(status: InvoiceStatus) {
  return status.replace(/_/g, " ");
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; created?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const createdParam = Array.isArray(params.created) ? params.created[0] : params.created;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [clientName, setClientName] = useState("");
  const [billTo, setBillTo] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [tax, setTax] = useState("");
  const [deposit, setDeposit] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [showCreatedConfirmation, setShowCreatedConfirmation] = useState(false);

  useEffect(() => {
    void loadInvoice();
  }, [id]);

  useEffect(() => {
    if (createdParam === "1") setShowCreatedConfirmation(true);
  }, [createdParam]);

  const subtotalValue = Number(cleanDecimalInput(subtotal) || "0");
  const taxRateValue = Number(cleanDecimalInput(tax) || "0");
  const depositValue = Number(cleanDecimalInput(deposit) || "0");
  const lineItemSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.qty || 1) * Number(item.unit_price || 0), 0),
    [items]
  );
  const paymentTotal = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments]
  );
  const calculatedSubtotal = items.length ? lineItemSubtotal : subtotalValue;
  const taxValue = (calculatedSubtotal * taxRateValue) / 100;
  const total = calculatedSubtotal + taxValue;
  const totalApplied = depositValue + paymentTotal;
  const balanceDue = Math.max(total - totalApplied, 0);

  async function resolveUser() {
    const { data: auth, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);

    const resolvedUserId = auth.user?.id;
    if (!resolvedUserId) throw new Error("No authenticated user found.");

    const orgId = await getUserOrgId(resolvedUserId);
    if (!orgId) throw new Error("Could not determine the active organization.");

    setUserId(resolvedUserId);
    return { orgId, resolvedUserId };
  }

  async function fetchNextInvoiceNumber(activeOrgId: string) {
    const { data, error } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("org_id", activeOrgId)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return Number(data?.invoice_number ?? 0) + 1;
  }

  async function loadInvoice() {
    if (!id) return;
    setLoading(true);

    try {
      const { orgId } = await resolveUser();

      let invoiceRes = await supabase
        .from("invoices")
        .select("id, org_id, client_id, invoice_number, client_name, bill_to, status, issue_date, due_date, subtotal, tax, total, deposit, balance_due, notes")
        .eq("id", id)
        .maybeSingle();

      if (invoiceRes.error) {
        invoiceRes = await supabase
          .from("invoices")
          .select("id, org_id, invoice_number, client_name, bill_to, status, issue_date, due_date, subtotal, tax, total, deposit, balance_due, notes")
          .eq("id", id)
          .maybeSingle();
      }

      if (invoiceRes.error) throw new Error(invoiceRes.error.message);
      if (!invoiceRes.data) throw new Error("Invoice not found.");

      const row = invoiceRes.data as any;
      if (row.org_id !== orgId) throw new Error("Invoice not found.");
      const nextInvoice: InvoiceDetail = {
        id: row.id,
        org_id: row.org_id,
        client_id: row.client_id ?? null,
        invoice_number: row.invoice_number ?? null,
        client_name: row.client_name ?? null,
        bill_to: row.bill_to ?? null,
        status: (row.status ?? "draft") as InvoiceStatus,
        issue_date: row.issue_date ?? null,
        due_date: row.due_date ?? null,
        subtotal: Number(row.subtotal ?? 0),
        tax: Number(row.tax ?? 0),
        total: Number(row.total ?? 0),
        deposit: Number(row.deposit ?? 0),
        balance_due: Number(row.balance_due ?? 0),
        notes: row.notes ?? null,
      };

      setInvoice(nextInvoice);
      setClientName(nextInvoice.client_name ?? "");
      setBillTo(nextInvoice.bill_to ?? nextInvoice.client_name ?? "");
      setStatus(nextInvoice.status);
      setIssueDate(nextInvoice.issue_date ?? "");
      setDueDate(nextInvoice.due_date ?? "");
      setSubtotal(formatCurrencyDisplay(String(nextInvoice.subtotal || "")));
      setTax(inferTaxRate(nextInvoice.tax, nextInvoice.subtotal));
      setDeposit(formatCurrencyDisplay(String(nextInvoice.deposit || "")));
      setNotes(nextInvoice.notes ?? "");

      const itemsRes = await supabase
        .from("invoice_items")
        .select("id, sort_order, qty, unit, item, description, unit_price")
        .eq("invoice_id", id)
        .order("sort_order", { ascending: true });

      if (!itemsRes.error) {
        setItems((itemsRes.data ?? []).map((item: any) => ({
          id: item.id,
          sort_order: item.sort_order ?? 0,
          qty: Number(item.qty ?? 1),
          unit: item.unit ?? null,
          item: item.item ?? null,
          description: item.description ?? null,
          unit_price: Number(item.unit_price ?? 0),
        })));
      }

      const paymentsRes = await supabase
        .from("invoice_payments")
        .select("id, amount, payment_date, method, note")
        .eq("invoice_id", id)
        .order("payment_date", { ascending: false });

      if (!paymentsRes.error) {
        setPayments((paymentsRes.data ?? []).map((payment: any) => ({
          id: payment.id,
          amount: Number(payment.amount ?? 0),
          payment_date: payment.payment_date ?? "",
          method: payment.method ?? null,
          note: payment.note ?? null,
        })));
      }
    } catch (error: any) {
      Alert.alert("Load failed", error?.message ?? "Failed to load invoice.");
    } finally {
      setLoading(false);
    }
  }

  async function saveInvoice() {
    if (!invoice || saving) return;

    try {
      setSaving(true);
      const existingItems = items.filter((item) => !item.id.startsWith("temp-"));
      const newItems = items.filter((item) => item.id.startsWith("temp-"));
      const normalizedStatus: InvoiceStatus =
        status === "void" ? "void" : balanceDue <= 0 && total > 0 ? "paid" : paymentTotal > 0 ? "partial" : status;
      const { error } = await supabase
        .from("invoices")
        .update({
          client_name: clientName.trim() || null,
          bill_to: billTo.trim() || clientName.trim() || null,
          status: normalizedStatus,
          issue_date: issueDate || null,
          due_date: dueDate || null,
          subtotal: calculatedSubtotal,
          tax: taxValue,
          total,
          deposit: depositValue,
          balance_due: balanceDue,
          notes: notes.trim() || null,
        })
        .eq("id", invoice.id)
        .eq("org_id", invoice.org_id);

      if (error) throw new Error(error.message);

      if (existingItems.length) {
        const updateRes = await supabase.from("invoice_items").upsert(
          existingItems.map((item, index) => ({
            id: item.id,
            org_id: invoice.org_id,
            invoice_id: invoice.id,
            sort_order: index,
            qty: Number(item.qty || 1),
            unit: item.unit?.trim() || null,
            item: item.item?.trim() || null,
            description: item.description?.trim() || null,
            unit_price: Number(item.unit_price || 0),
            taxable: true,
          })),
          { onConflict: "id" }
        );
        if (updateRes.error) throw new Error(updateRes.error.message);
      }

      if (newItems.length) {
        const insertRes = await supabase.from("invoice_items").insert(
          newItems.map((item, index) => ({
            org_id: invoice.org_id,
            invoice_id: invoice.id,
            sort_order: existingItems.length + index,
            qty: Number(item.qty || 1),
            unit: item.unit?.trim() || null,
            item: item.item?.trim() || null,
            description: item.description?.trim() || null,
            unit_price: Number(item.unit_price || 0),
            taxable: true,
          }))
        );
        if (insertRes.error) throw new Error(insertRes.error.message);
      }

      void logActivity(supabase, {
        org_id: invoice.org_id,
        actor_user_id: userId || null,
        actor_name: null,
        action: `updated invoice ${formatInvoiceNumber(invoice.invoice_number)}`,
        entity_type: "invoice",
        entity_id: invoice.id,
      });

      Alert.alert("Saved", "Invoice updated.");
      void loadInvoice();
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  }

  function setItemField(id: string, key: keyof InvoiceItem, value: string | number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  }

  function addLineItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        sort_order: prev.length,
        qty: 1,
        unit: "",
        item: "",
        description: "",
        unit_price: 0,
      },
    ]);
  }

  async function deleteLineItem(item: InvoiceItem) {
    if (!invoice) return;

    if (item.id.startsWith("temp-")) {
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      return;
    }

    try {
      const { error } = await supabase
        .from("invoice_items")
        .delete()
        .eq("id", item.id)
        .eq("invoice_id", invoice.id);

      if (error) throw new Error(error.message);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch (error: any) {
      Alert.alert("Delete failed", error?.message ?? "Failed to delete line item.");
    }
  }

  async function recordPayment() {
    if (!invoice || recordingPayment) return;

    const amount = Number(cleanDecimalInput(paymentAmount) || "0");
    if (amount <= 0) {
      Alert.alert("Payment needed", "Enter a payment amount greater than zero.");
      return;
    }

    try {
      setRecordingPayment(true);
      const paymentDate = new Date().toISOString().slice(0, 10);
      const nextBalance = Math.max(balanceDue - amount, 0);
      const nextStatus: InvoiceStatus = nextBalance <= 0 ? "paid" : "partial";

      const paymentRes = await supabase.from("invoice_payments").insert({
        org_id: invoice.org_id,
        invoice_id: invoice.id,
        amount,
        payment_date: paymentDate,
        method: paymentMethod.trim() || null,
        note: paymentNote.trim() || null,
      });

      if (paymentRes.error) throw new Error(paymentRes.error.message);

      const invoiceRes = await supabase
        .from("invoices")
        .update({
          balance_due: nextBalance,
          status: nextStatus,
        })
        .eq("id", invoice.id)
        .eq("org_id", invoice.org_id);

      if (invoiceRes.error) throw new Error(invoiceRes.error.message);

      void logActivity(supabase, {
        org_id: invoice.org_id,
        actor_user_id: userId || null,
        actor_name: null,
        action: `recorded ${money(amount)} payment on invoice ${formatInvoiceNumber(invoice.invoice_number)}`,
        entity_type: "invoice",
        entity_id: invoice.id,
      });

      setPaymentAmount("");
      setPaymentMethod("");
      setPaymentNote("");
      setStatus(nextStatus);
      void loadInvoice();
    } catch (error: any) {
      Alert.alert("Payment failed", error?.message ?? "Failed to record payment.");
    } finally {
      setRecordingPayment(false);
    }
  }

  async function quickUpdateStatus(nextStatus: InvoiceStatus) {
    if (!invoice || saving) return;

    try {
      setSaving(true);
      const nextBalanceDue = nextStatus === "paid" ? 0 : balanceDue;
      const autoPaymentAmount = nextStatus === "paid" ? balanceDue : 0;
      const paymentDate = new Date().toISOString().slice(0, 10);

      if (autoPaymentAmount > 0) {
        const paymentRes = await supabase.from("invoice_payments").insert({
          org_id: invoice.org_id,
          invoice_id: invoice.id,
          amount: autoPaymentAmount,
          payment_date: paymentDate,
          method: "Manual",
          note: "Marked paid from invoice header",
        });

        if (paymentRes.error) throw new Error(paymentRes.error.message);
      }

      const { error } = await supabase
        .from("invoices")
        .update({
          status: nextStatus,
          balance_due: nextBalanceDue,
        })
        .eq("id", invoice.id)
        .eq("org_id", invoice.org_id);

      if (error) throw new Error(error.message);

      void logActivity(supabase, {
        org_id: invoice.org_id,
        actor_user_id: userId || null,
        actor_name: null,
        action:
          autoPaymentAmount > 0
            ? `marked invoice ${formatInvoiceNumber(invoice.invoice_number)} paid and recorded ${money(autoPaymentAmount)} payment`
            : `marked invoice ${formatInvoiceNumber(invoice.invoice_number)} ${statusLabel(nextStatus)}`,
        entity_type: "invoice",
        entity_id: invoice.id,
      });

      setStatus(nextStatus);
      setInvoice((prev) => prev ? { ...prev, status: nextStatus, balance_due: nextBalanceDue } : prev);
      void loadInvoice();
    } catch (error: any) {
      Alert.alert("Status update failed", error?.message ?? "Failed to update invoice status.");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateInvoice() {
    if (!invoice || duplicating) return;

    try {
      setDuplicating(true);
      const nextInvoiceNumber = await fetchNextInvoiceNumber(invoice.org_id);
      const duplicateBalanceDue = Math.max(total - depositValue, 0);

      const invoiceRes = await supabase
        .from("invoices")
        .insert({
          org_id: invoice.org_id,
          client_id: invoice.client_id,
          invoice_number: nextInvoiceNumber,
          client_name: clientName.trim() || invoice.client_name,
          bill_to: billTo.trim() || clientName.trim() || invoice.bill_to,
          status: "draft",
          issue_date: new Date().toISOString().slice(0, 10),
          due_date: dueDate || null,
          subtotal: calculatedSubtotal,
          tax: taxValue,
          total,
          deposit: depositValue,
          balance_due: duplicateBalanceDue,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (invoiceRes.error || !invoiceRes.data?.id) {
        throw new Error(invoiceRes.error?.message ?? "Failed to duplicate invoice.");
      }

      const duplicateId = invoiceRes.data.id;
      if (items.length) {
        const itemsRes = await supabase.from("invoice_items").insert(
          items.map((item, index) => ({
            org_id: invoice.org_id,
            invoice_id: duplicateId,
            sort_order: index,
            qty: Number(item.qty || 1),
            unit: item.unit?.trim() || null,
            item: item.item?.trim() || null,
            description: item.description?.trim() || null,
            unit_price: Number(item.unit_price || 0),
            taxable: true,
          }))
        );

        if (itemsRes.error) throw new Error(itemsRes.error.message);
      }

      void logActivity(supabase, {
        org_id: invoice.org_id,
        actor_user_id: userId || null,
        actor_name: null,
        action: `duplicated invoice ${formatInvoiceNumber(invoice.invoice_number)} as ${formatInvoiceNumber(nextInvoiceNumber)}`,
        entity_type: "invoice",
        entity_id: duplicateId,
      });

      router.push(`/invoices/${duplicateId}`);
    } catch (error: any) {
      Alert.alert("Duplicate failed", error?.message ?? "Failed to duplicate invoice.");
    } finally {
      setDuplicating(false);
    }
  }

  function buildPdfHtml() {
    const rows = items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.item || item.unit || "Line item")}</td>
            <td>${escapeHtml(item.description || "")}</td>
            <td style="text-align:right;">${item.qty}</td>
            <td style="text-align:right;">${money(item.unit_price)}</td>
            <td style="text-align:right;">${money(item.qty * item.unit_price)}</td>
          </tr>`
      )
      .join("");

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; color:#0F172A; padding:28px; }
    .top { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; }
    .muted { color:#475569; font-size:12px; line-height:1.5; }
    h1 { margin:0; font-size:28px; }
    .card { border:1px solid #E2E8F0; border-radius:14px; padding:16px; margin-top:18px; }
    table { width:100%; border-collapse:collapse; margin-top:12px; }
    th, td { border-bottom:1px solid #E2E8F0; padding:9px 8px; font-size:12px; text-align:left; }
    th { background:#F8FAFC; color:#475569; text-transform:uppercase; letter-spacing:.04em; }
    .totals { width:320px; margin-left:auto; }
    .totals td { border:none; padding:5px 0; }
    .totals .value { text-align:right; font-weight:700; }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>Invoice ${formatInvoiceNumber(invoice?.invoice_number)}</h1>
      <div class="muted">Status: ${statusLabel(status)}</div>
    </div>
    <div style="text-align:right;" class="muted">
      Issue: ${formatDate(issueDate)}<br/>
      Due: ${formatDate(dueDate)}
    </div>
  </div>
  <div class="card">
    <strong>Bill To</strong>
    <div class="muted" style="margin-top:6px;">${escapeHtml(billTo || clientName || "No client")}</div>
  </div>
  <div class="card">
    <strong>Line Items</strong>
    <table>
      <thead><tr><th>Item</th><th>Description</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Total</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="muted">No line items.</td></tr>`}</tbody>
    </table>
    <table class="totals">
      <tr><td>Subtotal</td><td class="value">${money(calculatedSubtotal)}</td></tr>
      <tr><td>Tax (${taxRateValue.toFixed(2)}%)</td><td class="value">${money(taxValue)}</td></tr>
      <tr><td>Total</td><td class="value">${money(total)}</td></tr>
      <tr><td>Payments / Deposit</td><td class="value">${money(totalApplied)}</td></tr>
      <tr><td><strong>Balance Due</strong></td><td class="value"><strong>${money(balanceDue)}</strong></td></tr>
    </table>
  </div>
  ${notes ? `<div class="card"><strong>Notes</strong><div class="muted" style="margin-top:6px;">${escapeHtml(notes)}</div></div>` : ""}
</body>
</html>`;
  }

  async function exportPdf() {
    try {
      await Print.printAsync({ html: buildPdfHtml() });
    } catch (error: any) {
      Alert.alert("Export failed", error?.message ?? "Failed to export invoice PDF.");
    }
  }

  if (loading) {
    return (
      <Screen padded={false}>
        <AppPage>
          <ContentCard title="Invoice" subtitle="Loading invoice details.">
            <Text style={styles.mutedText}>Loading...</Text>
          </ContentCard>
        </AppPage>
      </Screen>
    );
  }

  if (!invoice) {
    return (
      <Screen padded={false}>
        <AppPage>
          <EmptyState
            icon="document-text-outline"
            title="Invoice not found"
            body="The invoice could not be loaded."
            actionLabel="Back to Invoices"
            onAction={() => router.push("/invoices")}
          />
        </AppPage>
      </Screen>
    );
  }

  const invoicePageActions = [
    { label: "Back", onPress: () => router.push("/invoices") },
    { label: duplicating ? "Duplicating..." : "Duplicate", onPress: () => void duplicateInvoice() },
    ...(status === "draft"
      ? [{ label: "Mark Sent", onPress: () => void quickUpdateStatus("sent") }]
      : []),
    ...(!["paid", "void"].includes(status)
      ? [{ label: "Mark Paid", onPress: () => void quickUpdateStatus("paid") }]
      : []),
    { label: "Export PDF", onPress: () => void exportPdf() },
    { label: saving ? "Saving..." : "Save", primary: true, onPress: () => void saveInvoice() },
  ];

  return (
    <Screen padded={false}>
      <AppPage>
        <PageHeader
          eyebrow="Billing"
          title={formatInvoiceNumber(invoice.invoice_number)}
          subtitle={`${clientName || "No client"} - ${statusLabel(status)}`}
          actions={invoicePageActions}
        />

        {showCreatedConfirmation ? (
          <View style={styles.createdBanner}>
            <View style={styles.createdIcon}>
              <Text style={styles.createdIconText}>OK</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.createdTitle}>Invoice created successfully</Text>
              <Text style={styles.createdSub}>
                {formatInvoiceNumber(invoice.invoice_number)} is ready for line items, payment details, and review.
              </Text>
            </View>
            <Pressable onPress={() => setShowCreatedConfirmation(false)} style={styles.createdDismiss}>
              <Text style={styles.createdDismissText}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}

        <SummaryStrip>
          <SummaryCard label="Total" value={money(total)} meta="Invoice total" />
          <SummaryCard label="Payments" value={money(totalApplied)} meta="Deposit plus payments" accent="lavender" />
          <SummaryCard label="Balance Due" value={money(balanceDue)} meta={`Due ${formatDate(dueDate)}`} accent="violet" />
        </SummaryStrip>

        <ContentCard title="Invoice details" subtitle="Edit status, billing info, dates, and totals.">
          <View style={styles.formStack}>
            <View style={styles.twoCol}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Client</Text>
                <TextInput value={clientName} onChangeText={setClientName} style={styles.input} />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Bill To</Text>
                <TextInput value={billTo} onChangeText={setBillTo} style={styles.input} />
              </View>
            </View>

            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setStatus(option)}
                  style={[styles.statusChip, status === option ? styles.statusChipActive : null]}
                >
                  <Text style={[styles.statusText, status === option ? styles.statusTextActive : null]}>
                    {statusLabel(option)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.twoCol}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Issue Date</Text>
                <TextInput value={issueDate} onChangeText={setIssueDate} style={styles.input} />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Due Date</Text>
                <TextInput value={dueDate} onChangeText={setDueDate} style={styles.input} />
              </View>
            </View>

            <View style={styles.threeCol}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Subtotal</Text>
                <TextInput value={subtotal} onChangeText={(value) => setSubtotal(formatCurrencyDisplay(value))} style={styles.input} />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Tax Rate %</Text>
                <TextInput
                  value={tax}
                  onChangeText={(value) => setTax(formatPercentDisplay(value))}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Deposit</Text>
                <TextInput value={deposit} onChangeText={(value) => setDeposit(formatCurrencyDisplay(value))} style={styles.input} />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput value={notes} onChangeText={setNotes} style={[styles.input, styles.notesInput]} multiline />
            </View>
          </View>
        </ContentCard>

        <ContentCard title="Line items" subtitle="Items copied from the work order or added by billing.">
          <View style={styles.sectionActionRow}>
            <Pressable style={styles.secondaryBtn} onPress={addLineItem}>
              <Text style={styles.secondaryBtnText}>Add Line Item</Text>
            </Pressable>
            <Text style={styles.mutedText}>Subtotal from line items: {money(lineItemSubtotal)}</Text>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colItem]}>Item</Text>
              <Text style={[styles.th, styles.colQty]}>Qty</Text>
              <Text style={[styles.th, styles.colMoney]}>Rate</Text>
              <Text style={[styles.th, styles.colTotal]}>Total</Text>
              <Text style={[styles.th, styles.colAction]}>Actions</Text>
            </View>
            {items.length === 0 ? (
              <View style={styles.tr}>
                <Text style={styles.mutedText}>No invoice line items yet. Add one above.</Text>
              </View>
            ) : (
              items.map((item, index) => (
                <View key={item.id} style={[styles.tr, index % 2 === 1 ? styles.trStriped : null]}>
                  <TextInput
                    value={item.item ?? ""}
                    onChangeText={(value) => setItemField(item.id, "item", value)}
                    placeholder="Item"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.lineInput, styles.colItem]}
                  />
                  <TextInput
                    value={String(item.qty)}
                    onChangeText={(value) => setItemField(item.id, "qty", Number(cleanDecimalInput(value) || "0"))}
                    keyboardType="numeric"
                    style={[styles.lineInput, styles.colQty]}
                  />
                  <TextInput
                    value={formatCurrencyDisplay(String(item.unit_price || ""))}
                    onChangeText={(value) => setItemField(item.id, "unit_price", Number(cleanDecimalInput(value) || "0"))}
                    keyboardType="numeric"
                    style={[styles.lineInput, styles.colMoney]}
                  />
                  <Text style={[styles.td, styles.colTotal]}>{money(item.qty * item.unit_price)}</Text>
                  <View style={styles.colAction}>
                    <Pressable style={styles.dangerBtn} onPress={() => void deleteLineItem(item)}>
                      <Text style={styles.dangerBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        </ContentCard>

        <ContentCard title="Payments" subtitle="Record payments and keep balance due accurate.">
          <View style={styles.threeCol}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Amount</Text>
              <TextInput
                value={paymentAmount}
                onChangeText={(value) => setPaymentAmount(formatCurrencyDisplay(value))}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Method</Text>
              <TextInput
                value={paymentMethod}
                onChangeText={setPaymentMethod}
                placeholder="Check, cash, card..."
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Note</Text>
              <TextInput
                value={paymentNote}
                onChangeText={setPaymentNote}
                placeholder="Optional"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>
          </View>

          <Pressable style={styles.primaryBtn} onPress={() => void recordPayment()} disabled={recordingPayment}>
            <Text style={styles.primaryBtnText}>{recordingPayment ? "Recording..." : "Record Payment"}</Text>
          </Pressable>

          <View style={styles.paymentList}>
            {payments.length === 0 ? (
              <Text style={styles.mutedText}>No payments recorded yet.</Text>
            ) : (
              payments.map((payment) => (
                <View key={payment.id} style={styles.paymentRow}>
                  <View>
                    <Text style={styles.paymentAmount}>{money(payment.amount)}</Text>
                    <Text style={styles.mutedText}>
                      {formatDate(payment.payment_date)}
                      {payment.method ? ` - ${payment.method}` : ""}
                    </Text>
                  </View>
                  {payment.note ? <Text style={styles.paymentNote}>{payment.note}</Text> : null}
                </View>
              ))
            )}
          </View>
        </ContentCard>
      </AppPage>
    </Screen>
  );
}

const styles = StyleSheet.create({
  createdBanner: {
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    borderRadius: 14,
    backgroundColor: theme.colors.successBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  createdIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  createdIconText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  createdTitle: {
    color: "#166534",
    fontSize: 14,
    fontWeight: "900",
  },
  createdSub: {
    marginTop: 2,
    color: "#166534",
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },
  createdDismiss: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  createdDismissText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "900",
  },
  formStack: {
    gap: 16,
  },
  fieldGroup: {
    flex: 1,
    gap: 6,
  },
  label: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  notesInput: {
    minHeight: 110,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  twoCol: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  threeCol: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  statusChipActive: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  statusText: {
    color: theme.colors.ink,
    fontSize: 12.5,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  statusTextActive: {
    color: theme.colors.goldDark,
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
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  trStriped: {
    backgroundColor: "#F8FAFC",
  },
  th: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  td: {
    color: theme.colors.ink,
    fontSize: 13.5,
    fontWeight: "700",
  },
  colItem: {
    flex: 1,
    minWidth: 180,
  },
  colQty: {
    width: 80,
  },
  colMoney: {
    width: 120,
    textAlign: "right",
  },
  colTotal: {
    width: 132,
    textAlign: "right",
    paddingRight: 18,
  },
  colAction: {
    width: 118,
    textAlign: "center",
    alignItems: "flex-end",
    paddingLeft: 12,
  },
  lineInput: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  sectionActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
  },
  secondaryBtn: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: theme.colors.goldDark,
    fontSize: 12.5,
    fontWeight: "900",
  },
  primaryBtn: {
    marginTop: 14,
    minHeight: 42,
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  dangerBtn: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#C14343",
    justifyContent: "center",
  },
  dangerBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  paymentList: {
    marginTop: 16,
    gap: 10,
  },
  paymentRow: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  paymentAmount: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  paymentNote: {
    flex: 1,
    textAlign: "right",
    color: theme.colors.muted,
    fontSize: 12.5,
    fontWeight: "700",
  },
  mutedText: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
});
