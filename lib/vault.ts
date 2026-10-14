// PoE Vault domain: capsules, reputation metrics, tiers and derived skills. Pure, so the server and tests share the exact rules.
import type {PainterId} from "./painters";
import {Skill,tagOf} from "./skills";
export type Capsule={id:string;kind:"war"|"commons";roomId:string;roomNumber:number;phase:string;skill:Skill;
  amountUsd:number;tips:number;durationSec:number;signedAt:number;clientSigned:boolean;gatewayTxId:string|null;
  webhookVerified:boolean;proofHash:string;peerMarks:number;painter:PainterId;seed:number;clipUrl:string|null};
export type Tier="master"|"professional"|"rising";
export const TIERS:Record<Tier,{label:string;color:string}>={
  master:{label:"Master Craftsman",color:"#FFB020"},        // solar amber
  professional:{label:"Professional",color:"#00FF66"},      // emerald
  rising:{label:"Rising Craftsman",color:"#00A3FF"}};
export type Metrics={throughputUsd:number;ticksVerified:number;ticksTotal:number;tips:number;capsules:number};
// A capsule only counts once the payment webhook confirmed it AND (for a War Room) the client signed off.
export const isVerified=(c:Capsule)=>c.webhookVerified&&!!c.gatewayTxId&&(c.kind==="commons"||c.clientSigned);
export function metricsOf(cs:Capsule[]):Metrics{
  const war=cs.filter(c=>c.kind==="war"),ok=cs.filter(isVerified);
  return{throughputUsd:ok.filter(c=>c.kind==="war").reduce((a,c)=>a+c.amountUsd,0),ticksVerified:war.filter(isVerified).length,ticksTotal:war.length,
    tips:ok.filter(c=>c.kind==="commons").reduce((a,c)=>a+c.tips,0),capsules:ok.length}}
export function tierOf(m:Metrics):Tier{
  if(m.throughputUsd>=25000&&m.ticksVerified>=15)return"master";
  if((m.throughputUsd>=5000&&m.ticksVerified>=5)||m.tips>=300)return"professional";return"rising"}
// Zero-text credential rule: skills are derived, never entered. No verified capsule, no tag.
export function skillsOf(cs:Capsule[]){const by=new Map<string,string[]>();
  for(const c of cs)if(isVerified(c))by.set(c.skill,[...(by.get(c.skill)??[]),c.id]);
  return[...by].map(([skill,ids])=>({skill,tag:tagOf(skill),capsuleIds:ids})).sort((a,b)=>b.capsuleIds.length-a.capsuleIds.length)}
export type Vault={handle:string;location:string|null;tier:Tier;metrics:Metrics;skills:ReturnType<typeof skillsOf>;capsules:Capsule[];
  preview:boolean;nodeId:string|null;live:null|{nodeId:string;kind:"commons"|"war";roomNumber:number;label:string}};
