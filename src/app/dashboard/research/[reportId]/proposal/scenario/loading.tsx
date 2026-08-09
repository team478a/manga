import {
  AsyncStatePage,
  AsyncStatePanel,
} from "@/components/AsyncStateShell";

export default function Loading() {
  return <AsyncStatePage className="max-w-4xl" aria-busy="true"><AsyncStatePanel as="div" className="h-48 animate-pulse bg-violet-50">シナリオを読み込み中…</AsyncStatePanel></AsyncStatePage>;
}
