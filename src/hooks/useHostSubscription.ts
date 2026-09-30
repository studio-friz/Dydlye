import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE, type Product } from "@capgo/native-purchases";
import { supabase } from "@/integrations/supabase/client";

/** Google Play Console subscription product ID (must match exactly). */
export const HOST_SUBSCRIPTION_PRODUCT_ID = "dydlye_host_monthly";
/** Base plan ID of that subscription inside Play Console. */
export const HOST_SUBSCRIPTION_PLAN_ID = "monthly";

export const HOST_SUBSCRIPTION_PRICE_MAD = 100;
export const HOST_SUBSCRIPTION_REGULAR_PRICE_MAD = 150;

export type PurchaseFailureCode =
  | "cancel"
  | "unsupported"
  | "unavailable"
  | "verify"
  | "network"
  | "unknown";

export type PurchaseResult =
  | { ok: true; expires_at: string }
  | { ok: false; code: PurchaseFailureCode; message?: string };

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-play-subscription`;

function appAccountToken(userId: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < userId.length; i++) {
    const c = userId.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 16777619) >>> 0;
  }
  return `${h1.toString(16)}${h2.toString(16)}`;
}

function mapError(err: unknown): PurchaseResult {
  const message = err instanceof Error ? err.message : String(err);
  if (/cancel|cancelled by user|canceled/i.test(message)) {
    return { ok: false, code: "cancel", message };
  }
  if (/billing.*not supported|not supported/i.test(message)) {
    return { ok: false, code: "unsupported", message };
  }
  if (/network|timeout|fetch/i.test(message)) {
    return { ok: false, code: "network", message };
  }
  return { ok: false, code: "unknown", message };
}

async function confirmWithServer(
  purchaseToken: string,
  productId: string,
  planId: string,
): Promise<PurchaseResult> {
  const { data: session } = await supabase.auth.getSession();
  const accessToken = session?.session?.access_token;
  if (!accessToken) {
    return { ok: false, code: "unknown", message: "Not authenticated" };
  }

  let res: Response;
  try {
    res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: "confirm", purchaseToken, productId, planId }),
    });
  } catch {
    return { ok: false, code: "network", message: "Network error" };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    return {
      ok: false,
      code: "verify",
      message: data?.error ?? "Server rejected the purchase",
    };
  }
  return { ok: true, expires_at: data.expires_at };
}

export function useHostSubscription() {
  /** True when Google Play Billing is available on this device. */
  const billingAvailable = useCallback(async (): Promise<boolean> => {
    try {
      if (Capacitor.getPlatform() === "web") return false;
      const { isBillingSupported } = await NativePurchases.isBillingSupported();
      return isBillingSupported;
    } catch {
      return false;
    }
  }, []);

  /** Live product info from the store (real title/price — required by Play). */
  const loadProduct = useCallback(async (): Promise<Product> => {
    const { product } = await NativePurchases.getProduct({
      productIdentifier: HOST_SUBSCRIPTION_PRODUCT_ID,
      productType: PURCHASE_TYPE.SUBS,
    });
    return product;
  }, []);

  /** Purchase the host subscription and verify it server-side. */
  const purchase = useCallback(
    async (userId: string): Promise<PurchaseResult> => {
      const supported = await billingAvailable();
      if (!supported) {
        return { ok: false, code: "unsupported" };
      }

      try {
        const transaction = await NativePurchases.purchaseProduct({
          productIdentifier: HOST_SUBSCRIPTION_PRODUCT_ID,
          planIdentifier: HOST_SUBSCRIPTION_PLAN_ID,
          productType: PURCHASE_TYPE.SUBS,
          quantity: 1,
          appAccountToken: appAccountToken(userId),
        });

        if (!transaction.purchaseToken) {
          return { ok: false, code: "unavailable", message: "No purchase token" };
        }
        if (transaction.purchaseState && transaction.purchaseState !== "1") {
          return { ok: false, code: "cancel", message: "Purchase is not completed" };
        }

        return await confirmWithServer(
          transaction.purchaseToken,
          transaction.productIdentifier || HOST_SUBSCRIPTION_PRODUCT_ID,
          HOST_SUBSCRIPTION_PLAN_ID,
        );
      } catch (err) {
        return mapError(err);
      }
    },
    [billingAvailable],
  );

  /** Restore previous purchases (e.g. after re-install). */
  const restore = useCallback(async (): Promise<PurchaseResult> => {
    const supported = await billingAvailable();
    if (!supported) {
      return { ok: false, code: "unsupported" };
    }

    try {
      await NativePurchases.restorePurchases();
      const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS });

      const active = purchases.find(
        (p) =>
          p.productIdentifier === HOST_SUBSCRIPTION_PRODUCT_ID &&
          (p.purchaseState === "1" || p.purchaseState === "PURCHASED") &&
          p.purchaseToken,
      );

      if (!active?.purchaseToken) {
        return { ok: false, code: "unavailable", message: "No active subscription found" };
      }

      return await confirmWithServer(
        active.purchaseToken,
        active.productIdentifier,
        HOST_SUBSCRIPTION_PLAN_ID,
      );
    } catch (err) {
      if (/none.*purchase|no.*purchase|cancel/i.test(err instanceof Error ? err.message : "")) {
        return { ok: false, code: "unavailable", message: "No active subscription found" };
      }
      return mapError(err);
    }
  }, [billingAvailable]);

  /** Open the platform's subscription management page (cancel/renew). */
  const openManageSubscriptions = useCallback(async (): Promise<void> => {
    try {
      await NativePurchases.manageSubscriptions();
    } catch (err) {
      console.error("manageSubscriptions failed:", err);
    }
  }, []);

  return { billingAvailable, loadProduct, purchase, restore, openManageSubscriptions };
}
