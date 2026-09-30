-- ==========================================================
-- Dydlye ADMIN - DATABASE SETUP (RUN IN SUPABASE SQL EDITOR)
-- ==========================================================
-- Run in: Supabase Dashboard > SQL Editor > New query
-- Safe to run multiple times (idempotent).
-- Note: the admin app uses the SERVICE ROLE key, so it bypasses
-- RLS and storage policies entirely — no login needed.

-- 1. Create destination-images storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('destination-images', 'destination-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Public read access (so the dydlye app can load the images)
DROP POLICY IF EXISTS "Destination images are publicly accessible" ON storage.objects;
CREATE POLICY "Destination images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'destination-images');

-- 3. Add blocked column to profiles (for the admin block-users feature)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

-- 4. Property reports table (بلاغات العقارات)
-- The Dydlye app creates and inserts into this table; the admin reads
-- and resolves reports. This keeps the admin-only status column in sync.
CREATE TABLE IF NOT EXISTS property_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reason text,
  details text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- For tables created by the Dydlye app without the status column:
ALTER TABLE property_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

ALTER TABLE property_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create property reports" ON property_reports;
CREATE POLICY "Anyone can create property reports" ON property_reports
  FOR INSERT WITH CHECK (true);

-- 5. Allow the new "شلالات" destination category (the app validates
--    categories itself via DESTINATION_CATEGORIES in src/lib/types.ts)
ALTER TABLE destinations
  DROP CONSTRAINT IF EXISTS destinations_category_check;

-- 6. Countries (الدول) + destination ordering
CREATE TABLE IF NOT EXISTS countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  image text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Countries are publicly readable" ON countries;
CREATE POLICY "Countries are publicly readable" ON countries
  FOR SELECT USING (true);

-- Destination belongs to a country (by name) and has a display order
ALTER TABLE destinations
  ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE destinations
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 7. country-images storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('country-images', 'country-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Country images are publicly accessible" ON storage.objects;
CREATE POLICY "Country images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'country-images');