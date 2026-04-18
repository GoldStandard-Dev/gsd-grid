import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function ClientProfileMobile() {
  return (
    <MobilePortalPage
      eyebrow="Client portal"
      title="Profile"
      subtitle="Client contact info, saved addresses, preferences, and support access."
      sections={[
        { icon: "person-outline", title: "Contact info", body: "Name, phone, email, and communication preferences." },
        { icon: "home-outline", title: "Saved addresses", body: "Addresses connected to the client's projects only." },
        { icon: "chatbubble-ellipses-outline", title: "Support", body: "A simple contact path back to the company." },
      ]}
    />
  );
}
