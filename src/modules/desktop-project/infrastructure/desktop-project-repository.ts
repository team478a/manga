import { createAdminClient } from "@/lib/supabase/admin";

export type DesktopProjectDraftCandidate = {
  id: string;
  status: "draft" | "published" | "archived";
  is_public: boolean;
  updated_at: string;
};

export type UpdatedDesktopProjectDraft = {
  id: string;
  title: string;
  description: string | null;
  updated_at: string;
};

export type DesktopProjectStatusWork = UpdatedDesktopProjectDraft & {
  status: "draft" | "published" | "archived";
  is_public: boolean;
};

export type DesktopProjectProductStatus = {
  status: "active" | "paused" | "archived";
};

export function createDesktopProjectRepository() {
  const admin = createAdminClient();

  return {
    findOwnedGeneralDraftCandidate(profileId: string, sourceProjectId: string) {
      return admin
        .from("works")
        .select("id, status, is_public, updated_at")
        .eq("creator_id", profileId)
        .eq("source_project_id", sourceProjectId)
        .eq("content_class", "general")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<DesktopProjectDraftCandidate>();
    },

    updateOwnedGeneralDraft(input: {
      id: string;
      profileId: string;
      title: string;
      description: string;
      expectedUpdatedAt: string;
    }) {
      return admin
        .from("works")
        .update({
          title: input.title,
          description: input.description || null,
        })
        .eq("id", input.id)
        .eq("creator_id", input.profileId)
        .eq("content_class", "general")
        .eq("status", "draft")
        .eq("is_public", false)
        .eq("updated_at", input.expectedUpdatedAt)
        .select("id, title, description, updated_at")
        .maybeSingle<UpdatedDesktopProjectDraft>();
    },

    findOwnedGeneralWorkStatus(profileId: string, sourceProjectId: string) {
      return admin
        .from("works")
        .select("id, title, description, status, is_public, updated_at")
        .eq("creator_id", profileId)
        .eq("source_project_id", sourceProjectId)
        .eq("content_class", "general")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<DesktopProjectStatusWork>();
    },

    listOwnedProductStatuses(profileId: string, workId: string) {
      return admin
        .from("digital_products")
        .select("status")
        .eq("creator_id", profileId)
        .eq("work_id", workId)
        .returns<DesktopProjectProductStatus[]>();
    },
  };
}
