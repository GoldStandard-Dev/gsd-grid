import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function TeamJobsMobile() {
  return (
    <MobilePortalPage
      eyebrow="Team field app"
      title="My jobs"
      subtitle="Assigned work only. Big actions, low typing, and field-first job flow."
      stats={[
        { label: "Today", value: "0", meta: "Jobs due" },
        { label: "Overdue", value: "0", meta: "Needs action" },
      ]}
      sections={[
        { icon: "navigate-outline", title: "Assigned jobs", body: "Today, upcoming, overdue, and completed work grouped for quick scanning." },
        { icon: "hammer-outline", title: "Job detail", body: "Client, address, contact, scope, checklist, and required template fields." },
        { icon: "checkmark-circle-outline", title: "Status workflow", body: "Start, pause, complete, submit for review, and request help." },
      ]}
      primaryAction="Open Next Job"
    />
  );
}
