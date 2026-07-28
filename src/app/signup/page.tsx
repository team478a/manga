import { signUp } from "@/app/actions";
import { FlashMessage } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;

  return (
    <main className="page max-w-xl">
      <PageHeader
        title="新規登録"
        description="まずは無料で作品投稿の準備を始めましょう。"
      />
      <FlashMessage className="mt-5" error={params.error} message={params.message} />
      <Card className="mt-6">
      <form action={signUp} className="space-y-5">
        <FormField id="displayName" label="表示名" required>
          <input className="ui-field" id="displayName" name="displayName" required placeholder="例：山田 花子" />
        </FormField>
        <FormField id="email" label="メールアドレス" required>
          <input className="ui-field" id="email" name="email" type="email" required />
        </FormField>
        <FormField id="password" label="パスワード" hint="8文字以上で入力してください。" required>
          <input aria-describedby="password-hint" className="ui-field" id="password" name="password" type="password" minLength={8} required />
        </FormField>
        <FormField id="passwordConfirmation" label="パスワード（確認）" required>
          <input
            className="ui-field"
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            minLength={8}
            required
          />
        </FormField>
        <Button className="w-full" type="submit">登録する</Button>
      </form>
      </Card>
    </main>
  );
}
