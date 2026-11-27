"use client";

import { createContext, useContext, type ReactNode } from "react";
import { NETWORK } from "../lib/config";
import type { ClusterMoniker } from "../lib/solana-client";
import { getExplorerUrl } from "../lib/explorer";

type ClusterContextValue = {
  cluster: ClusterMoniker;
  getExplorerUrl: (path: string) => string;
};

const value: ClusterContextValue = {
  cluster: NETWORK,
  getExplorerUrl: (path) => getExplorerUrl(path, NETWORK),
};

const ClusterContext = createContext<ClusterContextValue>(value);

export function ClusterProvider({ children }: { children: ReactNode }) {
  return <ClusterContext.Provider value={value}>{children}</ClusterContext.Provider>;
}

export function useCluster() {
  return useContext(ClusterContext);
}
