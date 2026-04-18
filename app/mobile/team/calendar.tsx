import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function TeamCalendarMobile() {
  return (
    <MobilePortalPage
      eyebrow="Team field app"
      title="Calendar"
      subtitle="Simple schedule view with job shortcuts, location, and route context."
      sections={[
        { icon: "calendar-outline", title: "Schedule", body: "Tap a scheduled job to open the field detail screen." },
        { icon: "location-outline", title: "Route shortcut", body: "Use address data from assigned jobs for navigation links later." },
        { icon: "time-outline", title: "Availability", body: "Keep future availability and time windows lightweight." },
      ]}
    />
  );
}
