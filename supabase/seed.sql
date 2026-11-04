-- =====================================================
-- AWTMods Clean Production Seed Data
-- =====================================================

-- Insert Default Categories
INSERT INTO categories (id, name, slug, description, icon, sort_order, is_active)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'Music & Audio', 'music-audio', 'Streaming, player mods, sound boosters and audio editing apps', 'Music', 1, true),
    ('c2222222-2222-2222-2222-222222222222', 'Media & Video', 'media-video', 'Video players, video editing, streaming and screen recorders', 'Video', 2, true),
    ('c3333333-3333-3333-3333-333333333333', 'Social', 'social', 'Enhanced social media networks and chat applications', 'Users', 3, true),
    ('c4444444-4444-4444-4444-444444444444', 'Tools', 'tools', 'Utilities, system customizers, cleaners and file managers', 'Wrench', 4, true),
    ('c5555555-5555-5555-5555-555555555555', 'Photography', 'photography', 'Camera mods, photo editors and filter suites', 'Camera', 5, true),
    ('c6666666-6666-6666-6666-666666666666', 'Games', 'games', 'Action, arcade, RPG and modded Android mobile games', 'Gamepad2', 6, true),
    ('c7777777-7777-7777-7777-777777777777', 'Communication', 'communication', 'Encrypted messaging, VOIP and dialer modifications', 'MessageSquare', 7, true),
    ('c8888888-8888-8888-8888-888888888888', 'Productivity', 'productivity', 'Office suites, notes, automation and scanner utilities', 'FileText', 8, true),
    ('c9999999-9999-9999-9999-999999999999', 'Entertainment', 'entertainment', 'Comics, anime, movies and entertainment utilities', 'Film', 9, true),
    ('c0000000-0000-0000-0000-000000000000', 'Education', 'education', 'Learning, language courses, books and reference guides', 'BookOpen', 10, true)
ON CONFLICT (id) DO NOTHING;

-- Insert Default Site Settings
INSERT INTO site_settings (setting_key, setting_value)
VALUES
    ('general', '{
        "siteName": "AWTMods",
        "tagline": "Download Modded Apps & Premium APKs",
        "siteDescription": "Your trusted source for Android modded apps, premium APKs, tools, and unlocked features. Safe, fast and free.",
        "siteUrl": "https://www.awtmods.in",
        "logoText": "AWTMods",
        "contactEmail": "awtmods@gmail.com",
        "defaultTheme": "dark"
    }'::jsonb),
    ('social', '{
        "telegram": "https://t.me/awtmods",
        "instagram": "https://instagram.com/awtmods",
        "youtube": "https://youtube.com/@awtmods",
        "twitter": "https://x.com/awtmods"
    }'::jsonb),
    ('seo', '{
        "metaTitle": "AWTMods — Download Modded Apps & Premium APKs",
        "metaDescription": "Discover and download high-quality Android modded applications, premium APKs, and open-source tools with multi-provider mirrors and checksum verification.",
        "ogImage": "/og-awtmods.png"
    }'::jsonb),
    ('downloads', '{
        "countdownSeconds": 5,
        "allowDirectUploads": true,
        "enableChecksumVerification": true,
        "allowedProviders": ["mediafire", "google_drive", "dropbox", "mega", "telegram", "custom", "cloudflare_r2"]
    }'::jsonb)
ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
