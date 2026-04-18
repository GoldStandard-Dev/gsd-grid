import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function ClientApprovalsMobile() {
  return (
    <MobilePortalPage
      eyebrow="Client portal"
      title="Approvals"
      subtitle="A clean place for estimates, change requests, documents, and completion sign-off."
      sections={[
        { icon: "create-outline", title: "Estimate approval", body: "Approve or request changes on client-facing estimates." },
        { icon: "document-text-outline", title: "Document review", body: "Review submitted documents that are explicitly visible to the client." },
        { icon: "checkmark-done-outline", title: "Completion sign-off", body: "Sign off when work is ready for closure or invoicing." },
      ]}
      primaryAction="Review Next Approval"
    />
  );
}
