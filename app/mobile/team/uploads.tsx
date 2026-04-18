import MobilePortalPage from "../../../src/components/MobilePortalPage";

export default function TeamUploadsMobile() {
  return (
    <MobilePortalPage
      eyebrow="Team field app"
      title="Uploads"
      subtitle="Camera-first photo and site file workflow tied directly to assigned jobs."
      sections={[
        { icon: "camera-outline", title: "Photo upload", body: "Add before, progress, completion, and issue photos to a job." },
        { icon: "document-attach-outline", title: "Site files", body: "Attach files that are visible to team or client depending on permissions." },
        { icon: "cloud-done-outline", title: "Completion package", body: "Collect final photos, notes, measurements, and signatures." },
      ]}
      primaryAction="Upload Photo"
    />
  );
}
