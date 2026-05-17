import { FeaturebaseEmbedPage } from "@/components/featurebase-embed-page";
import { FEATUREBASE_FEEDBACK_URL } from "@/lib/featurebase";

export default function FeedbackPage() {
  return (
    <FeaturebaseEmbedPage
      title="Feedback"
      description="Share ideas, vote on requests, and help shape what SimHQ builds next."
      href={FEATUREBASE_FEEDBACK_URL}
    />
  );
}
