import { createFileRoute } from "@tanstack/react-router";
import { LegalChat } from "@/components/LegalChat";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nyaya Sahayak | Indian Legal Information Assistant" },
      {
        name: "description",
        content:
          "Describe your situation in plain words and get guidance grounded in official Indian legal sources — Acts, sections and practical next steps.",
      },
      { property: "og:title", content: "Nyaya Sahayak | Indian Legal Information Assistant" },
      {
        property: "og:description",
        content:
          "Describe your situation in plain words and get guidance grounded in official Indian legal sources — Acts, sections and practical next steps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="h-dvh overflow-hidden">
      <LegalChat />
    </main>
  );
}
