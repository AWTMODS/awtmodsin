-- ==============================================================================
-- PLAY STORE VERSION RADAR & MODDING WORKFLOW SYSTEM
-- Migration: 20261119_playstore_version_radar.sql
-- ==============================================================================

-- 1. Tracked Applications Table
CREATE TABLE IF NOT EXISTS public.radar_tracked_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_name TEXT NOT NULL UNIQUE,
    app_name TEXT NOT NULL,
    play_store_url TEXT NOT NULL,
    icon_url TEXT,
    developer TEXT,
    category TEXT DEFAULT 'Tools',
    current_play_store_version TEXT DEFAULT 'v1.0.0',
    last_detected_version TEXT,
    is_active_tracking BOOLEAN DEFAULT TRUE,
    workflow_status TEXT NOT NULL DEFAULT 'UPDATE_DETECTED' 
        CHECK (workflow_status IN ('UPDATE_DETECTED', 'MODDING_STARTED', 'MODDED_COMPLETED', 'READY_TO_PUBLISH', 'MOD_RELEASED')),
    last_scanned_at TIMESTAMPTZ DEFAULT NOW(),
    last_detected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_tracked_apps_pkg ON public.radar_tracked_apps(package_name);
CREATE INDEX IF NOT EXISTS idx_radar_tracked_apps_status ON public.radar_tracked_apps(workflow_status);
CREATE INDEX IF NOT EXISTS idx_radar_tracked_apps_active ON public.radar_tracked_apps(is_active_tracking);

-- 2. Modding Cycles Table (Preserves every modding & release iteration)
CREATE TABLE IF NOT EXISTS public.radar_modding_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radar_app_id UUID NOT NULL REFERENCES public.radar_tracked_apps(id) ON DELETE CASCADE,
    cycle_number INT NOT NULL DEFAULT 1,
    target_play_store_version TEXT NOT NULL,
    mod_version TEXT,
    workflow_status TEXT NOT NULL DEFAULT 'UPDATE_DETECTED'
        CHECK (workflow_status IN ('UPDATE_DETECTED', 'MODDING_STARTED', 'MODDED_COMPLETED', 'READY_TO_PUBLISH', 'MOD_RELEASED')),
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    assigned_modder TEXT DEFAULT 'Aadith C V',
    modding_started_at TIMESTAMPTZ,
    modded_completed_at TIMESTAMPTZ,
    ready_to_publish_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    download_url TEXT,
    changelog TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_cycles_app_id ON public.radar_modding_cycles(radar_app_id);
CREATE INDEX IF NOT EXISTS idx_radar_cycles_status ON public.radar_modding_cycles(workflow_status);

-- 3. Modding Remarks & Instructions Table (Private, multiline, timestamped, admin attributed)
CREATE TABLE IF NOT EXISTS public.radar_remarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radar_app_id UUID NOT NULL REFERENCES public.radar_tracked_apps(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES public.radar_modding_cycles(id) ON DELETE CASCADE,
    admin_name TEXT NOT NULL DEFAULT 'Admin',
    remarks TEXT NOT NULL,
    internal_instructions TEXT,
    required_modifications TEXT,
    known_issues TEXT,
    testing_requirements TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_remarks_app_id ON public.radar_remarks(radar_app_id);

-- 4. Modding Activity Logs (Full audit trail of status changes)
CREATE TABLE IF NOT EXISTS public.radar_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radar_app_id UUID NOT NULL REFERENCES public.radar_tracked_apps(id) ON DELETE CASCADE,
    app_name TEXT NOT NULL,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    performed_by TEXT NOT NULL DEFAULT 'Admin',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_activity_app_id ON public.radar_activity_logs(radar_app_id);
CREATE INDEX IF NOT EXISTS idx_radar_activity_created ON public.radar_activity_logs(created_at DESC);

-- 5. Radar Releases History Table (Logical archive of all completed releases)
CREATE TABLE IF NOT EXISTS public.radar_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    radar_app_id UUID NOT NULL REFERENCES public.radar_tracked_apps(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES public.radar_modding_cycles(id) ON DELETE SET NULL,
    app_name TEXT NOT NULL,
    package_name TEXT NOT NULL,
    icon_url TEXT,
    original_play_store_version TEXT NOT NULL,
    released_mod_version TEXT NOT NULL,
    download_url TEXT NOT NULL,
    changelog TEXT,
    release_remarks TEXT,
    released_by TEXT NOT NULL DEFAULT 'Admin',
    released_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_releases_app_id ON public.radar_releases(radar_app_id);
CREATE INDEX IF NOT EXISTS idx_radar_releases_pkg ON public.radar_releases(package_name);
CREATE INDEX IF NOT EXISTS idx_radar_releases_released_at ON public.radar_releases(released_at DESC);

-- 6. Scanner Execution Logs Table
CREATE TABLE IF NOT EXISTS public.radar_scanner_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_type TEXT NOT NULL DEFAULT 'cron' CHECK (trigger_type IN ('cron', 'manual', 'webhook')),
    scanned_count INT NOT NULL DEFAULT 0,
    updates_detected INT NOT NULL DEFAULT 0,
    errors_count INT NOT NULL DEFAULT 0,
    details JSONB DEFAULT '{}'::jsonb,
    error_summary TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_scanner_logs_time ON public.radar_scanner_logs(executed_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.radar_tracked_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_modding_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_scanner_logs ENABLE ROW LEVEL SECURITY;

-- Allow Service Role and authenticated admin full control
DO $$
BEGIN
    DROP POLICY IF EXISTS "Radar apps full access for admin and service" ON public.radar_tracked_apps;
    CREATE POLICY "Radar apps full access for admin and service" ON public.radar_tracked_apps FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Radar cycles full access" ON public.radar_modding_cycles;
    CREATE POLICY "Radar cycles full access" ON public.radar_modding_cycles FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Radar remarks full access" ON public.radar_remarks;
    CREATE POLICY "Radar remarks full access" ON public.radar_remarks FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Radar activity full access" ON public.radar_activity_logs;
    CREATE POLICY "Radar activity full access" ON public.radar_activity_logs FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Radar releases full access" ON public.radar_releases;
    CREATE POLICY "Radar releases full access" ON public.radar_releases FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Radar scanner logs full access" ON public.radar_scanner_logs;
    CREATE POLICY "Radar scanner logs full access" ON public.radar_scanner_logs FOR ALL USING (true) WITH CHECK (true);
END $$;
