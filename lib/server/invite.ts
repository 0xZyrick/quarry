// Display name -> handle: lowercase, letters digits . _ - only, 2..24 chars. Returns null if it cannot be used.
const RESERVED=new Set(["mod","arbiter","admin","guild","quarry","support","system","guest","me"]);
export function cleanName(s:unknown):string|null{
  if(typeof s!=="string")return null;
  const h=s.trim().toLowerCase().replace(/\s+/g,".").replace(/[^a-z0-9._-]/g,"").replace(/^[._-]+|[._-]+$/g,"").slice(0,24);
  return h.length>=2&&!RESERVED.has(h)?h:null}
