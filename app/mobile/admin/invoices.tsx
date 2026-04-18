import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function AdminInvoicesMobile() {
  return (
    <MobilePortalPage
      eyebrow="Admin mobile"
      title="Invoices"
      subtitle="Quick invoice review, status changes, and send actions without full desktop reporting."
      stats={[
        { label: "Open", value: "$0", meta: "Outstanding" },
        { label: "Paid", value: "$0", meta: "Collected" },
      ]}
      sections={[
        { icon: "receipt-outline", title: "Invoice list", body: "See unpaid, paid, overdue, and draft invoices in one clean mobile list." },
        { icon: "mail-outline", title: "Send invoice", body: "Send or resend invoices from a small set of safe mobile actions." },
        { icon: "card-outline", title: "Mark paid", body: "Update payment status quickly when payment happens off-platform." },
      ]}
    />
  );
}
