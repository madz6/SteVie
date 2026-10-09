// These checks concern stale or missing provenance. Reviewing a warning cannot
// restore provenance; preparation must run again after the sources are corrected.
export const canReviewCheck=(flag:string)=>! /^(?:Supporting source changed|Unknown evidence reference|Unresolved evidence was used|Evidence references are missing|No confirmed candidate evidence|The draft did not cite candidate evidence)/i.test(flag);
