import {Room,RoomEvent,Track,LocalVideoTrack} from "livekit-client";
import type {Path} from "./capture";
// Tile id = "u-" + participant identity (same user id Liveblocks presence uses).
export async function connectLK(roomId:string,apply:(p:any)=>void){
  const res=await fetch("/api/livekit-token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({room:roomId})});
  if(!res.ok)throw new Error("token "+res.status);
  const {token}=await res.json();
  const room=new Room({adaptiveStream:true,dynacast:true,publishDefaults:{simulcast:true}});
  const streams:Record<string,any>={};const push=()=>apply({streams:{...streams}});
  room.on(RoomEvent.TrackSubscribed,(t,_p,p)=>{if(t.kind===Track.Kind.Video){streams["u-"+p.identity]=t;push()}});
  room.on(RoomEvent.TrackUnsubscribed,(t,_p,p)=>{if(t.kind===Track.Kind.Video){delete streams["u-"+p.identity];push()}});
  room.on(RoomEvent.ParticipantDisconnected,p=>{delete streams["u-"+p.identity];push()});
  await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!,token);
  return {stop:()=>{room.disconnect()},
    // Put an already-authorised capture stream on air: screen capture goes out as ScreenShare, a camera as Camera.
    publish:async(stream:MediaStream,path:Path)=>{const mt=stream.getVideoTracks()[0];if(!mt)throw new Error("no video");
      for(const p of [...room.localParticipant.videoTrackPublications.values()])if(p.track)await room.localParticipant.unpublishTrack(p.track,false);
      const t=new LocalVideoTrack(mt);
      await room.localParticipant.publishTrack(t,{source:path==="digital"?Track.Source.ScreenShare:Track.Source.Camera});
      streams.self=t;apply({camOn:path==="physical",streams:{...streams}})},
    unpublish:async()=>{for(const p of [...room.localParticipant.videoTrackPublications.values()])if(p.track)await room.localParticipant.unpublishTrack(p.track,false);
      delete streams.self;apply({camOn:false,streams:{...streams}})},
    setMic:async(on:boolean)=>{await room.localParticipant.setMicrophoneEnabled(on)},
    setCam:async(on:boolean)=>{await room.localParticipant.setCameraEnabled(on);
      const pub=room.localParticipant.getTrackPublication(Track.Source.Camera);
      if(on&&pub?.track)streams.self=pub.track;else delete streams.self;
      apply({camOn:on,streams:{...streams}})}};
}
