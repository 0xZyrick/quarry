import {cookies} from "next/headers";
import {notFound} from "next/navigation";
import VaultPage from "@/features/vault/VaultPage";
import {vaultFor} from "@/lib/server/vault";
import {readSession} from "@/lib/server/session";
export const dynamic="force-dynamic";
const sessionOf=()=>readSession(new Request("http://local/",{headers:{cookie:cookies().toString()}}));
export function generateMetadata({params}:{params:{handle:string}}){return{title:`@${decodeURIComponent(params.handle)} · PoE Vault`}}
export default function Page({params}:{params:{handle:string}}){
  const v=vaultFor(decodeURIComponent(params.handle),sessionOf());if(!v)notFound();
  return <VaultPage vault={v}/>}
