import {
  AsyncStatePage,
  AsyncStatePanel,
} from "@/components/AsyncStateShell";

export default function Loading() { return <AsyncStatePage className="max-w-5xl" aria-busy="true"><AsyncStatePanel as="div" className="h-48 animate-pulse bg-violet-50">ネームを読み込み中…</AsyncStatePanel></AsyncStatePage>; }
