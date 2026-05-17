"use client";

import Featurebase, { setTheme, shutdown } from "featurebase-js";
import { useTheme } from "next-themes";
import { createContext, type ReactNode, useEffect, useMemo } from "react";
import {
  createFeaturebaseIdentity,
  FEATUREBASE_APP_ID,
  type FeaturebaseClientIdentity,
  type FeaturebaseTheme,
} from "@/lib/featurebase";

type SimHQFeaturebaseProviderProps = {
  appVersion: string;
  environment: string;
  identity?: FeaturebaseClientIdentity | null;
  children: ReactNode;
};

export type FeaturebaseRuntimeContextValue = {
  appVersion: string;
  environment: string;
};

export const FeaturebaseRuntimeContext = createContext<FeaturebaseRuntimeContextValue | null>(
  null,
);

function useFeaturebaseTheme(): FeaturebaseTheme {
  const { resolvedTheme, systemTheme } = useTheme();
  const theme = resolvedTheme === "system" ? systemTheme : resolvedTheme;

  return theme === "dark" ? "dark" : "light";
}

export function FeaturebaseProvider({
  appVersion,
  environment,
  identity,
  children,
}: SimHQFeaturebaseProviderProps) {
  const theme = useFeaturebaseTheme();
  const featurebaseIdentity = useMemo(
    () => createFeaturebaseIdentity({ identity }),
    [identity],
  );
  const featurebaseJwt = featurebaseIdentity.featurebaseJwt;
  const runtimeContext = useMemo(
    () => ({ appVersion, environment }),
    [appVersion, environment],
  );

  useEffect(() => {
    if (!FEATUREBASE_APP_ID) return;

    Featurebase({
      appId: FEATUREBASE_APP_ID,
      messenger: true,
      ...(featurebaseJwt ? { featurebaseJwt } : {}),
    });

    return () => {
      shutdown();
    };
  }, [featurebaseJwt]);

  useEffect(() => {
    if (!FEATUREBASE_APP_ID) return;
    setTheme(theme);
  }, [theme]);

  if (!FEATUREBASE_APP_ID) {
    return (
      <FeaturebaseRuntimeContext.Provider value={runtimeContext}>
        {children}
      </FeaturebaseRuntimeContext.Provider>
    );
  }

  return (
    <FeaturebaseRuntimeContext.Provider value={runtimeContext}>
      {children}
    </FeaturebaseRuntimeContext.Provider>
  );
}
