// Live permission changes inside an open LiveKit room (a guest is passed the mic, a creator passes the Active Canvas gate).
// `room` is the registry id; the LiveKit room is "guild-"+id. Best effort: with no LiveKit keys this does nothing, and a failure never blocks the platform action that triggered it.
import {RoomServiceClient,TrackSource} from "livekit-server-sdk";
export type Src="camera"|"microphone"|"screen_share";
const MAP={camera:TrackSource.CAMERA,microphone:TrackSource.MICROPHONE,screen_share:TrackSource.SCREEN_SHARE};
export async function setPublish(room:string,identity:string,sources:Src[]){
  const url=process.env.NEXT_PUBLIC_LIVEKIT_URL,key=process.env.LIVEKIT_API_KEY,secret=process.env.LIVEKIT_API_SECRET;
  if(!url||!key||!secret)return;
  try{await new RoomServiceClient(url.replace(/^wss?:/,"https:"),key,secret).updateParticipant("guild-"+room,identity,undefined,
    {canPublish:sources.length>0,canSubscribe:true,canPublishData:false,canPublishSources:sources.map(s=>MAP[s])})}
  catch(e){console.warn("livekit permission update failed",e)}}
