-- =============================================================================
-- Migration: add marca + emoji columns to catalog_items
-- Run this ONCE in Supabase → SQL Editor before running seed.sql.
-- =============================================================================

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS marca  TEXT,
  ADD COLUMN IF NOT EXISTS emoji  TEXT;
