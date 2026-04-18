import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function ClientProjectsMobile() {
  return (
    <MobilePortalPage
      eyebrow="Client portal"
      title="My projects"
      subtitle="Trust-building project tracking with simple statuses and client-safe updates only."
      stats={[
        { label: "Active", value: "0", meta: "Current projects" },
        { label: "Past", value: "0", meta: "Completed work" },
      ]}
      sections={[
        { icon: "trail-sign-outline", title: "Status timeline", body: "Scheduled, in progress, awaiting approval, completed, and invoice sent." },
        { icon: "images-outline", title: "Photos & updates", body: "Client-safe progress photos and company notes." },
        { icon: "calendar-outline", title: "Appointments", body: "Upcoming appointment details without exposing internal workflow noise." },
      ]}
    />
  );
}
