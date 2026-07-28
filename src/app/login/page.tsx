import { signIn } from "@/app/actions";
import Link from "next/link";
import { FlashMessage } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;

  return (
    <main className="page max-w-xl">
      <PageHeader
        title="ログイン"
        description="登録したメールアドレスで入れます。"
      />
      <FlashMessage className="mt-5" error={params.error} message={params.message} />
      <Card className="mt-6">
      <form action={signIn} className="space-y-5">
        <FormField id="email" label="メールアドレス" required>
          <input className="ui-field" id="email" name="email" type="email" required />
        </FormField>
        <FormField id="password" label="パスワード" required>
          <input className="ui-field" id="password" name="password" type="password" required />
          <div className="mt-2 text-right">
            <Link className="text-sm font-medium text-green-800 hover:underline" href="/forgot-password">
              パスワードを忘れた方
            </Link>
          </div>
        </FormField>
        <Button className="w-full" type="submit">ログインする</Button>
      </form>
      </Card>
    </main>
  );
}
