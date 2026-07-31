import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { cloudGeneralMonitorBetaEnabled } from "@/lib/cloud-general-monitor";
import { buildGeneralMonitorCsv } from "@/lib/cloud-general-monitor-export";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET(){
  await requireAdmin();
  if(!cloudGeneralMonitorBetaEnabled()) return new NextResponse("Not Found",{status:404});
  const admin=createAdminClient();
  const [enrollments,profiles,feedback]=await Promise.all([
    admin.from("cloud_general_monitor_enrollments").select("*").order("created_at"),
    admin.from("profiles").select("id,display_name"),
    admin.from("cloud_general_monitor_feedback").select("owner_profile_id,rating"),
  ]);
  if(enrollments.error||profiles.error||feedback.error) return new NextResponse("CSVを作成できませんでした",{status:503});
  const names=new Map((profiles.data??[]).map(item=>[item.id,item.display_name]));
  const csv=buildGeneralMonitorCsv((enrollments.data??[]).map(item=>{
    const ratings=(feedback.data??[]).filter(entry=>entry.owner_profile_id===item.profile_id).map(entry=>entry.rating);
    return {displayName:names.get(item.profile_id)??"表示名未設定",status:item.status,cohort:item.cohort,aiRequestsUsed:item.ai_requests_used,aiRequestLimit:item.ai_request_limit,startsAt:item.starts_at,expiresAt:item.expires_at,onboardingCompletedAt:item.onboarding_completed_at??"",feedbackCount:ratings.length,averageRating:ratings.length?(ratings.reduce((sum,value)=>sum+value,0)/ratings.length).toFixed(1):""};
  }));
  return new NextResponse(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="mangai-general-monitors-${new Date().toISOString().slice(0,10)}.csv"`,"Cache-Control":"no-store"}});
}
