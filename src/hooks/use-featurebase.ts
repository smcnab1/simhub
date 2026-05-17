"use client";

import {
  hide,
  setLanguage,
  setTheme,
  show,
  showArticle,
  showChangelog,
  showConversation,
  showMessages,
  showNewMessage,
  showNews,
  showSpace,
  shutdown,
  update,
  whenReady,
} from "featurebase-js";
import { useCallback } from "react";
import { useDashboardAuth } from "@/components/dashboard-auth";
import {
  createFeaturebaseIdentity,
  openFeaturebaseFeedbackWidget,
  type FeaturebaseClientIdentity,
} from "@/lib/featurebase";

export function useFeaturebase() {
  useDashboardAuth();

  const updateMetadata = useCallback(
    async () => {
      // TODO: Add a refresh endpoint that re-signs this metadata into a new
      // Featurebase JWT when SimHQ supports in-session role or tenant changes.
      const response = await fetch("/api/featurebase/identity", {
        credentials: "same-origin",
      });

      if (!response.ok) return;

      const data = (await response.json()) as { identity?: FeaturebaseClientIdentity | null };
      if (data.identity) {
        update(createFeaturebaseIdentity({ identity: data.identity }));
      }
    },
    [],
  );
  const openMessenger = useCallback(() => {
    whenReady(() => show());
  }, []);

  return {
    show: openMessenger,
    hide,
    showSpace,
    showMessages,
    showArticle,
    showChangelog,
    showNews,
    showConversation,
    showNewMessage,
    setTheme,
    setLanguage,
    update,
    shutdown,
    identify: updateMetadata,
    updateMetadata,
    openFeedbackWidget: openFeaturebaseFeedbackWidget,
  };
}
