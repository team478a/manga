export type Profile = {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  role: "buyer" | "creator" | "admin";
};

export type Work = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  sample_image_urls: string[];
  source_project_id: string | null;
  tags: string[];
  status: "draft" | "published" | "archived";
  is_public: boolean;
  created_at: string;
};

export type DigitalProduct = {
  id: string;
  work_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  price: number;
  status: "active" | "paused" | "archived";
  created_at: string;
};

export type GoodsRequest = {
  id: string;
  work_id: string;
  creator_id: string;
  product_type: string;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "in_progress" | "completed";
  admin_note: string | null;
  created_at: string;
};
