import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { markAllCloudAiNotificationsReadAction,markCloudAiNotificationReadAction } from "./actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

export default async function NotificationsPage(){
  const {profile}=await requireProfile();const supabase=await createClient();
  const {data}=await supabase.from("cloud_ai_notifications").select("id,notification_type,severity,title,body,source_id,read_at,created_at").eq("profile_id",profile.id).order("created_at",{ascending:false}).limit(100);
  const notifications=data??[];const unread=notifications.filter(item=>!item.read_at).length;
  return <main className="page max-w-4xl"><Link className="text-leaf underline" href="/dashboard">← マイページ</Link><div className="mt-4 flex items-end justify-between"><div><h1 className="text-3xl font-bold">通知</h1><p className="mt-2 text-stone-600">制作状況、AI利用枠、モニター報告への対応状況をお知らせします。未読 {unread}件</p></div>{unread?<form action={markAllCloudAiNotificationsReadAction}><PendingSubmitButton className="button-secondary" pendingLabel="更新中…">すべて既読</PendingSubmitButton></form>:null}</div>
  <section className="mt-6 space-y-3">{notifications.map(item=><article className={`panel ${item.read_at?"opacity-70":"border-leaf"}`} key={item.id}><div className="flex gap-4 justify-between"><div><p className={`text-sm font-semibold ${item.severity==="critical"?"text-red-700":item.severity==="warning"?"text-amber-700":"text-leaf"}`}>{item.notification_type}</p><h2 className="mt-1 text-xl font-bold">{item.title}</h2><p className="mt-2 text-stone-600">{item.body}</p><p className="mt-2 text-sm text-stone-500">{new Date(item.created_at).toLocaleString("ja-JP")}</p></div>{!item.read_at?<form action={markCloudAiNotificationReadAction.bind(null,item.id)}><PendingSubmitButton className="button-secondary" pendingLabel="更新中…">既読</PendingSubmitButton></form>:null}</div></article>)}{!notifications.length?<div className="panel text-stone-600">通知はありません。</div>:null}</section></main>;
}
