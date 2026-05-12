export interface Creative {
  id: string;
  brand_id: string;
  brand_name: string | null;       // joined from brands table
  title: string;                   // derived display title
  campaign_id: string | null;      // FK → campaigns.id (nullable)
  campaign_name: string | null;    // joined from campaigns table
  platform: "youtube" | "tiktok" | "landing_page" | "social" | "meta" | "website" | "other" | "pinterest" | "programmatic" | "ooh" | "tvc";
  thumbnail_url: string | null;
  source_url: string;              // canonical URL from DB
  video_url: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  engagement_rate: number | null;
  duration_seconds: number | null;
  published_at: string | null;
  ad_type: "video" | "image" | "carousel";
  status: "active" | "inactive" | "pending";
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  youtube_channel_id: string | null;
  tiktok_handle: string | null;
  meta_page_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  totalCreatives: number;
  totalBrands: number;
  activeCreatives: number;
  totalViews: number;
}
