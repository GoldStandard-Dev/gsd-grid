import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function AdminWorkordersMobile() {
  return (
    <MobilePortalPage
      eyebrow="Admin mobile"
      title="Workorders"
      subtitle="Fast review, assignment, and status changes. Heavy template editing stays desktop-only."
      stats={[
        { label: "Active", value: "0", meta: "Open jobs" },
        { label: "Submitted", value: "0", meta: "Needs review" },
      ]}
      sections={[
        { icon: "search-outline", title: "Find work quickly", body: "Filter by assigned, active, submitted, and ready-to-invoice work." },
        { icon: "people-outline", title: "Assign techs", body: "Make quick assignment changes without opening the full desktop workspace." },
        { icon: "document-text-outline", title: "Convert to invoice", body: "Move reviewed work toward billing from the field-friendly overview." },
      ]}
      primaryAction="Create Basic Workorder"
    />
  );
}
