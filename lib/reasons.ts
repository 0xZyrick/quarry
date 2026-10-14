// Report categories, shared by the server and the report sheet. "severe" categories hold a room on a single valid report.
export const REASONS={
  non_skilled:{label:"Not skilled work (just chatting, driving, lifestyle)",severe:false},
  spam:{label:"Spam or scam",severe:false},
  harassment:{label:"Harassment or hate",severe:false},
  sexual:{label:"Sexual content",severe:false},
  violence:{label:"Violence or self-harm",severe:false},
  illegal:{label:"Illegal activity",severe:true},
  minor_safety:{label:"Endangers a minor",severe:true},
  other:{label:"Something else",severe:false}} as const;
export type Reason=keyof typeof REASONS;
export const isReason=(x:unknown):x is Reason=>typeof x==="string"&&x in REASONS;
