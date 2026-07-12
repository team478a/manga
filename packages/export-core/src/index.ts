export type SalesTextInput = { title:string; subtitle?:string; genre?:string; tags?:string[]; ageRating?:string };
export function createSalesTextDraft(input:SalesTextInput) {
  const genre=input.genre||"漫画"; const tags=input.tags?.length?input.tags:["AI漫画",genre,"創作"];
  return { catchCopy:input.subtitle?`${input.subtitle} - ${input.title}`:`${input.title}、いま届けたい物語。`, description:`${input.title}は、作品世界とキャラクターの魅力を楽しめる${genre}作品です。`, snsPost:`新作「${input.title}」の販売準備ができました。\n${tags.map(x=>`#${x.replace(/\s/g,"")}`).join(" ")}`, tags };
}
