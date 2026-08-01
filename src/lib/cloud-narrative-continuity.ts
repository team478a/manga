import { z } from "zod";

export const continuityFactKinds = ["appearance", "location", "relationship", "timeline", "prop", "speech"] as const;
export const plotThreadStatuses = ["planned", "planted", "resolved", "dropped"] as const;

const optionalPage = z.number().int().min(1).max(1000).nullable();

export const cloudContinuityFactInputSchema = z.object({
  projectId: z.string().uuid(),factId: z.string().uuid().nullable(),factKind: z.enum(continuityFactKinds),
  subject: z.string().trim().min(1).max(100),attribute: z.string().trim().min(1).max(100),
  factValue: z.string().trim().min(1).max(500),startPage: z.number().int().min(1).max(1000),
  endPage: z.number().int().min(1).max(1000),sourcePage: optionalPage,notes: z.string().trim().max(1000),
}).refine((value) => value.endPage >= value.startPage && (value.sourcePage === null || (value.sourcePage >= value.startPage && value.sourcePage <= value.endPage)), "ページ範囲を確認してください。");

export const cloudPlotThreadInputSchema = z.object({
  projectId: z.string().uuid(),threadId: z.string().uuid().nullable(),title: z.string().trim().min(1).max(150),
  setupPage: z.number().int().min(1).max(1000),targetPayoffPage: optionalPage,payoffPage: optionalPage,
  status: z.enum(plotThreadStatuses),notes: z.string().trim().max(1000),
}).refine((value) => (value.targetPayoffPage === null || value.targetPayoffPage >= value.setupPage) && (value.payoffPage === null || value.payoffPage >= value.setupPage), "回収ページを確認してください。");

export type CloudContinuityFactInput = z.infer<typeof cloudContinuityFactInputSchema>;
export type CloudPlotThreadInput = z.infer<typeof cloudPlotThreadInputSchema>;
export type CloudContinuityFact = { id:string;project_id:string;fact_kind:typeof continuityFactKinds[number];subject:string;attribute:string;fact_value:string;start_page:number;end_page:number;source_page:number|null;notes:string;updated_at:string };
export type CloudPlotThread = { id:string;project_id:string;title:string;setup_page:number;target_payoff_page:number|null;payoff_page:number|null;status:typeof plotThreadStatuses[number];notes:string;updated_at:string };
export type NarrativeContinuityIssue = { code:"overlapping_fact_conflict"|"payoff_overdue"|"resolved_without_payoff";severity:"warning";factIds:string[];threadId:string|null;message:string };

export function evaluateNarrativeContinuity(facts: CloudContinuityFact[], threads: CloudPlotThread[], totalPages: number) {
  const issues: NarrativeContinuityIssue[] = [];
  for (let leftIndex=0;leftIndex<facts.length;leftIndex+=1) for (let rightIndex=leftIndex+1;rightIndex<facts.length;rightIndex+=1) {
    const left=facts[leftIndex];const right=facts[rightIndex];
    if (left.fact_kind===right.fact_kind && left.subject.toLocaleLowerCase("ja")==right.subject.toLocaleLowerCase("ja") && left.attribute.toLocaleLowerCase("ja")==right.attribute.toLocaleLowerCase("ja") && left.fact_value!==right.fact_value && left.start_page<=right.end_page && right.start_page<=left.end_page)
      issues.push({code:"overlapping_fact_conflict",severity:"warning",factIds:[left.id,right.id],threadId:null,message:`${Math.max(left.start_page,right.start_page)}〜${Math.min(left.end_page,right.end_page)}ページで「${left.subject}／${left.attribute}」の設定が「${left.fact_value}」と「${right.fact_value}」に分かれています。`});
  }
  for (const thread of threads) {
    if ((thread.status==="planned" || thread.status==="planted") && thread.target_payoff_page!==null && totalPages>=thread.target_payoff_page)
      issues.push({code:"payoff_overdue",severity:"warning",factIds:[],threadId:thread.id,message:`伏線「${thread.title}」は${thread.target_payoff_page}ページまでの回収予定ですが、未回収です。`});
    if (thread.status==="resolved" && thread.payoff_page===null)
      issues.push({code:"resolved_without_payoff",severity:"warning",factIds:[],threadId:thread.id,message:`伏線「${thread.title}」は回収済みですが、回収ページが未記録です。`});
  }
  return {factCount:facts.length,threadCount:threads.length,openThreadCount:threads.filter((thread)=>thread.status==="planned"||thread.status==="planted").length,warningCount:issues.length,issues};
}
