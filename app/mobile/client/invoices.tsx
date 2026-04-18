import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function ClientInvoicesMobile() {
  return (
    <MobilePortalPage
      eyebrow="Client portal"
      title="Invoices"
      subtitle="Invoice viewing, payment status, PDF downloads, and future pay-now actions."
      sections={[
        { icon: "receipt-outline", title: "Invoice list", body: "Show only invoices connected to the signed-in client account." },
        { icon: "download-outline", title: "Download PDF", body: "Give clients a simple way to keep records." },
        { icon: "card-outline", title: "Pay now later", body: "Ready for a Stripe payment action when payments are added." },
      ]}
    />
  );
}
