import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { restoreCloudProjectAction } from "@/app/creator/actions";
import { EmptyState } from "@/components/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfile } from "@/lib/auth";
import { listDeletedCloudProjects } from "@/lib/cloud-creator-server";

export default async function CloudProjectTrashPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireProfile();
  const [projects, query] = await Promise.all([
    listDeletedCloudProjects(),
    searchParams,
  ]);
  return (
    <main className="page max-w-4xl">
      <PageHeader
        eyebrow="Cloud Creator"
        title="Projectのゴミ箱"
        description="削除から30日以内のProjectを復元できます。"
        actions={
          <ButtonLink href="/creator" variant="secondary">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Project一覧へ
          </ButtonLink>
        }
      />
      {query.error ? (
        <Alert className="mt-5" tone="danger">
          {query.error}
        </Alert>
      ) : null}
      <section className="mt-6 space-y-3">
        {projects.length ? (
          projects.map((project) => (
            <Card
              className="flex flex-col gap-4 shadow-app sm:flex-row sm:items-center"
              key={project.id}
            >
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold">{project.title}</h2>
                <p className="mt-1 text-sm text-text-muted">
                  削除日時:{" "}
                  {new Date(project.deleted_at).toLocaleString("ja-JP")}
                </p>
              </div>
              <form action={restoreCloudProjectAction.bind(null, project.id)}>
                <Button className="w-full sm:w-auto" type="submit">
                  <RotateCcw className="mr-2 h-5 w-5" />
                  復元
                </Button>
              </form>
            </Card>
          ))
        ) : (
          <EmptyState
            body="削除したProjectは30日間ここに表示されます。"
            icon={<Trash2 className="h-8 w-8" />}
            title="ゴミ箱は空です"
          />
        )}
      </section>
    </main>
  );
}
