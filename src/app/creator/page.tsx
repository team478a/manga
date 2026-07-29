import { BookOpen, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Alert, FlashMessage } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireProfile } from "@/lib/auth";
import { listCloudProjects } from "@/lib/cloud-creator-server";

export default async function CloudCreatorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { profile } = await requireProfile();
  if (profile.role !== "creator" && profile.role !== "admin") {
    return (
      <main className="page max-w-3xl">
        <PageHeader title="Cloud Creator" />
        <Alert className="mt-6" tone="warning">
          Cloud Creatorを利用するにはクリエイター登録が必要です。
        </Alert>
      </main>
    );
  }
  const [projects, query] = await Promise.all([
    listCloudProjects(),
    searchParams,
  ]);
  return (
    <main className="page">
      <PageHeader
        eyebrow="一般漫画・ブラウザー制作"
        title="Cloud Creator"
        description="Projectを作成し、EpisodeとPageを編集します。"
        actions={
          <>
          <ButtonLink href="/creator/trash" variant="secondary">
            <Trash2 className="mr-2 h-5 w-5" />
            ゴミ箱
          </ButtonLink>
          <ButtonLink href="/creator/new">
            <Plus className="mr-2 h-5 w-5" />
            新しいProject
          </ButtonLink>
          </>
        }
      />
      <FlashMessage className="mt-5" message={query.message} />
      <Alert className="mt-6" tone="warning">
        Cloud Creatorは一般向け作品専用です。成人向け作品はMANGAI Desktop
        Adultで制作してください。
      </Alert>
      {projects.length ? (
        <section className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ButtonLink
              className="h-auto items-start justify-start whitespace-normal p-0 text-left"
              href={`/creator/${project.id}`}
              key={project.id}
              variant="ghost"
            >
              <Card className="h-full w-full" variant="interactive">
                <BookOpen className="h-8 w-8 text-brand-600" />
                <h2 className="mt-4 text-xl font-bold">{project.title}</h2>
                <p className="mt-2 line-clamp-2 min-h-12 text-text-secondary">
                  {project.description || "説明はまだありません。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge>
                  {project.age_rating}
                </StatusBadge>
                <StatusBadge tone="info">
                  {project.source_surface === "desktop"
                    ? "Desktop移行"
                    : "Cloud作成"}
                </StatusBadge>
                </div>
              </Card>
            </ButtonLink>
          ))}
        </section>
      ) : (
        <EmptyState
          className="mt-7"
          icon={<BookOpen className="h-12 w-12" />}
          title="Projectはまだありません"
          body="最初のProjectには第1話と1Page目が自動作成されます。"
          href="/creator/new"
          action="Projectを作成"
        />
      )}
    </main>
  );
}
