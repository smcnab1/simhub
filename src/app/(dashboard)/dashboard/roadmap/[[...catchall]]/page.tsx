import { FeaturebaseEmbedPage } from "@/components/featurebase-embed-page";
import { FEATUREBASE_ROADMAP_URL } from "@/lib/featurebase";

export default function RoadmapPage() {
  return (
    <FeaturebaseEmbedPage
      title="Roadmap"
      description="Track planned improvements and recently shipped product work."
      href={FEATUREBASE_ROADMAP_URL}
    />
  );
}
