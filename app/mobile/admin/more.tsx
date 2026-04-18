import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function AdminMoreMobile() {
  return (
    <MobilePortalPage
      eyebrow="Admin mobile"
      title="More"
      subtitle="Lite access to system tools. Deep settings, pricing grids, and templates remain desktop-first."
      sections={[
        { icon: "people-outline", title: "Team", body: "Review team members, roles, and availability at a glance." },
        { icon: "calculator-outline", title: "Pricing", body: "Open pricing references without exposing full spreadsheet editing." },
        { icon: "settings-outline", title: "Settings lite", body: "Change safe mobile preferences and notification settings." },
      ]}
    />
  );
}
