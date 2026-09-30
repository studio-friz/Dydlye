import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PromoResult {
  valid: boolean;
  discount_percent?: number;
  final_price?: number;
  base_price?: number;
  currency?: string;
  product_id?: string;
  description?: string;
  message?: string;
}

interface UsePromoCodeReturn {
  promoCode: string;
  setPromoCode: (code: string) => void;
  codeApplied: boolean;
  discountMessage: string;
  finalPrice: number;
  regularPrice: number;
  isValidating: boolean;
  handleApplyCode: () => Promise<void>;
  handleRemoveCode: () => void;
}

// Display-only fallback used until the server has answered. The authoritative
// price lives in public.product_prices; this constant is never sent to it.
const REGULAR_PRICE = 150;
const BASE_PRICE = 100;
const PRODUCT_ID = "host_subscription";

export function usePromoCode(): UsePromoCodeReturn {
  const [promoCode, setPromoCode] = useState("");
  const [codeApplied, setCodeApplied] = useState(false);
  const [discountMessage, setDiscountMessage] = useState("");
  const [finalPrice, setFinalPrice] = useState(BASE_PRICE);
  const [isValidating, setIsValidating] = useState(false);

  const handleApplyCode = async () => {
    const trimmed = promoCode.trim();
    if (!trimmed) return;

    const { toast } = await import("sonner");
    setIsValidating(true);
    try {
      // redeem_promo_code() is the only path that records a redemption: it
      // locks the code row, enforces one-per-user through a unique index and
      // computes the final price server-side. validate_promo_code() alone is
      // only a preview and would let a caller burn a limited code (M-05).
      //
      // M-06: the client no longer sends a price. It names the product and the
      // server reads the authoritative price from public.product_prices, so a
      // redemption can no longer be recorded with a forged base/final price.
      const { data, error } = await supabase.rpc("redeem_promo_code", {
        p_code: trimmed,
        p_product_id: PRODUCT_ID,
      });

      if (error) {
        toast.error(error.message ?? "تعذّر استخدام الكود");
        return;
      }

      const result = data as unknown as PromoResult;

      if (!result.valid) {
        toast.error(result.message ?? "كود الخصم غير صحيح");
        return;
      }

      const price = result.final_price ?? result.base_price ?? BASE_PRICE;
      const percent = result.discount_percent ?? 0;

      setFinalPrice(price);
      setCodeApplied(true);
      setDiscountMessage(`${percent}% discount applied - Price: ${price}`);
      toast.success(`${percent}% discount applied!`);
    } catch (err) {
      console.error("[usePromoCode] Error:", err);
      toast.error("Error verifying promo code. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveCode = () => {
    setPromoCode("");
    setFinalPrice(BASE_PRICE);
    setCodeApplied(false);
    setDiscountMessage("");
    import("sonner").then(({ toast }) => toast.info("Promo code removed"));
  };

  return {
    promoCode,
    setPromoCode,
    codeApplied,
    discountMessage,
    finalPrice,
    regularPrice: REGULAR_PRICE,
    isValidating,
    handleApplyCode,
    handleRemoveCode,
  };
}
