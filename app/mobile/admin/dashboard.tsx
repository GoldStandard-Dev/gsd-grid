import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function AdminDashboardMobile() {
  return (
    <MobilePortalPage
      eyebrow="Admin mobile"
      title="Command center"
      subtitle="A light oversight view for today's work, reviews, revenue, and activity."
      stats={[
        { label: "Today", value: "0", meta: "Jobs scheduled" },
        { label: "Review", value: "0", meta: "Pending approval" },
        { label: "Alerts", value: "0", meta: "Unread updates" },
        { label: "Revenue", value: "$0", meta: "Snapshot" },
      ]}
      sections={[
        { icon: "briefcase-outline", title: "Today's jobs", body: "Review what is active, scheduled, and waiting on assignment." },
        { icon: "checkmark-done-outline", title: "Pending review", body: "Approve submitted field work and decide what becomes billable." },
        { icon: "pulse-outline", title: "Recent activity", body: "Watch assignments, status updates, and client-facing events." },
      ]}
      primaryAction="New Work Order"
    />
  );
}
