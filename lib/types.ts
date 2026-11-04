export type AppCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  app_count?: number;
  created_at: string;
};

export type DownloadType = 'upload' | 'external';

export type HostingProvider =
  | 'mediafire'
  | 'google_drive'
  | 'dropbox'
  | 'mega'
  | 'telegram'
  | 'custom'
  | 'cloudflare_r2'
  | 'supabase_storage';

export type DownloadSource = {
  id: string;
  version_id: string;
  download_type: DownloadType;
  hosting_provider: HostingProvider;
  download_url: string;
  storage_key?: string | null;
  mirror_name?: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ApplicationVersion = {
  id: string;
  application_id: string;
  version_name: string;
  version_code: number;
  file_size: string;
  architecture: string;
  android_requirement: string;
  sha256?: string | null;
  release_notes?: string | null;
  is_latest: boolean;
  status: 'published' | 'draft' | 'disabled';
  created_at: string;
  download_sources?: DownloadSource[];
};

export type AppScreenshot = {
  id: string;
  application_id: string;
  image_url: string;
  sort_order: number;
  created_at?: string;
};

export type Application = {
  id: string;
  name: string;
  slug: string;
  package_name: string;
  developer: string;
  category_id: string;
  category?: AppCategory;
  short_description: string;
  description: string;
  icon_url: string;
  banner_url?: string | null;
  android_requirement: string;
  is_featured: boolean;
  is_trending: boolean;
  status: 'published' | 'draft' | 'archived';
  rating: number;
  reviews_count: number;
  created_at: string;
  updated_at: string;
  latest_version?: ApplicationVersion;
  versions?: ApplicationVersion[];
  screenshots?: AppScreenshot[];
  downloads_count?: number;
};

export type DownloadEvent = {
  id: string;
  application_id: string;
  version_id: string;
  download_source_id?: string | null;
  event_type: 'initiated' | 'completed' | 'mirror_click';
  ip_hash?: string;
  user_agent?: string;
  downloaded_at: string;
};

export type ReportType =
  | 'broken_link'
  | 'incorrect_info'
  | 'outdated_version'
  | 'dmca'
  | 'security'
  | 'other';

export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export type UserReport = {
  id: string;
  application_id?: string | null;
  application_name?: string;
  report_type: ReportType;
  email?: string | null;
  message: string;
  status: ReportStatus;
  created_at: string;
};

export type AdminUser = {
  id: string;
  auth_user_id?: string;
  email: string;
  role: 'superadmin' | 'admin';
  name?: string;
  is_active: boolean;
  created_at: string;
};

export type SiteSettings = {
  siteName: string;
  tagline: string;
  siteDescription: string;
  siteUrl: string;
  logoText: string;
  contactEmail: string;
  defaultTheme: 'light' | 'dark' | 'system';
  telegramUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  twitterUrl: string;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  countdownSeconds: number;
  allowDirectUploads: boolean;
  enableChecksumVerification: boolean;
  allowedProviders: HostingProvider[];
};

