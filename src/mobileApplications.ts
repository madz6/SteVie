export type MobileEase='phone'|'laptop'|'unknown';
export const mobileLabels:Record<MobileEase,string>={phone:'Phone-friendly',laptop:'Better on laptop',unknown:'Not checked on phone'};
export function mobileRank(job:{mobileEase?:MobileEase}) {return {phone:0,unknown:1,laptop:2}[job.mobileEase??'unknown'];}
