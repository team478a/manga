export type Project = { id:string; title:string; subtitle:string; description:string; genre:string; ageRating:"全年齢"|"12歳以上"|"15歳以上"|"成人向け"; readingDirection:"rtl"|"ltr"; width:number; height:number; dpi:number; storagePath:string; coverAssetId:string|null; createdAt:string; updatedAt:string; lastOpenedAt:string|null };
export type Episode = { id:string; projectId:string; title:string; orderIndex:number; createdAt:string; updatedAt:string };
export type Page = { id:string; episodeId:string; pageNumber:number; orderIndex:number; width:number; height:number; backgroundColor:string; imageAssetId:string|null; prompt:string; negativePrompt:string; notes:string; createdAt:string; updatedAt:string };
export type Panel = { id:string; pageId:string; orderIndex:number; x:number; y:number; width:number; height:number; imageAssetId:string|null; prompt:string; negativePrompt:string; generationStatus:string; metadata:string };
export type Asset = { id:string; projectId:string; fileName:string; relativePath:string; mimeType:string; width:number; height:number; byteSize:number; sha256:string; createdAt:string };
export type ProjectBundle = { project:Project; episodes:Episode[]; pages:Page[]; panels:Panel[]; assets:Asset[] };

export function ordered<T extends { orderIndex:number }>(items:T[]) { return [...items].sort((a,b)=>a.orderIndex-b.orderIndex); }
export function nextOrderIndex<T extends { orderIndex:number }>(items:T[]) { return items.length ? Math.max(...items.map(x=>x.orderIndex))+1 : 0; }
