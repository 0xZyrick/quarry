// Sliding-window limiter, in memory. Keyed by account or IP. For several instances move the buckets to Redis (INCR + EXPIRE).
const g=globalThis as any,b:Map<string,number[]>=g.__guildRL??=new Map();
export function limit(key:string,max:number,windowMs:number):boolean{
  const now=Date.now(),a=(b.get(key)??[]).filter(t=>now-t<windowMs);
  if(a.length>=max){b.set(key,a);return false}a.push(now);b.set(key,a);
  if(b.size>20000)for(const[k,v]of b)if(!v.length||now-v[v.length-1]>windowMs)b.delete(k);return true}
export const ipOf=(req:Request)=>(req.headers.get("x-forwarded-for")??"local").split(",")[0].trim();
