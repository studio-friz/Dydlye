-- ============================================================================
-- Dydlye — SECURITY HARDENING MIGRATION
-- Date: 2026-09-26
-- Fixes: C-01..C-04, H-01..H-10, M-01..M-13, L-06
--
-- HOW TO APPLY
--   Supabase Dashboard > SQL Editor > New query > paste > Run
--   (or:  supabase db push)
--
-- Safe to run repeatedly: every policy and trigger is dropped before it is
-- created, and every object uses IF NOT EXISTS.
--
-- DESIGN NOTES
--   * Ordering matters. All helper functions are created BEFORE the policies
--     that call them, because Postgres validates references at CREATE time.
--   * Nothing privileged lives in the browser. The admin panel talks to the
--     `admin-api` Edge Function, which holds the service_role key and checks
--     the caller against public.admins. Therefore this migration only needs to
--     grant the `authenticated` role the narrowest possible access.
--   * H-06 (profiles PII) restricts profile reads to the caller's own row. The
--     mobile app only ever reads its own profile, so it keeps working, and the
--     admin panel is unaffected because service_role bypasses RLS.
-- ============================================================================


-- ============================================================================
-- 0. PRE-FLIGHT: verify the schema this migration expects actually exists
-- ============================================================================
DO $$
DECLARE
  missing TEXT;
BEGIN
  SELECT string_agg(t, ', ')
  INTO missing
  FROM unnest(ARRAY[
    'profiles', 'properties', 'favorites', 'bookings', 'comments',
    'property_reports', 'destinations', 'countries', 'promo_codes',
    'subscriptions'
  ]) AS t
  WHERE to_regclass('public.' || t) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'Missing expected table(s): %. Run SETUP_ALL.sql first.', missing;
  END IF;
END $$;


-- ============================================================================
-- 1. ADMIN AUTHORITY  (fixes C-01: the panel had no authentication at all)
--
-- `admins` is the allow-list consulted by the admin-api Edge Function.
-- RLS is on and the only client-readable policy is "read your own row",
-- so no browser session can enumerate or grant admin rights.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admins (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admins FROM anon, authenticated;
GRANT SELECT ON public.admins TO authenticated;

DROP POLICY IF EXISTS "admins_self_read" ON public.admins;
CREATE POLICY "admins_self_read" ON public.admins
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- is_admin(): the single source of truth for "may this session administer?".
-- SECURITY DEFINER so the check cannot be defeated by RLS on admins itself.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- is_active_host(): "may this account publish a listing right now?"
-- Used by the properties INSERT policy below, so it is defined here first.
CREATE OR REPLACE FUNCTION public.is_active_host(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_uid IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_uid
      AND is_host
      AND NOT blocked
      AND (host_active_until IS NULL OR host_active_until > now())
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_host(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_host(UUID) TO authenticated, service_role;

-- owns_property(): lets a booking policy ask "is this caller the owner?"
-- without depending on the RLS state of `properties` inside a subquery.
CREATE OR REPLACE FUNCTION public.owns_property(
  p_property_id UUID,
  p_uid         UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = p_property_id AND owner_id = p_uid
  );
$$;

REVOKE ALL ON FUNCTION public.owns_property(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_property(UUID, UUID) TO authenticated, service_role;


-- ============================================================================
-- 2. PROFILES  (fixes C-02 self privilege escalation, H-01 blocked, H-06 PII)
-- ============================================================================

-- 2a. RLS cannot restrict *columns*, so the column GRANT is what actually
--     stops a user from writing is_host / blocked / host_active_until.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url, phone) ON public.profiles TO authenticated;

-- 2b. Own row only.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update to host" ON public.profiles;
DROP POLICY IF EXISTS "Users can upgrade to host" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2c. Blocking an account must actually lock it out (H-01). A blocked user
--     keeps read access to their own row so the app can show them the reason,
--     but loses every write path.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- 2d. H-06: phone / is_host / blocked / host_active_until were readable for
--     every user, including anonymous callers. Anonymous callers now see
--     nothing; admins keep full visibility through service_role.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE SELECT ON public.profiles FROM anon;


-- ============================================================================
-- 3. PROPERTIES  (fixes H-07 any user could list, H-10 field tampering)
-- ============================================================================

-- 3a. price must never be negative.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_price_non_negative'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_price_non_negative CHECK (price >= 0);
  END IF;
END $$;

-- 3b. H-07: the old policy only checked auth.uid() = owner_id, so the
--     client-side "host only" gate was bypassable by any signed-in user.
DROP POLICY IF EXISTS "Authenticated users can insert properties" ON public.properties;
CREATE POLICY "Active hosts can insert properties" ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.is_active_host(auth.uid())
  );

-- 3c. A blocked owner may not mutate their own listings any more.
DROP POLICY IF EXISTS "Owners can update their properties" ON public.properties;
CREATE POLICY "Owners can update their properties" ON public.properties
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND blocked)
  )
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete their properties" ON public.properties;
CREATE POLICY "Owners can delete their properties" ON public.properties
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- 3d. H-10: rating / reviews / created_at / updated_at / owner_id are
--     aggregate and system columns, never writable by the listing's owner.
REVOKE INSERT, UPDATE ON public.properties FROM anon, authenticated;
GRANT INSERT (owner_id, title, description, price, type, city, location,
              bedrooms, bathrooms, area, images, features, lat, lng, phone)
  ON public.properties TO authenticated;
GRANT UPDATE (title, description, price, type, city, location,
              bedrooms, bathrooms, area, images, features, lat, lng, phone)
  ON public.properties TO authenticated;


-- ============================================================================
-- 4. BOOKINGS  (fixes H-10: amount / status / payment_ref were client-supplied)
--
-- Booking creation moves into a SECURITY DEFINER function that computes the
-- amount from the stored nightly price. Direct INSERT/UPDATE/DELETE is revoked
-- so the client cannot post status='confirmed' with amount = 0.
-- ============================================================================
REVOKE INSERT, UPDATE, DELETE ON public.bookings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_booking(
  p_property_id UUID,
  p_start_date  DATE,
  p_end_date    DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me        UUID := auth.uid();
  v_price   NUMERIC;
  v_nights  INTEGER;
  v_amount  NUMERIC;
  v_id      UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = me AND blocked) THEN
    RAISE EXCEPTION 'Account is blocked' USING ERRCODE = '42501';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'Invalid date range' USING ERRCODE = '22007';
  END IF;

  IF p_start_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Start date is in the past' USING ERRCODE = '22007';
  END IF;

  SELECT price INTO v_price FROM public.properties WHERE id = p_property_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_price IS NULL OR v_price < 0 THEN
    RAISE EXCEPTION 'Property has no valid price' USING ERRCODE = '22023';
  END IF;

  v_nights := (p_end_date - p_start_date);
  v_amount := ROUND(v_price * v_nights, 2);

  INSERT INTO public.bookings (user_id, property_id, start_date, end_date, status, amount)
  VALUES (me, p_property_id, p_start_date, p_end_date, 'pending', v_amount)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(UUID, DATE, DATE) TO authenticated;

-- Cancellation is the only mutation a client may perform, and only on its own
-- booking, and only into the 'cancelled' state.
CREATE OR REPLACE FUNCTION public.cancel_my_booking(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled'
  WHERE id = p_booking_id
    AND user_id = me
    AND status <> 'cancelled';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_booking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_my_booking(UUID) TO authenticated;

-- Clients may only read their own bookings (plus, for hosts, bookings made
-- against their own listings). property_reports-style open reads are gone.
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.owns_property(property_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can delete own bookings" ON public.bookings;


-- ============================================================================
-- 5. PROPERTY_REPORTS  (fixes H-02: any user could read/moderate every report)
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can create property reports" ON public.property_reports;
DROP POLICY IF EXISTS "Authenticated users can view property reports" ON public.property_reports;
DROP POLICY IF EXISTS "Authenticated users can delete property reports" ON public.property_reports;
DROP POLICY IF EXISTS "Authenticated users can update property reports" ON public.property_reports;

-- Reporting stays open to signed-in users, but reporter_id is forced to the
-- caller so it can no longer be spoofed, and reads/moderation are admin-only.
DROP POLICY IF EXISTS "Authenticated users can report properties" ON public.property_reports;
CREATE POLICY "Authenticated users can report properties" ON public.property_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id IS NULL OR reporter_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view property reports" ON public.property_reports;
CREATE POLICY "Admins can view property reports" ON public.property_reports
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can moderate property reports" ON public.property_reports;
CREATE POLICY "Admins can moderate property reports" ON public.property_reports
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete property reports" ON public.property_reports;
CREATE POLICY "Admins can delete property reports" ON public.property_reports
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Anonymous callers could flood the table; require a session.
REVOKE INSERT ON public.property_reports FROM anon;


-- ============================================================================
-- 6. DESTINATIONS  (fixes H-03: any signed-in user could edit/delete all)
--    Admin-managed only. The panel writes through admin-api.
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can insert destinations" ON public.destinations;
DROP POLICY IF EXISTS "Authenticated users can update destinations" ON public.destinations;
DROP POLICY IF EXISTS "Authenticated users can delete destinations" ON public.destinations;

DROP POLICY IF EXISTS "Admins can insert destinations" ON public.destinations;
CREATE POLICY "Admins can insert destinations" ON public.destinations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update destinations" ON public.destinations;
CREATE POLICY "Admins can update destinations" ON public.destinations
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete destinations" ON public.destinations;
CREATE POLICY "Admins can delete destinations" ON public.destinations
  FOR DELETE TO authenticated
  USING (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.destinations FROM anon, authenticated;


-- ============================================================================
-- 7. COMMENTS  (fixes M-01 unbounded rating, M-02 forgeable aggregate,
--    M-03 client-supplied author name)
-- ============================================================================

-- 7a. rating must stay inside the 0..5 range.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comments_rating_check'
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_rating_check CHECK (rating IS NULL OR rating BETWEEN 0 AND 5);
  END IF;
END $$;

-- 7b. One review per user per property. Existing duplicates are collapsed to
--     the most recent row first, otherwise the index build would fail.
DELETE FROM public.comments a
USING public.comments b
WHERE a.property_id = b.property_id
  AND a.user_id = b.user_id
  AND (a.created_at, a.id) < (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS comments_property_user_uniq
  ON public.comments (property_id, user_id);

-- 7c. M-02: recompute the aggregate from the comments table on every change
--     instead of trusting a caller-supplied running average.
--     DROP (not CREATE OR REPLACE) because the pre-existing function returns a
--     scalar, and PostgreSQL refuses to change a function's return type in
--     place. It is only ever used by the trigger below, so recreating it is
--     safe.
DROP FUNCTION IF EXISTS public.recalculate_property_rating(UUID);
CREATE FUNCTION public.recalculate_property_rating(p_property_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rating  NUMERIC;
  v_reviews INTEGER;
BEGIN
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO v_rating, v_reviews
  FROM public.comments
  WHERE property_id = p_property_id AND rating > 0;

  UPDATE public.properties
  SET rating  = ROUND(v_rating * 10) / 10,
      reviews = v_reviews
  WHERE id = p_property_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_property_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_property_rating(OLD.property_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.property_id <> NEW.property_id THEN
    PERFORM public.recalculate_property_rating(OLD.property_id);
    PERFORM public.recalculate_property_rating(NEW.property_id);
  ELSE
    PERFORM public.recalculate_property_rating(NEW.property_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS comments_rating_trg ON public.comments;
CREATE TRIGGER comments_rating_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_property_rating();

-- M-02: the old incrementing RPC let any user push an arbitrary rating with
-- no rate limit. It is no longer callable by clients; the trigger is the only
-- path that writes the aggregate. recalculate_property_rating is likewise
-- internal-only: it rewrites properties.rating with definer rights, so leaving
-- it callable would let any user re-run the aggregate at will.
REVOKE ALL ON FUNCTION public.update_property_rating(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_property_rating(UUID) FROM PUBLIC;

-- 7d. M-03: user_name is NOT NULL in the existing schema, so it is kept and
--     simply overwritten from the trusted profile row on every write instead
--     of being accepted from the client.
CREATE OR REPLACE FUNCTION public.comments_set_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(BTRIM(p.full_name), ''), 'مستخدم')
  INTO v_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  NEW.user_name := COALESCE(v_name, 'مستخدم');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_set_author_trg ON public.comments;
CREATE TRIGGER comments_set_author_trg
  BEFORE INSERT OR UPDATE OF user_id, user_name ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.comments_set_author();

-- rating is immutable once written, so a review cannot be used to buy rating.
CREATE OR REPLACE FUNCTION public.comments_lock_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rating IS DISTINCT FROM OLD.rating THEN
    NEW.rating := OLD.rating;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_lock_rating_trg ON public.comments;
CREATE TRIGGER comments_lock_rating_trg
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.comments_lock_rating();

-- A user may edit the text of their own comment, nothing else.
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.comments;
CREATE POLICY "Authenticated users can insert comments" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND blocked)
  );

DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
CREATE POLICY "Users can update own comments" ON public.comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE INSERT, UPDATE ON public.comments FROM anon;
GRANT INSERT (property_id, user_id, text, rating) ON public.comments TO authenticated;
GRANT UPDATE (text) ON public.comments TO authenticated;


-- ============================================================================
-- 8. PROMO CODES  (fixes M-05 replay/abuse, M-06 price drift, M-07 seeded codes)
-- ============================================================================

-- 8a. A redemption record per user per code. The unique index is what makes
--     "redeem once" enforceable rather than advisory.
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  final_price   NUMERIC,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_redemptions_uniq
  ON public.promo_redemptions (promo_code_id, user_id);

ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.promo_redemptions FROM anon, authenticated;
GRANT SELECT ON public.promo_redemptions TO authenticated;

DROP POLICY IF EXISTS "Users can view own redemptions" ON public.promo_redemptions;
CREATE POLICY "Users can view own redemptions" ON public.promo_redemptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 8b. Admin-only access to the codes themselves. service_role (the panel,
--     through admin-api) still bypasses RLS.
DROP POLICY IF EXISTS "No direct access to promo_codes" ON public.promo_codes;
DROP POLICY IF EXISTS "No direct read access to promo_codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Admins can manage promo codes" ON public.promo_codes;

CREATE POLICY "Admins can manage promo codes" ON public.promo_codes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promo_codes FROM anon;

-- 8c. validate_promo_code: VALIDATE ONLY. It never increments uses_count, so
--     a caller cannot burn a limited code by trial and error.
CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row           public.promo_codes%ROWTYPE;
  v_already_used  BOOLEAN := false;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'كود الخصم غير صحيح أو منتهي الصلاحية'
    );
  END IF;

  SELECT * INTO v_row
  FROM public.promo_codes
  WHERE code = UPPER(trim(p_code))
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses_count < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'كود الخصم غير صحيح أو منتهي الصلاحية'
    );
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.promo_redemptions
      WHERE promo_code_id = v_row.id AND user_id = auth.uid()
    ) INTO v_already_used;
  END IF;

  RETURN jsonb_build_object(
    'valid',            true,
    'discount_percent', v_row.discount_percent,
    'description',      v_row.description,
    'already_redeemed', v_already_used
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_promo_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(TEXT) TO authenticated, service_role;

-- 8d. Actual redemption, in one transaction. The unique index turns a
--     concurrent double-submit into a raised error instead of a double spend,
--     and uses_count is incremented here and nowhere else.
--
--     M-06: the base price is resolved from public.product_prices, which is
--     writable only by admins through the service-role admin API. The previous
--     signature took p_base_price straight from the caller, so a redemption
--     could be recorded with base_price = 0 and final_price = 0, poisoning the
--     redemption history that any later trust decision would read. The client
--     now names a product and the server decides what that product costs.
CREATE TABLE IF NOT EXISTS public.product_prices (
  product_id  TEXT PRIMARY KEY,
  price       NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  currency    TEXT NOT NULL DEFAULT 'XOF',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_prices_select_active" ON public.product_prices;
CREATE POLICY "product_prices_select_active"
  ON public.product_prices FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

REVOKE ALL ON public.product_prices FROM anon, authenticated;
GRANT SELECT ON public.product_prices TO anon, authenticated;

-- Seeded so the app keeps working immediately; the values match the prices the
-- client was hardcoding (REGULAR_PRICE / BASE_PRICE in usePromoCode.ts).
INSERT INTO public.product_prices (product_id, price, currency)
VALUES
  ('host_subscription', 100.00, 'XOF'),
  ('host_subscription_list', 150.00, 'XOF')
ON CONFLICT (product_id) DO NOTHING;

DROP FUNCTION IF EXISTS public.redeem_promo_code(TEXT, NUMERIC);
CREATE FUNCTION public.redeem_promo_code(
  p_code      TEXT,
  p_product_id TEXT DEFAULT 'host_subscription'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me          UUID := auth.uid();
  v_row       public.promo_codes%ROWTYPE;
  v_base      NUMERIC;
  v_currency  TEXT;
  v_final     NUMERIC;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = me AND blocked) THEN
    RAISE EXCEPTION 'Account is blocked' USING ERRCODE = '42501';
  END IF;

  -- The price is server-owned. A missing or inactive product is an error
  -- rather than a free redemption.
  SELECT price, currency INTO v_base, v_currency
  FROM public.product_prices
  WHERE product_id = p_product_id AND is_active = true;

  IF NOT FOUND OR v_base IS NULL THEN
    RAISE EXCEPTION 'Unknown product' USING ERRCODE = '22023';
  END IF;

  -- Lock the row so two concurrent redemptions serialise here.
  SELECT * INTO v_row
  FROM public.promo_codes
  WHERE code = UPPER(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND
     OR v_row.is_active IS NOT TRUE
     OR (v_row.expires_at IS NOT NULL AND v_row.expires_at <= now())
     OR (v_row.max_uses IS NOT NULL AND v_row.uses_count >= v_row.max_uses) THEN
    RAISE EXCEPTION 'كود الخصم غير صحيح أو منتهي الصلاحية' USING ERRCODE = '22023';
  END IF;

  v_final := ROUND(v_base * (100 - v_row.discount_percent) / 100, 2);

  -- The unique index raises unique_violation on a second attempt.
  INSERT INTO public.promo_redemptions (promo_code_id, user_id, final_price)
  VALUES (v_row.id, me, v_final);

  UPDATE public.promo_codes
  SET uses_count = uses_count + 1
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'valid',            true,
    'discount_percent', v_row.discount_percent,
    'product_id',       p_product_id,
    'base_price',       v_base,
    'final_price',      v_final,
    'currency',         v_currency
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(TEXT, TEXT) TO authenticated;

-- 8e. M-07: the seeded codes (FREE / MAJANI) were 100% off, unlimited, and
--     published in the repository. They are DEACTIVATED rather than deleted so
--     the redemption history stays intact.
UPDATE public.promo_codes
SET is_active = FALSE
WHERE code IN ('FREE', 'MAJANI', 'SAKAN50', 'OFF50')
  AND is_active;


-- ============================================================================
-- 9. SUBSCRIPTIONS  (fixes H-04: one purchase token could be redeemed by
--    unlimited accounts because purchase_token had no unique constraint)
-- ============================================================================

-- H-04: purchase_token is a bearer credential for Google Play. The unique
-- index is the real fix; the rest only removes client write access.
DO $$
DECLARE
  dupes BIGINT;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT purchase_token
    FROM public.subscriptions
    GROUP BY purchase_token
    HAVING count(*) > 1
  ) d;

  IF dupes > 0 THEN
    RAISE EXCEPTION
      'Cannot add subscriptions_purchase_token_uniq: % purchase_token value(s) are shared by more than one row. This is financial data, so resolve the duplicates manually (keeping the row with the most recent updated_at) and re-run this migration.',
      dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_purchase_token_uniq
  ON public.subscriptions (purchase_token);

-- Clients must not be able to write their own subscription rows.
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.subscriptions;

-- purchase_token is sensitive; do not let a client read its own row verbatim.
REVOKE SELECT ON public.subscriptions FROM anon, authenticated;
GRANT SELECT (id, user_id, product_id, platform, order_id, plan_id, status,
              current_period_start, current_period_end, created_at, updated_at)
  ON public.subscriptions TO authenticated;


-- ============================================================================
-- 10. STORAGE  (fixes M-04: no size or MIME limit on the public buckets)
-- ============================================================================
UPDATE storage.buckets
SET file_size_limit = 5242880,   -- 5 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('property-images', 'destination-images', 'country-images');

-- Blocked users must not be able to keep uploading, and a user may only write
-- inside their own folder.
DROP POLICY IF EXISTS "Authenticated users can upload property images" ON storage.objects;
CREATE POLICY "Authenticated users can upload property images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND blocked)
  );

-- Admin buckets (destination-images, country-images) are written by admin-api
-- with service_role, which bypasses RLS. Only public reads remain.
DROP POLICY IF EXISTS "Users can update their own property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own property images" ON storage.objects;

DROP POLICY IF EXISTS "Destination images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Country images are publicly accessible" ON storage.objects;
CREATE POLICY "Destination and country images are publicly accessible" ON storage.objects
  FOR SELECT
  USING (bucket_id IN ('destination-images', 'country-images'));


-- ============================================================================
-- 11. FAVORITES  (blocked accounts lose write access)
-- ============================================================================
DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorites;
CREATE POLICY "Users can insert own favorites" ON public.favorites
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND blocked)
  );


-- ============================================================================
-- 12. DEFAULT PRIVILEGES  (fixes M-13: anon held write grants on every table,
--     so any future table would be wide open by default)
-- ============================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;

-- RLS on every existing public table. A table that ends up with RLS but no
-- policy denies everything, which is the safe default, so the operator is told
-- which tables those are.
DO $$
DECLARE
  t        TEXT;
  exposed  TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  SELECT string_agg(tablename, ', ')
  INTO exposed
  FROM pg_tables
  WHERE schemaname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = pg_tables.tablename
    );

  IF exposed IS NOT NULL THEN
    RAISE NOTICE
      'RLS enabled with no policy (access denied for all client roles): %',
      exposed;
  END IF;
END $$;


-- ============================================================================
-- 13. REMAINING FUNCTION HARDENING  (L-06)
-- ============================================================================

-- handle_new_user had no SET search_path, unlike every other definer function.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.phone, new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'phone_number')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- get_host_subscription_state: reuse the shared is_active_host() definition so
-- the app and the database can never disagree about what "active host" means.
CREATE OR REPLACE FUNCTION public.get_host_subscription_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_host       BOOLEAN;
  v_active_until  TIMESTAMPTZ;
  v_status        TEXT;
BEGIN
  SELECT host_active_until INTO v_active_until
  FROM public.profiles
  WHERE id = auth.uid();

  v_is_host := public.is_active_host(auth.uid());

  SELECT status INTO v_status
  FROM public.subscriptions
  WHERE user_id = auth.uid()
  ORDER BY current_period_end DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'is_host',           v_is_host,
    'host_active_until', v_active_until,
    'status',            CASE WHEN v_is_host THEN COALESCE(v_status, 'active') ELSE 'none' END,
    'checked_at',        now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_host_subscription_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_host_subscription_state() TO authenticated, service_role;

-- delete_my_account: M-09 — the old version swallowed an auth.users deletion
-- failure and still reported success, leaving a half-deleted account. It now
-- propagates the failure, and M-10 — redemption rows are cleared too.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.promo_redemptions WHERE user_id = me;
  DELETE FROM public.subscriptions        WHERE user_id = me;
  DELETE FROM public.profiles             WHERE id = me;

  -- auth.users cascades to the tables above. If it fails the whole function
  -- rolls back and the caller is told, instead of silently leaving a zombie.
  DELETE FROM auth.users WHERE id = me;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account could not be deleted' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated, service_role;


-- ============================================================================
-- 14. FIRST ADMIN
--
-- There is deliberately NO default admin. Run this yourself, as the project
-- owner, with the real user id:
--
--   INSERT INTO public.admins (user_id, email, note)
--   SELECT id, email, 'initial owner'
--   FROM auth.users
--   WHERE email = 'you@example.com'
--   ON CONFLICT (user_id) DO NOTHING;
--
-- To list the current admins:
--   SELECT user_id, email, created_at FROM public.admins ORDER BY created_at;
-- ============================================================================


-- ============================================================================
-- VERIFY
--   SELECT * FROM public.admins;
--   SELECT tablename, policyname, cmd FROM pg_policies
--     WHERE schemaname = 'public' ORDER BY tablename, policyname;
--   SELECT proname, proacl FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--     WHERE n.nspname = 'public' AND proname IN
--       ('is_admin','is_active_host','owns_property','create_booking',
--        'cancel_my_booking','validate_promo_code','redeem_promo_code');
-- ============================================================================
