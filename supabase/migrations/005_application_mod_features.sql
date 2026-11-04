-- =====================================================
-- Migration 005: Custom Mod Features Column & RPC Update
-- Adds mod_features JSONB to public.applications and
-- updates admin_save_application RPC to persist custom features.
-- =====================================================

ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS mod_features JSONB DEFAULT '[]'::jsonb;

-- Update existing Spotify and Minecraft with appropriate features
UPDATE public.applications
SET mod_features = jsonb_build_array(
  'Premium Unlocked (No Subscription)',
  'Ad-Free Clean Experience',
  'Play Any Song / Unlimited Skips',
  'High-Quality Audio & Bitrate',
  'Spotify Connect Unlocked',
  'Lightweight & Battery Efficient'
)
WHERE slug LIKE 'spotify%';

UPDATE public.applications
SET mod_features = jsonb_build_array(
  'Immortal / God Mode',
  'All Premium Skins Unlocked',
  'All Textures Unlocked',
  'Unlimited Breath & Health',
  'Max Inventory Capacity',
  'No Damage From Falling'
)
WHERE slug LIKE 'minecraft%';

UPDATE public.applications
SET mod_features = jsonb_build_array(
  'All Features Unlocked',
  'Ad-Free Clean Experience',
  'Verified Safe APK Build',
  'High Performance & Smooth'
)
WHERE mod_features IS NULL OR mod_features = '[]'::jsonb;

-- Update admin_save_application RPC function
CREATE OR REPLACE FUNCTION public.admin_save_application(
  p_app JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_app_id UUID;
  v_version_id UUID;
  v_src JSONB;
  v_scr TEXT;
  v_idx INT := 0;
  v_result JSONB;
BEGIN
  -- 1. Insert or update application
  IF p_app->>'id' IS NOT NULL AND (p_app->>'id') ~ '^[0-9a-fA-F-]{36}$' THEN
    v_app_id := (p_app->>'id')::uuid;
    UPDATE public.applications SET
      name = COALESCE(p_app->>'name', name),
      slug = COALESCE(p_app->>'slug', slug),
      package_name = COALESCE(p_app->>'package_name', package_name),
      developer = COALESCE(p_app->>'developer', developer),
      category_id = COALESCE((p_app->>'category_id')::uuid, category_id),
      short_description = COALESCE(p_app->>'short_description', short_description),
      description = COALESCE(p_app->>'description', description),
      icon_url = COALESCE(p_app->>'icon_url', icon_url),
      banner_url = COALESCE(p_app->>'banner_url', banner_url),
      android_requirement = COALESCE(p_app->>'android_requirement', android_requirement),
      is_featured = COALESCE((p_app->>'is_featured')::boolean, is_featured),
      is_trending = COALESCE((p_app->>'is_trending')::boolean, is_trending),
      status = COALESCE(p_app->>'status', status),
      rating = COALESCE((p_app->>'rating')::numeric, rating),
      reviews_count = COALESCE((p_app->>'reviews_count')::int, reviews_count),
      mod_features = CASE 
        WHEN p_app ? 'mod_features' THEN p_app->'mod_features'
        ELSE mod_features
      END,
      updated_at = NOW()
    WHERE id = v_app_id;
  ELSE
    INSERT INTO public.applications (
      name, slug, package_name, developer, category_id,
      short_description, description, icon_url, banner_url,
      android_requirement, is_featured, is_trending, status,
      rating, reviews_count, mod_features
    )
    VALUES (
      p_app->>'name',
      p_app->>'slug',
      p_app->>'package_name',
      p_app->>'developer',
      (p_app->>'category_id')::uuid,
      p_app->>'short_description',
      p_app->>'description',
      p_app->>'icon_url',
      p_app->>'banner_url',
      COALESCE(p_app->>'android_requirement', 'Android 7.0+'),
      COALESCE((p_app->>'is_featured')::boolean, false),
      COALESCE((p_app->>'is_trending')::boolean, false),
      COALESCE(p_app->>'status', 'published'),
      COALESCE((p_app->>'rating')::numeric, 0.0),
      COALESCE((p_app->>'reviews_count')::int, 0),
      COALESCE(p_app->'mod_features', '[]'::jsonb)
    )
    RETURNING id INTO v_app_id;
  END IF;

  -- 2. Handle Version
  IF p_app->'version' IS NOT NULL THEN
    UPDATE public.application_versions SET is_latest = false WHERE application_id = v_app_id;

    INSERT INTO public.application_versions (
      application_id, version_name, version_code, file_size,
      architecture, android_requirement, sha256, release_notes,
      is_latest, status
    )
    VALUES (
      v_app_id,
      COALESCE(p_app->'version'->>'version_name', 'v1.0.0'),
      COALESCE((p_app->'version'->>'version_code')::int, 1),
      COALESCE(p_app->'version'->>'file_size', '50 MB'),
      COALESCE(p_app->'version'->>'architecture', 'arm64-v8a'),
      COALESCE(p_app->'version'->>'android_requirement', 'Android 7.0+'),
      p_app->'version'->>'sha256',
      COALESCE(p_app->'version'->>'release_notes', 'Initial release'),
      true,
      'published'
    )
    RETURNING id INTO v_version_id;

    -- 3. Handle Download Sources
    IF p_app->'version'->'download_sources' IS NOT NULL THEN
      FOR v_src IN SELECT * FROM jsonb_array_elements(p_app->'version'->'download_sources')
      LOOP
        INSERT INTO public.download_sources (
          version_id, download_type, hosting_provider,
          download_url, mirror_name, is_primary, is_active
        )
        VALUES (
          v_version_id,
          COALESCE(v_src->>'download_type', 'external'),
          COALESCE(v_src->>'hosting_provider', 'mediafire'),
          v_src->>'download_url',
          COALESCE(v_src->>'mirror_name', 'Primary Mirror'),
          COALESCE((v_src->>'is_primary')::boolean, true),
          COALESCE((v_src->>'is_active')::boolean, true)
        );
      END LOOP;
    END IF;
  END IF;

  -- 4. Handle Screenshots
  IF p_app->'screenshots' IS NOT NULL THEN
    DELETE FROM public.application_screenshots WHERE application_id = v_app_id;
    FOR v_scr IN SELECT jsonb_array_elements_text(p_app->'screenshots')
    LOOP
      INSERT INTO public.application_screenshots (
        application_id, image_url, sort_order
      )
      VALUES (
        v_app_id,
        v_scr,
        v_idx
      );
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  -- Return the saved application
  SELECT jsonb_build_object(
    'success', true,
    'app', row_to_json(a)
  ) INTO v_result
  FROM public.applications a
  WHERE a.id = v_app_id;

  RETURN v_result;
END;
$$;

