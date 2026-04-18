import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function AdminClientsMobile() {
  return (
    <MobilePortalPage
      eyebrow="Admin mobile"
      title="Clients"
      subtitle="Client lookup, contact shortcuts, and linked work history for owners and managers."
      sections={[
        { icon: "call-outline", title: "Contact shortcuts", body: "Call, text, or email directly from a client record." },
        { icon: "folder-open-outline", title: "Linked work", body: "See active workorders and invoices tied to each client." },
        { icon: "person-add-outline", title: "Add client", body: "Create a light client record from mobile when work starts in the field." },
      ]}
      primaryAction="Add Client"
    />
  );
}
