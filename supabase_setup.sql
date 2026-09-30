-- ==========================================================
-- Dydlye - DATABASE SETUP SCRIPT (SUPABASE)
-- ==========================================================
-- THIS IS THE ONE AND ONLY SETUP FILE — RUN IT ALL IN:
--   Supabase Dashboard > SQL Editor > New query
-- Safe to run multiple times (idempotent).
--
-- It creates everything:
--   1. Tables: profiles, properties, favorites, bookings,
--      destinations, promo_codes, comments, property_reports
--   2. RLS + policies for all tables
--   3. Triggers (profile auto-create, updated_at)
--   4. Storage buckets: property-images + destination-images
--   5. Secure functions: validate_promo_code (base 100 MAD),
--      update_property_rating, recalculate_property_rating
--   6. Realtime for destinations
--   7. One-time rating recompute fix

-- ==========================================================
-- 1. Create Profiles Table (Linked to Auth)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- is_host flag (host upgrade feature)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_host BOOLEAN NOT NULL DEFAULT false;

-- blocked flag (admin block-users feature)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;

-- ==========================================================
-- 2. Create Properties Table
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================================
-- 3. Create Favorites Table (M-N Relationship)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, property_id)
);

-- ==========================================================
-- 4. Create Bookings Table
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_ref TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Payment columns for older installations (idempotent)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_ref TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- ==========================================================
-- 5. Enable Row Level Security (RLS)
-- ==========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 6. Row Level Security Policies (Idempotent Setup)
-- ==========================================================

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to upgrade themselves to host (set is_host = true)
DROP POLICY IF EXISTS "Users can upgrade to host" ON public.profiles;
CREATE POLICY "Users can upgrade to host" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- PROPERTIES POLICIES
DROP POLICY IF EXISTS "Properties are viewable by everyone" ON public.properties;
CREATE POLICY "Properties are viewable by everyone" ON public.properties
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert properties" ON public.properties;
CREATE POLICY "Authenticated users can insert properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update their properties" ON public.properties;
CREATE POLICY "Owners can update their properties" ON public.properties
  FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete their properties" ON public.properties;
CREATE POLICY "Owners can delete their properties" ON public.properties
  FOR DELETE USING (auth.uid() = owner_id);

-- FAVORITES POLICIES
DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorites;
CREATE POLICY "Users can insert own favorites" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorites;
CREATE POLICY "Users can delete own favorites" ON public.favorites
  FOR DELETE USING (auth.uid() = user_id);

-- BOOKINGS POLICIES
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
  );

DROP POLICY IF EXISTS "Users can delete own bookings" ON public.bookings;
CREATE POLICY "Users can delete own bookings" ON public.bookings
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================================
-- 7. Functions & Triggers (Profile Automation & Sync)
-- ==========================================================

-- Function to handle new user signup and extract details (name, avatar, phone)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.phone, new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'phone_number')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run on user creation (dropped if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sync existing users who signed up before the trigger was created
INSERT INTO public.profiles (id, full_name, avatar_url, phone)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'), 
  raw_user_meta_data->>'avatar_url',
  COALESCE(phone, raw_user_meta_data->>'phone', raw_user_meta_data->>'phone_number')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ==========================================================
-- 8. Automated updated_at Column Triggers
-- ==========================================================

-- Function to automatically set updated_at to the current time
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  new.updated_at = timezone('utc'::text, now());
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for properties updated_at
DROP TRIGGER IF EXISTS update_properties_updated_at ON public.properties;
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================================
-- 9. Storage Setup — Property Images Bucket
-- ==========================================================

-- Create the public bucket for property images if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

-- STORAGE POLICIES (Dropped if exists first to avoid duplicate errors)

-- 1. Public read access to all images
DROP POLICY IF EXISTS "Property images are publicly accessible" ON storage.objects;
CREATE POLICY "Property images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'property-images');

-- 2. Authenticated users can upload images to their own directory in the bucket
DROP POLICY IF EXISTS "Authenticated users can upload property images" ON storage.objects;
CREATE POLICY "Authenticated users can upload property images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-images' AND 
    auth.role() = 'authenticated' AND
    (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 3. Users can update their own uploaded images
DROP POLICY IF EXISTS "Users can update their own property images" ON storage.objects;
CREATE POLICY "Users can update their own property images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'property-images' AND 
    (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 4. Users can delete their own uploaded images
DROP POLICY IF EXISTS "Users can delete their own property images" ON storage.objects;
CREATE POLICY "Users can delete their own property images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'property-images' AND 
    (auth.uid())::text = (storage.foldername(name))[1]
  );

-- ==========================================================
-- 10. Storage Setup — Destination Images Bucket
--     (used by the separate admin system; public so the
--     dydlye app can display the images)
-- ==========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('destination-images', 'destination-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
DROP POLICY IF EXISTS "Destination images are publicly accessible" ON storage.objects;
CREATE POLICY "Destination images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'destination-images');

-- ==========================================================
-- 11. Create Destinations Table (Tourist Attractions)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.destinations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('مسبح', 'معلم سياحي', 'مقهى', 'مطعم', 'حفلة', 'تسوق', 'طبيعة', 'ترفيه', 'شاطئ', 'رياضة', 'حمام تقليدي')),
  city TEXT NOT NULL,
  location TEXT,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  images TEXT[] DEFAULT '{}',
  phone TEXT,
  opening_hours TEXT,
  rating NUMERIC DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Destinations are viewable by everyone" ON public.destinations;
CREATE POLICY "Destinations are viewable by everyone" ON public.destinations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert destinations" ON public.destinations;
CREATE POLICY "Authenticated users can insert destinations" ON public.destinations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update destinations" ON public.destinations;
CREATE POLICY "Authenticated users can update destinations" ON public.destinations
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete destinations" ON public.destinations;
CREATE POLICY "Authenticated users can delete destinations" ON public.destinations
  FOR DELETE USING (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS update_destinations_updated_at ON public.destinations;
CREATE TRIGGER update_destinations_updated_at
  BEFORE UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime for destinations (new ones appear instantly)
-- Safe to run repeatedly — skips if already enabled.
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

-- ==========================================================
-- 12. Promo Codes Table (Secure - Never Exposed to Client)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 0 AND 100),
  description TEXT,
  max_uses INTEGER DEFAULT NULL,       -- NULL = unlimited
  uses_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS — no user can read codes directly from the table
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Drop any old policies
DROP POLICY IF EXISTS "No direct read access to promo_codes" ON public.promo_codes;

-- Deny all direct SELECT/INSERT/UPDATE/DELETE from clients
CREATE POLICY "No direct read access to promo_codes"
  ON public.promo_codes
  FOR ALL
  USING (false);

-- ==========================================================
-- 13. Secure Function: validate_promo_code
--     Runs as DB owner (SECURITY DEFINER) — client cannot
--     see the actual codes table, only the result.
--     Base price: 100 MAD
-- ==========================================================
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

  -- Increment usage count
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

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.validate_promo_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(TEXT) TO authenticated;

-- ==========================================================
-- 14. Seed Default Promo Codes (Edit as needed)
-- ==========================================================
INSERT INTO public.promo_codes (code, discount_percent, description, max_uses)
VALUES
  ('FREE',    100, 'كود تفعيل مجاني 100%', NULL),
  ('MAJANI',  100, 'كود تفعيل مجاني 100%', NULL),
  ('SAKAN50', 50,  'خصم 50% - السعر 50 درهم', NULL),
  ('OFF50',   50,  'خصم 50% - السعر 50 درهم', NULL)
ON CONFLICT (code) DO NOTHING;

-- ==========================================================
-- 15. Comments Table (Property Reviews)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  rating INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS comments_property_id_idx ON public.comments (property_id);
CREATE INDEX IF NOT EXISTS comments_user_id_idx ON public.comments (user_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable by everyone" ON public.comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.comments;
CREATE POLICY "Authenticated users can insert comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
CREATE POLICY "Users can update own comments" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================================
-- 16. Secure Function: update_property_rating
--     SECURITY DEFINER so any authenticated user can update the
--     aggregate rating/reviews of a property after commenting.
-- ==========================================================
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

REVOKE ALL ON FUNCTION public.update_property_rating(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_property_rating(UUID, INTEGER) TO authenticated;

-- ==========================================================
-- 17. Secure Function: recalculate_property_rating
--     Recomputes a property's rating/reviews from its comments
--     (needed after a comment is deleted). SECURITY DEFINER so
--     any authenticated user can call it.
-- ==========================================================
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

REVOKE ALL ON FUNCTION public.recalculate_property_rating(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_property_rating(UUID) TO authenticated;

-- ==========================================================
-- 18. One-time fix: recompute all existing properties from
--     their current comments (fixes stale ratings after
--     comment deletes). Safe to re-run.
-- ==========================================================
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

-- ==========================================================
-- 19. Property Reports Table (بلاغات العقارات)
--     The admin system reads and resolves reports using the
--     status column (new / reviewed / resolved).
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.property_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- For tables created by older scripts without the status column:
ALTER TABLE public.property_reports
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';

ALTER TABLE public.property_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (even guests) can submit a report
DROP POLICY IF EXISTS "Anyone can create property reports" ON public.property_reports;
CREATE POLICY "Anyone can create property reports" ON public.property_reports
  FOR INSERT TO authenticated, anon WITH CHECK (true);

-- Reports are visible to logged-in users (owners / admins)
DROP POLICY IF EXISTS "Authenticated users can view property reports" ON public.property_reports;
CREATE POLICY "Authenticated users can view property reports" ON public.property_reports
  FOR SELECT TO authenticated USING (true);

-- Logged-in users can delete reports
DROP POLICY IF EXISTS "Authenticated users can delete property reports" ON public.property_reports;
CREATE POLICY "Authenticated users can delete property reports" ON public.property_reports
  FOR DELETE TO authenticated USING (true);

-- ==========================================================
-- 20. Host Subscription (Google Play Billing)
--     The app purchases a monthly subscription via Google Play
--     Billing, sends the purchase token to the edge function
--     `confirm-play-subscription`, which validates it against the
--     Google Play Developer API and then grants host status here.
-- ==========================================================

-- When the host subscription expires / is revoked
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS host_active_until TIMESTAMPTZ;

-- Table of validated Google Play subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
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

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_product_idx ON public.subscriptions (user_id, product_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions (user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscription records
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- RPC: current user's host-subscription state.
-- SECURITY DEFINER — reads profiles + subscriptions for the caller
-- and computes whether host status is currently active.
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

REVOKE ALL ON FUNCTION public.get_host_subscription_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_host_subscription_state() TO authenticated;

-- ==========================================================
-- 18. Delete-Account RPC (no Edge Function required)
--     SECURITY DEFINER so the authenticated caller can delete
--     their own profile, all related rows, storage, and the
--     auth user itself. Any authenticated user may call it,
--     but it only ever acts on auth.uid().
-- ==========================================================
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

  -- 1. Delete uploaded property images for this user
  DELETE FROM storage.objects
  WHERE bucket_id = 'property-images'
    AND (storage.foldername(name))[1] = me::text;

  -- 2. Delete subscriptions
  DELETE FROM public.subscriptions WHERE user_id = me;

  -- 3. Delete the profile — ON DELETE CASCADE removes
  --    properties, favorites, bookings, and comments
  DELETE FROM public.profiles WHERE id = me;

  -- 4. Hard-delete the auth user
  DELETE FROM auth.users WHERE id = me;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ==========================================================
-- DONE — Dydlye database is fully set up.
-- ==========================================================