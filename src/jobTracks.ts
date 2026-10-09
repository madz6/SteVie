export type JobTrack='career'|'income'|'unclassified';
export type EmploymentType='full_time'|'part_time'|'contract'|'internship'|'unknown';
export const trackLabels:Record<JobTrack,string>={career:'Career roles',income:'Income / part-time roles',unclassified:'Needs classification'};
export const employmentLabels:Record<EmploymentType,string>={full_time:'Full-time',part_time:'Part-time',contract:'Contract / temporary',internship:'Internship',unknown:'Hours not confirmed'};
type Classifiable={title:string;track?:JobTrack;employmentType?:EmploymentType};
export function suggestedTrack(title:string):JobTrack {
  if(/\b(?:retail sales|sales assistant|sales advisor|sales associate|credit.*collections advisor)\b/i.test(title))return 'income';
  if(/\b(?:consultant|consulting|analyst|strategy|engineer|product (?:manager|management|operations|ops|intern)|founder.?s? associate|graduate|research scientist|data scientist|business operations|software|commercial.*pricing)\b/i.test(title))return 'career';
  if(/\b(?:retail|sales (?:assistant|advisor|adviser|associate)|waiter|waitress|waitstaff|barista|bartender|receptionist|front of house|deli assistant|accommodation assistant|housekeep|cleaner|subway supervisor|server at|store assistant|market research interviewer)\b/i.test(title))return 'income';
  return 'unclassified';
}
export const trackFor=(job:Classifiable):JobTrack=>job.track??suggestedTrack(job.title);
export function employmentFor(job:Classifiable):EmploymentType {
  if(job.employmentType)return job.employmentType;
  if(/\bpart[ -]?time\b/i.test(job.title))return 'part_time';
  if(/\bfull[ -]?time\b/i.test(job.title))return 'full_time';
  if(/\bintern(?:ship)?\b/i.test(job.title))return 'internship';
  if(/\b(?:contract|temporary|seasonal)\b/i.test(job.title))return 'contract';
  return 'unknown';
}
