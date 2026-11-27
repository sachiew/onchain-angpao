"use client";

import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { ClaimSigner } from "../gasless";
import { burnerClaimSigner, getBurner, forgetBurner } from "./burner";
import type { PrivyApi } from "./privy-layer";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PrivyLayer = PRIVY_APP_ID ? lazy(() => import("./privy-layer")) : null;

type InstantWalletValue = {
  /** "privy" when NEXT_PUBLIC_PRIVY_APP_ID is set, else "burner". */
  provider: "privy" | "burner";
  /** The active instant wallet, if one exists on this device / session. */
  signer: ClaimSigner | null;
  /** Create (burner) or log in to (Privy) an instant wallet. Resolves with its signer. */
  create: () => Promise<ClaimSigner>;
  /** Privy: log out. Burner: forget the key on this device. */
  forget: () => Promise<void>;
};

const Ctx = createContext<InstantWalletValue | null>(null);

export function InstantWalletProvider({ children }: PropsWithChildren) {
  const [burner, setBurner] = useState<ClaimSigner | null>(null);
  const [privy, setPrivy] = useState<PrivyApi | null>(null);
  const waiter = useRef<((s: ClaimSigner) => void) | null>(null);

  // Restore an existing burner on load.
  useEffect(() => {
    if (PRIVY_APP_ID) return;
    getBurner(false)
      .then((s) => s && setBurner(burnerClaimSigner(s)))
      .catch(() => {});
  }, []);

  // Resolve a pending Privy login once the embedded wallet appears.
  useEffect(() => {
    if (privy?.signer && waiter.current) {
      waiter.current(privy.signer);
      waiter.current = null;
    }
  }, [privy?.signer]);

  const create = useCallback(async (): Promise<ClaimSigner> => {
    if (PRIVY_APP_ID) {
      if (privy?.signer) return privy.signer;
      if (!privy?.ready) throw new Error("Wallet service is still loading, try again in a second");
      const p = new Promise<ClaimSigner>((resolve, reject) => {
        waiter.current = resolve;
        setTimeout(() => reject(new Error("Login timed out")), 120_000);
      });
      privy.login();
      return p;
    }
    const s = burnerClaimSigner((await getBurner(true))!);
    setBurner(s);
    return s;
  }, [privy]);

  const forget = useCallback(async () => {
    if (PRIVY_APP_ID) await privy?.logout();
    else {
      forgetBurner();
      setBurner(null);
    }
  }, [privy]);

  const value = useMemo<InstantWalletValue>(
    () => ({
      provider: PRIVY_APP_ID ? "privy" : "burner",
      signer: PRIVY_APP_ID ? (privy?.signer ?? null) : burner,
      create,
      forget,
    }),
    [privy, burner, create, forget],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {PrivyLayer && PRIVY_APP_ID && (
        <Suspense fallback={null}>
          <PrivyLayer appId={PRIVY_APP_ID} onApi={setPrivy} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}

export function useInstantWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useInstantWallet must be used within InstantWalletProvider");
  return v;
}
