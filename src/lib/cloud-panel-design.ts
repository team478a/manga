import{z}from"zod";import{cloudPanelDesignSchema}from"@mangai/ai-core";export{cloudPanelDesignSchema};
export const cloudPanelDesignSaveSchema=z.object({projectId:z.string().uuid(),pageId:z.string().uuid(),panelId:z.string().uuid(),expectedRevision:z.number().int().positive().nullable(),design:cloudPanelDesignSchema});
export type CloudPanelDesign=z.infer<typeof cloudPanelDesignSchema>;
export type CloudPanelDesignRecord={id:string;panelId:string;revision:number;design:CloudPanelDesign;updatedAt:string};
export const emptyCloudPanelDesign=(orderIndex:number):CloudPanelDesign=>({schemaVersion:1,orderIndex,location:{profileId:null,timeOfDay:"",weather:""},characters:[],camera:{distance:"",angle:"",lens:"",composition:""},props:[],dialogueRefs:[],continuityNote:"",promptDirection:"",negativeDirection:"",changeReason:""});
