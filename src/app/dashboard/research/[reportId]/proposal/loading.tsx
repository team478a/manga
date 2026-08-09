import { LoaderCircle } from "lucide-react";
import {
  AsyncStatePage,
  AsyncStatePanel,
} from "@/components/AsyncStateShell";

export default function CloudProposalLoading() {
  return (
    <AsyncStatePage
      aria-busy="true"
      aria-live="polite"
      className="page max-w-5xl"
      role="status"
    >
      <AsyncStatePanel className="text-center">
        <LoaderCircle
          aria-hidden="true"
          className="mx-auto h-8 w-8 animate-spin text-violet-700"
        />
        <h1 className="mt-3 text-xl font-bold">
          AI企画提案を読み込んでいます
        </h1>
        <p className="mt-2 text-stone-600">
          画面を移動せずにお待ちください。
        </p>
      </AsyncStatePanel>
    </AsyncStatePage>
  );
}
