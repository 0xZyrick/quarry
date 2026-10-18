// PoE Vault domain: capsules, reputation metrics, tiers and derived skills. Pure, so the server and tests share the exact rules.
import type {PainterId} from "./painters";
import {Skill,tagOf} from "./skills";
export type Capsule={id:string;kind:"war"|"commons";roomId:string;roomNumber:number;phase:string;skill:Skill;
  durationSec:number;createdAt:number;proofHash:string;peerMarks:number;painter:PainterId;seed:number;clipUrl:string|null};
export type Tier="master"|"professional"|"rising";
export const TIERS:Record<Tier,{label:string;color:string}>={
  master:{label:"Master Craftsman",color:"#FFB020"},        // solar amber
  professional:{label:"Professional",color:"#00FF66"},      // emerald
  rising:{label:"Rising Craftsman",color:"#00A3FF"}};
export type Metrics={sessionHours:number;peerReviews:number;capsules:number};
export const isReviewed=(c:Capsule)=>c.peerMarks>0;
export function metricsOf(cs:Capsule[]):Metrics{
  const reviewed=cs.filter(isReviewed);
  return{sessionHours:Math.round(cs.reduce((sum,c)=>sum+c.durationSec,0)/3600),
    peerReviews:cs.reduce((sum,c)=>sum+c.peerMarks,0),capsules:reviewed.length}}
export function tierOf(m:Metrics):Tier{
  if(m.capsules>=15&&m.peerReviews>=100)return"master";
  if(m.capsules>=5&&m.peerReviews>=20)return"professional";return"rising"}
export function skillsOf(cs:Capsule[]){const by=new Map<string,string[]>();
  for(const c of cs)if(isReviewed(c))by.set(c.skill,[...(by.get(c.skill)??[]),c.id]);
  return[...by].map(([skill,ids])=>({skill,tag:tagOf(skill),capsuleIds:ids})).sort((a,b)=>b.capsuleIds.length-a.capsuleIds.length)}
export type Vault={handle:string;location:string|null;tier:Tier;metrics:Metrics;skills:ReturnType<typeof skillsOf>;capsules:Capsule[];
  preview:boolean;nodeId:string|null;live:null|{nodeId:string;kind:"commons"|"war";roomNumber:number;label:string}};
