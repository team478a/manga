import { ArrowLeft, Sparkles } from "lucide-react";
import { createCloudProjectAction } from "@/app/creator/actions";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfile } from "@/lib/auth";

export default async function NewCloudProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireProfile();
  const params = await searchParams;
  return (
    <main className="page max-w-3xl">
      <PageHeader
        eyebrow="Cloud Creator"
        title="新しいProject"
        description="一般漫画用の第1話と1Page目を一緒に作成します。"
        actions={
          <ButtonLink href="/creator" variant="secondary">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Project一覧へ
          </ButtonLink>
        }
      />
      {params.error ? (
        <Alert className="mt-5" tone="danger">
          {params.error}
        </Alert>
      ) : null}
      <Card className="mt-6 shadow-app">
        <form action={createCloudProjectAction} className="space-y-5">
          <FormField id="title" label="Project名" required>
          <input
            className="ui-field"
            id="title"
            name="title"
            maxLength={200}
            required
            autoFocus
          />
          </FormField>
          <FormField id="description" label="説明">
          <textarea
            className="ui-field min-h-28"
            id="description"
            name="description"
            maxLength={5000}
          />
          </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="ageRating" label="対象年齢">
            <select className="ui-field" id="ageRating" name="ageRating">
              <option>全年齢</option>
              <option>12歳以上</option>
              <option>15歳以上</option>
            </select>
          </FormField>
          <FormField id="readingDirection" label="綴じ方向">
            <select
              className="ui-field"
              id="readingDirection"
              name="readingDirection"
            >
              <option value="rtl">右綴じ</option>
              <option value="ltr">左綴じ</option>
            </select>
          </FormField>
        </div>
        <fieldset>
          <legend className="ui-label">Page設定</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <FormField id="width" label="幅">
              <input
                className="ui-field"
                id="width"
                name="width"
                type="number"
                min="100"
                max="20000"
                defaultValue="1600"
                required
              />
            </FormField>
            <FormField id="height" label="高さ">
              <input
                className="ui-field"
                id="height"
                name="height"
                type="number"
                min="100"
                max="20000"
                defaultValue="2400"
                required
              />
            </FormField>
            <FormField id="dpi" label="DPI">
              <input
                className="ui-field"
                id="dpi"
                name="dpi"
                type="number"
                min="72"
                max="1200"
                defaultValue="300"
                required
              />
            </FormField>
          </div>
        </fieldset>
        <Alert tone="warning">
          成人向けへ変更することはできません。成人向け制作にはDesktop
          Adultを使用してください。
        </Alert>
        <Button className="w-full" type="submit">
          <Sparkles className="mr-2 h-5 w-5" />
          Projectを作成
        </Button>
        </form>
      </Card>
    </main>
  );
}
