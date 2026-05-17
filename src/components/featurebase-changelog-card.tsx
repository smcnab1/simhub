"use client";

import {
  destroyChangelog,
  initChangelog,
  whenReady,
} from "featurebase-js";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import type { FeaturebaseTheme } from "@/lib/featurebase";

function useFeaturebaseTheme(): FeaturebaseTheme {
  const { resolvedTheme, systemTheme } = useTheme();
  const theme = resolvedTheme === "system" ? systemTheme : resolvedTheme;

  return theme === "dark" ? "dark" : "light";
}

export function FeaturebaseChangelogCard() {
  const theme = useFeaturebaseTheme();

  useEffect(() => {
    let cancelled = false;

    whenReady(() => {
      if (cancelled) return;

      initChangelog({
        theme,
        changelogCard: {
          enabled: true,
          layout: {
            position: "bottom-right",
            marginBottom: 88,
            marginSide: 24,
          },
        },
      });
    });

    return () => {
      cancelled = true;
      destroyChangelog();
    };
  }, [theme]);

  return null;
}
