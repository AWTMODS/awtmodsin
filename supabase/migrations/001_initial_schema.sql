-- =====================================================
-- AWTMods Initial Database Schema
-- Supabase PostgreSQL Migration
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'AppWindow',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    package_name VARCHAR(255) NOT NULL,
    developer VARCHAR(255) NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    short_description TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_url TEXT NOT NULL,
    banner_url TEXT,
    android_requirement VARCHAR(50) DEFAULT 'Android 7.0+',
    is_featured BOOLEAN DEFAULT false,
    is_trending BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('published', 'draft', 'archived')),
    rating NUMERIC(2, 1) DEFAULT 4.8,
    reviews_count INT DEFAULT 1200,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. APPLICATION VERSIONS TABLE
CREATE TABLE IF NOT EXISTS application_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    version_name VARCHAR(50) NOT NULL,
    version_code INT DEFAULT 1,
    file_size VARCHAR(50) NOT NULL,
    architecture VARCHAR(50) DEFAULT 'arm64-v8a',
    android_requirement VARCHAR(50) DEFAULT 'Android 7.0+',
    sha256 VARCHAR(64),
    release_notes TEXT,
    is_latest BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('published', 'draft', 'disabled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DOWNLOAD SOURCES TABLE
CREATE TABLE IF NOT EXISTS download_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES application_versions(id) ON DELETE CASCADE,
    download_type VARCHAR(20) NOT NULL CHECK (download_type IN ('upload', 'external')),
    hosting_provider VARCHAR(50) NOT NULL CHECK (hosting_provider IN ('mediafire', 'google_drive', 'dropbox', 'mega', 'telegram', 'custom', 'cloudflare_r2', 'supabase_storage')),
    download_url TEXT NOT NULL,
    storage_key TEXT,
    mirror_name VARCHAR(100),
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SCREENSHOTS TABLE
CREATE TABLE IF NOT EXISTS screenshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. DOWNLOADS ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES application_versions(id) ON DELETE CASCADE,
    download_source_id UUID REFERENCES download_sources(id) ON DELETE SET NULL,
    event_type VARCHAR(50) DEFAULT 'initiated',
    ip_hash VARCHAR(64),
    user_agent TEXT,
    downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. USER REPORTS TABLE
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('broken_link', 'incorrect_info', 'outdated_version', 'dmca', 'security', 'other')),
    email VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ADMINS TABLE
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SITE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS site_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ADMIN ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_apps_slug ON applications(slug);
CREATE INDEX IF NOT EXISTS idx_apps_category ON applications(category_id);
CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_apps_is_featured ON applications(is_featured);
CREATE INDEX IF NOT EXISTS idx_apps_is_trending ON applications(is_trending);
CREATE INDEX IF NOT EXISTS idx_versions_app_id ON application_versions(application_id);
CREATE INDEX IF NOT EXISTS idx_sources_version_id ON download_sources(version_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_app_id ON screenshots(application_id);
CREATE INDEX IF NOT EXISTS idx_downloads_app_id ON downloads(application_id);
CREATE INDEX IF NOT EXISTS idx_downloads_time ON downloads(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Public can read active categories
CREATE POLICY "Public read active categories" ON categories
    FOR SELECT USING (is_active = true);

-- Public can read published applications
CREATE POLICY "Public read published applications" ON applications
    FOR SELECT USING (status = 'published');

-- Public can read published application versions
CREATE POLICY "Public read published versions" ON application_versions
    FOR SELECT USING (status = 'published');

-- Public can read active download sources
CREATE POLICY "Public read active download sources" ON download_sources
    FOR SELECT USING (is_active = true);

-- Public can read screenshots
CREATE POLICY "Public read screenshots" ON screenshots
    FOR SELECT USING (true);

-- Anyone can insert download events (rate-limited via API)
CREATE POLICY "Public insert download events" ON downloads
    FOR INSERT WITH CHECK (true);

-- Anyone can submit reports
CREATE POLICY "Public submit reports" ON reports
    FOR INSERT WITH CHECK (true);

-- Public can read public site settings
CREATE POLICY "Public read site settings" ON site_settings
    FOR SELECT USING (true);

-- Admins full access policy helper
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins 
        WHERE auth_user_id = auth.uid() 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policies for complete access
CREATE POLICY "Admin full access categories" ON categories FOR ALL USING (is_admin());
CREATE POLICY "Admin full access applications" ON applications FOR ALL USING (is_admin());
CREATE POLICY "Admin full access versions" ON application_versions FOR ALL USING (is_admin());
CREATE POLICY "Admin full access download sources" ON download_sources FOR ALL USING (is_admin());
CREATE POLICY "Admin full access screenshots" ON screenshots FOR ALL USING (is_admin());
CREATE POLICY "Admin full access downloads" ON downloads FOR ALL USING (is_admin());
CREATE POLICY "Admin full access reports" ON reports FOR ALL USING (is_admin());
CREATE POLICY "Admin full access admins" ON admins FOR ALL USING (is_admin());
CREATE POLICY "Admin full access settings" ON site_settings FOR ALL USING (is_admin());
CREATE POLICY "Admin full access activity logs" ON admin_activity_logs FOR ALL USING (is_admin());

