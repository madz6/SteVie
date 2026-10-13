export interface HiringSignal {
  id:string; url:string; observedOn:string; summary:string;
  status:'unconfirmed'|'confirmed'|'closed';
}
export interface OutreachDraft {
  id:string; subject:string; body:string; flags:string[]; evidenceIds:string[];
  provider:string; createdAt:string; editedAt?:string; reviewedAt?:string; stale?:boolean;
}
export interface NetworkingFields {
  jobIds?:string[]; signals?:HiringSignal[]; outreachDrafts?:OutreachDraft[];
}
