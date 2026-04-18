import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function TeamAccountMobile() {
  return (
    <MobilePortalPage
      eyebrow="Team field app"
      title="Account"
      subtitle="Field profile, availability, notifications, and documents for the team member."
      sections={[
        { icon: "person-outline", title: "Profile", body: "Name, phone, role, and contact preferences." },
        { icon: "notifications-outline", title: "Notifications", body: "Control job assignment and schedule reminders." },
        { icon: "shield-checkmark-outline", title: "Documents", body: "Certifications and HR documents can live here later." },
      ]}
    />
  );
}
