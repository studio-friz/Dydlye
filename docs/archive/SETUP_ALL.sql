-- ============================================================
-- Dydlye — ORIGINAL DATABASE SETUP (Main App + Admin)
-- ============================================================
-- !! DEPRECATED — DO NOT USE THIS FILE ALONE IN PRODUCTION !!
--
-- This is the ORIGINAL setup, kept for reference. It contains the insecure
-- policies documented in SECURITY_AUDIT_REPORT.md:
--   C-02  any user can set profiles.is_host = true (free privilege escalation)
--   H-01  "blocked" is never enforced
--   H-02  any authenticated user can read/edit/delete every property_reports row
--   H-03  any authenticated user can edit/delete destinations
--   H-06  profiles SELECT exposes every user's name, phone and blocked flag
--   H-07  "is a host" is only enforced in the client, not in the database
--   M-01  comments.rating has no CHECK constraint
--   M-02  update_property_rating() is callable by any user
--   M-03  comments.user_name is client-supplied, so a reviewer can be impersonated
--   M-04  storage upload is unrestricted to any authenticated user
--   M-07  100%-off promo codes are seeded here
--   M-13  over-broad grants to anon
--
-- Run it like this:
--   1. Run this file (creates the schema).
--   2. THEN IMMEDIATELY run, in the same editor or via the CLI:
--        dydlye/supabase/migrations/20260926000000_security_hardening.sql
--      The migration is what actually locks the database down.
--
-- The Admin panel no longer uses the service_role key from the browser at all
-- (that was C-01). It authenticates with Supabase Auth and calls the
-- `admin-api` Edge Function, which checks public.admins server-side.
--
-- Project: <your-project-ref>
--
-- Safe to run multiple times (idempotent). Re-running will never
-- duplicate data or fail on existing objects.
--
-- What this creates:
--   1.  Tables: profiles, properties, favorites, bookings,
--       comments, property_reports, destinations, countries,
--       promo_codes, subscriptions
--   2.  RLS + policies (app users see only what they should;
--       the Admin panel uses the service_role key and bypasses RLS)
--   3.  Triggers: auto-create profile on signup, auto-touch updated_at
--   4.  Functions: validate_promo_code, update_property_rating,
--       recalculate_property_rating, get_host_subscription_state,
--       delete_my_account
--   5.  Storage buckets: property-images, destination-images,
--       country-images (all public)
--   6.  Realtime on destinations
--   7.  Indexes + seed promo codes

-- ============================================================
-- 1. PROFILES (linked to auth users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  is_host BOOLEAN NOT NULL DEFAULT false,
  blocked BOOLEAN NOT NULL DEFAULT false,
  host_active_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Columns added by later features (no-ops if they already exist)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_host BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS host_active_until TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());

-- ============================================================
-- 2. PROPERTIES (عقارات)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  type TEXT CHECK (type IN ('فيلا', 'شقة', 'رياض', 'استوديو')),
  city TEXT NOT NULL,
  location TEXT NOT NULL,
  bedrooms INTEGER DEFAULT 1,
  bathrooms INTEGER DEFAULT 1,
  area NUMERIC,
  images TEXT[] DEFAULT '{}',
  features TEXT[] DEFAULT '{}',
  rating NUMERIC DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  lat NUMERIC,
  lng NUMERIC,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================
-- 3. FAVORITES (المفضلة)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, property_id)
);

-- ============================================================
-- 4. BOOKINGS (الحجوزات)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_ref TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- ============================================================
-- 5. COMMENTS (تعليقات وتقييمات)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  rating INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================
-- 6. PROPERTY REPORTS (بلاغات العقارات)
--     The app inserts reports; the Admin panel changes `status`.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.property_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.property_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';

-- ============================================================
-- 7. DESTINATIONS (الوجهات السياحية)
--     category CHECK is (re)created below so re-runs stay safe.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  location TEXT,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  images TEXT[] DEFAULT '{}',
  phone TEXT,
  opening_hours TEXT,
  rating NUMERIC DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  country TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.destinations ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.destinations ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Full category list (app has 11, admin adds "شلالات" too)
ALTER TABLE public.destinations DROP CONSTRAINT IF EXISTS destinations_category_check;
ALTER TABLE public.destinations ADD CONSTRAINT destinations_category_check
  CHECK (category IN (
    'مسبح', 'معلم سياحي', 'مقهى', 'مطعم', 'حفلة', 'تسوق',
    'طبيعة', 'ترفيه', 'شاطئ', 'رياضة', 'حمام تقليدي', 'شلالات'
  ));

-- ============================================================
-- 8. COUNTRIES (الدول) — used by the Admin panel to group destinations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. PROMO CODES (أكواد الخصم) — never readable by clients directly
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 0 AND 100),
  description TEXT,
  max_uses INTEGER DEFAULT NULL,
  uses_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS uses_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- 10. SUBSCRIPTIONS (اشتراكات المضيف — Google Play)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'google_play',
  purchase_token TEXT NOT NULL,
  order_id TEXT,
  plan_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'paused')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_product_idx
  ON public.subscriptions (user_id, product_id);

-- ============================================================
-- 11. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS properties_owner_id_idx ON public.properties (owner_id);
CREATE INDEX IF NOT EXISTS properties_city_idx ON public.properties (city);
CREATE INDEX IF NOT EXISTS properties_created_at_idx ON public.properties (created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON public.bookings (user_id);
CREATE INDEX IF NOT EXISTS bookings_property_id_idx ON public.bookings (property_id);
CREATE INDEX IF NOT EXISTS comments_property_id_idx ON public.comments (property_id);
CREATE INDEX IF NOT EXISTS comments_user_id_idx ON public.comments (user_id);
CREATE INDEX IF NOT EXISTS favorites_property_id_idx ON public.favorites (property_id);
CREATE INDEX IF NOT EXISTS property_reports_property_id_idx ON public.property_reports (property_id);
CREATE INDEX IF NOT EXISTS destinations_country_sort_idx ON public.destinations (country, sort_order);

-- ============================================================
-- 12. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ---------- profiles ----------
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- ---------- properties ----------
DROP POLICY IF EXISTS "Properties are viewable by everyone" ON public.properties;
CREATE POLICY "Properties are viewable by everyone" ON public.properties
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert properties" ON public.properties;
CREATE POLICY "Authenticated users can insert properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update their properties" ON public.properties;
CREATE POLICY "Owners can update their properties" ON public.properties
  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete their properties" ON public.properties;
CREATE POLICY "Owners can delete their properties" ON public.properties
  FOR DELETE USING (auth.uid() = owner_id);

-- ---------- favorites ----------
DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorites;
CREATE POLICY "Users can insert own favorites" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorites;
CREATE POLICY "Users can delete own favorites" ON public.favorites
  FOR DELETE USING (auth.uid() = user_id);

-- ---------- bookings ----------
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() IN (SELECT owner_id FROM public.properties WHERE id = property_id)
  );

DROP POLICY IF EXISTS "Users can insert own bookings" ON public.bookings;
CREATE POLICY "Users can insert own bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
CREATE POLICY "Users can update own bookings" ON public.bookings
  FOR UPDATE USING (
    auth.uid() = user_id OR
    auth.uid() IN (SELECT owner_id FROM public.properties WHERE id = property_id)
  ) WITH CHECK (
    auth.uid() = user_id OR
    auth.uid() IN (SELECT owner_id FROM public.properties WHERE id = property_id)
  );

DROP POLICY IF EXISTS "Users can delete own bookings" ON public.bookings;
CREATE POLICY "Users can delete own bookings" ON public.bookings
  FOR DELETE USING (auth.uid() = user_id);

-- ---------- comments ----------
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable by everyone" ON public.comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.comments;
CREATE POLICY "Authenticated users can insert comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
CREATE POLICY "Users can update own comments" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

-- ---------- property_reports ----------
DROP POLICY IF EXISTS "Anyone can create property reports" ON public.property_reports;
CREATE POLICY "Anyone can create property reports" ON public.property_reports
  FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view property reports" ON public.property_reports;
CREATE POLICY "Authenticated users can view property reports" ON public.property_reports
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete property reports" ON public.property_reports;
CREATE POLICY "Authenticated users can delete property reports" ON public.property_reports
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can update property reports" ON public.property_reports;
CREATE POLICY "Authenticated users can update property reports" ON public.property_reports
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------- destinations ----------
DROP POLICY IF EXISTS "Destinations are viewable by everyone" ON public.destinations;
CREATE POLICY "Destinations are viewable by everyone" ON public.destinations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert destinations" ON public.destinations;
CREATE POLICY "Authenticated users can insert destinations" ON public.destinations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update destinations" ON public.destinations;
CREATE POLICY "Authenticated users can update destinations" ON public.destinations
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete destinations" ON public.destinations;
CREATE POLICY "Authenticated users can delete destinations" ON public.destinations
  FOR DELETE USING (auth.role() = 'authenticated');

-- ---------- countries ----------
DROP POLICY IF EXISTS "Countries are publicly readable" ON public.countries;
CREATE POLICY "Countries are publicly readable" ON public.countries
  FOR SELECT USING (true);

-- ---------- promo_codes ----------
-- Deny everything to clients; the Admin panel uses service_role
-- (bypasses RLS) and the app only reads codes through the
-- SECURITY DEFINER function validate_promo_code().
DROP POLICY IF EXISTS "No direct access to promo_codes" ON public.promo_codes;
CREATE POLICY "No direct access to promo_codes" ON public.promo_codes
  FOR ALL USING (false) WITH CHECK (false);

-- ---------- subscriptions ----------
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can delete own subscriptions" ON public.subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 13. TRIGGERS — profile auto-create + updated_at
-- ============================================================

-- Auto-create a profile whenever a user signs up (OAuth included)
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for users created before this script ran
INSERT INTO public.profiles (id, full_name, avatar_url, phone)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
  raw_user_meta_data->>'avatar_url',
  COALESCE(phone, raw_user_meta_data->>'phone', raw_user_meta_data->>'phone_number')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Keep updated_at fresh on every UPDATE
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = timezone('utc', now());
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_properties_updated_at ON public.properties;
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_destinations_updated_at ON public.destinations;
CREATE TRIGGER update_destinations_updated_at
  BEFORE UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 14. FUNCTION: validate_promo_code (base price 100 MAD)
--     SECURITY DEFINER — clients cannot read the codes table.
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.promo_codes%ROWTYPE;
  v_base_price NUMERIC := 100;
  v_final_price NUMERIC;
BEGIN
  SELECT * INTO v_row
  FROM public.promo_codes
  WHERE code = UPPER(TRIM(p_code))
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR uses_count < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'كود الخصم غير صحيح أو منتهي الصلاحية'
    );
  END IF;

  UPDATE public.promo_codes
  SET uses_count = uses_count + 1
  WHERE id = v_row.id;

  v_final_price := ROUND(v_base_price * (1 - v_row.discount_percent::NUMERIC / 100), 2);

  RETURN jsonb_build_object(
    'valid', true,
    'discount_percent', v_row.discount_percent,
    'final_price', v_final_price,
    'description', v_row.description
  );
END;
$$;

-- ============================================================
-- 15. FUNCTION: update_property_rating (incremental average)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_property_rating(p_property_id UUID, p_rating INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rating NUMERIC;
  v_reviews INTEGER;
BEGIN
  SELECT COALESCE(rating, 0), COALESCE(reviews, 0) INTO v_rating, v_reviews
  FROM public.properties
  WHERE id = p_property_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_rating := ROUND(((v_rating * v_reviews + p_rating) / (v_reviews + 1)) * 10) / 10;

  UPDATE public.properties
  SET rating = v_rating, reviews = v_reviews + 1
  WHERE id = p_property_id;
END;
$$;

-- ============================================================
-- 16. FUNCTION: recalculate_property_rating (rebuild from comments)
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_property_rating(p_property_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rating NUMERIC;
  v_reviews INTEGER;
BEGIN
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO v_rating, v_reviews
  FROM public.comments
  WHERE property_id = p_property_id AND rating > 0;

  UPDATE public.properties
  SET rating = ROUND(v_rating * 10) / 10, reviews = v_reviews
  WHERE id = p_property_id;
END;
$$;

-- ============================================================
-- 17. FUNCTION: get_host_subscription_state
--     Reads profiles + subscriptions for the caller.
--     Called by the app (authenticated) and by the edge
--     function confirm-play-subscription (service_role).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_host_subscription_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_is_host BOOLEAN;
  v_active_until TIMESTAMPTZ;
  v_status TEXT;
  v_expiry_passed BOOLEAN;
BEGIN
  SELECT is_host, host_active_until INTO v_profile_is_host, v_active_until
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT status INTO v_status
  FROM public.subscriptions
  WHERE user_id = auth.uid()
  ORDER BY current_period_end DESC
  LIMIT 1;

  v_expiry_passed := v_active_until IS NOT NULL AND v_active_until <= now();

  RETURN jsonb_build_object(
    'is_host', COALESCE(v_profile_is_host, false) AND NOT v_expiry_passed,
    'host_active_until', v_active_until,
    'status', CASE
      WHEN COALESCE(v_profile_is_host, false) AND NOT v_expiry_passed THEN COALESCE(v_status, 'active')
      ELSE 'none'
    END,
    'checked_at', now()
  );
END;
$$;

-- ============================================================
-- 18. FUNCTION: delete_my_account
--     Deletes everything for the caller. Storage and auth-user
--     deletion are wrapped in exception blocks so the rest of
--     the cleanup still succeeds even if one step is denied.
-- ============================================================
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
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Storage images in this user's folder
  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'property-images'
      AND (storage.foldername(name))[1] = me::text;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Storage cleanup skipped: %', SQLERRM;
  END;

  -- 2. Subscriptions
  DELETE FROM public.subscriptions WHERE user_id = me;

  -- 3. Profile (CASCADE removes properties, favorites, bookings, comments)
  DELETE FROM public.profiles WHERE id = me;

  -- 4. Hard-delete the auth user
  BEGIN
    DELETE FROM auth.users WHERE id = me;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'auth user deletion skipped: %', SQLERRM;
  END;
END;
$$;

-- ============================================================
-- 19. FUNCTION GRANTS
-- ============================================================
REVOKE ALL ON FUNCTION public.validate_promo_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_property_rating(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_property_rating(UUID, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.recalculate_property_rating(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_property_rating(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_host_subscription_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_host_subscription_state() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated, service_role;

-- ============================================================
-- 20. STORAGE BUCKETS (all public)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('property-images', 'property-images', true),
  ('destination-images', 'destination-images', true),
  ('country-images', 'country-images', true)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets SET public = true
WHERE id IN ('property-images', 'destination-images', 'country-images');

-- property-images: public read + each user manages their own folder
DROP POLICY IF EXISTS "Property images are publicly accessible" ON storage.objects;
CREATE POLICY "Property images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "Authenticated users can upload property images" ON storage.objects;
CREATE POLICY "Authenticated users can upload property images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-images' AND
    auth.role() = 'authenticated' AND
    (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their own property images" ON storage.objects;
CREATE POLICY "Users can update their own property images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'property-images' AND
    (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own property images" ON storage.objects;
CREATE POLICY "Users can delete their own property images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'property-images' AND
    (auth.uid())::text = (storage.foldername(name))[1]
  );

-- destination-images: public read (Admin uploads via service_role)
DROP POLICY IF EXISTS "Destination images are publicly accessible" ON storage.objects;
CREATE POLICY "Destination images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'destination-images');

-- country-images: public read (Admin uploads via service_role)
DROP POLICY IF EXISTS "Country images are publicly accessible" ON storage.objects;
CREATE POLICY "Country images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'country-images');

-- ============================================================
-- 21. REALTIME — destinations appear instantly in the app
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'destinations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.destinations;
  END IF;
END $$;

-- ============================================================
-- 22. SEED PROMO CODES
-- ============================================================
INSERT INTO public.promo_codes (code, discount_percent, description, max_uses)
VALUES
  ('FREE',    100, 'كود تفعيل مجاني 100%', NULL),
  ('MAJANI',  100, 'كود تفعيل مجاني 100%', NULL),
  ('SAKAN50', 50,  'خصم 50% - السعر 50 درهم', NULL),
  ('OFF50',   50,  'خصم 50% - السعر 50 درهم', NULL)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 23. TABLE GRANTS
--     (RLS still controls which rows each role can touch.)
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================
-- 24. ONE-TIME RATING REBUILD (safe to re-run)
-- ============================================================
UPDATE public.properties p
SET rating = COALESCE(
      (SELECT ROUND(AVG(c.rating) * 10) / 10
       FROM public.comments c
       WHERE c.property_id = p.id AND c.rating > 0),
      0
    ),
    reviews = (
      SELECT COUNT(*)
      FROM public.comments c
      WHERE c.property_id = p.id AND c.rating > 0
    );

-- ============================================================
-- 25. MANDATORY NEXT STEP — APPLY THE SECURITY HARDENING MIGRATION
-- ============================================================
-- Everything above this point is the ORIGINAL, INSECURE setup. Do not stop
-- here. Run the following file immediately afterwards:
--
--   dydlye/supabase/migrations/20260926000000_security_hardening.sql
--
-- It replaces the permissive policies, adds the is_admin()/is_active_host()
-- helpers, moves bookings to the create_booking() RPC, protects comment
-- ratings and author names, adds the server-owned product_prices table and
-- the delete_my_account() RPC.
--
-- Via the CLI:
--   supabase db push
-- Or paste the migration into the SQL editor right after this file.
--
-- TODO STILL ON YOU (not doable from SQL):
--   * Rotate the exposed service_role key in the Supabase Dashboard.
--   * Publish the admin-api Edge Function.
--   * Insert the first admin row (there is deliberately no default one):
--       INSERT INTO public.admins (user_id, email, note)
--       SELECT id, email, 'initial owner' FROM auth.users
--       WHERE email = 'you@example.com'
--       ON CONFLICT (user_id) DO NOTHING;
-- ============================================================

-- ============================================================
-- DONE — verify with these (optional):
--   SELECT tablename FROM pg_tables
--     WHERE schemaname = 'public' ORDER BY tablename;
--   SELECT COUNT(*) FROM public.promo_codes;
--   SELECT proname, proacl FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--     WHERE n.nspname = 'public' AND proname IN
--       ('is_admin','is_active_host','owns_property','create_booking',
--        'cancel_my_booking','validate_promo_code','redeem_promo_code');
-- ============================================================
