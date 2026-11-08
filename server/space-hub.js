import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {createWorld,stepWorld,addBody,applyImpulse,snapshot} from '../src/spacedynamics/core.js';
import {SPACE_PROTOCOL,ROOM_RE,validateSpaceCommand} from '../src/spacedynamics/protocol.js';

/** Ephemeral two-seat server-authoritative rooms on the separate /space path. */
export function createSpaceHub({tickMs=100}={}){
  const rooms=new Map();
  const send=(ws,msg)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg));};
  const broadcast=(room,msg)=>room.members.forEach(ws=>send(ws,msg));
  const state=room=>({type:'space-state',protocol:SPACE_PROTOCOL,epoch:room.epoch,
    revision:room.revision,world:{...snapshot(room.world),paused:room.world.paused}});
  const announce=room=>broadcast(room,state(room));
  function join(ws,msg){
    if(ws.spaceRoom)return;
    const code=String(msg.room||'').toUpperCase();
    if(!ROOM_RE.test(code)){send(ws,{type:'space-error',code:'invalid_room',fatal:true});return;}
    let room=rooms.get(code);
    if(room&&room.members.length>=2){send(ws,{type:'space-error',code:'room_full',fatal:true});return;}
    if(!room){room={code,epoch:randomUUID(),revision:0,world:createWorld(),members:[]};rooms.set(code,room);}
    ws.spaceRoom=room;ws.spaceRole=room.members.length+1;ws.lastSequence=0;room.members.push(ws);
    send(ws,{type:'space-welcome',protocol:SPACE_PROTOCOL,room:code,role:ws.spaceRole,epoch:room.epoch});
    announce(room);
    if(room.members.length===2)send(room.members[0],{type:'space-peer-joined'});
  }
  function leave(ws){
    const room=ws.spaceRoom;if(!room)return;
    ws.spaceRoom=null;room.members=room.members.filter(member=>member!==ws);
    if(!room.members.length){rooms.delete(room.code);return;}
    room.members[0].spaceRole=1;
    send(room.members[0],{type:'space-peer-left',role:1});
  }
  function command(ws,msg){
    const room=ws.spaceRoom;if(!room)return;
    const c=validateSpaceCommand(msg);
    if(!c){send(ws,{type:'space-receipt',accepted:false,code:'invalid_command'});return;}
    if(c.seq<=ws.lastSequence){send(ws,{type:'space-receipt',seq:c.seq,accepted:false,code:'stale_sequence'});return;}
    ws.lastSequence=c.seq;
    if(['gravity','field','pause','reset'].includes(c.action)&&ws.spaceRole!==1){
      send(ws,{type:'space-receipt',seq:c.seq,accepted:false,code:'host_only'});return;
    }
    const w=room.world;let applied=true;
    switch(c.action){
      case 'add': applied=Boolean(addBody(w));break;
      case 'push': applied=applyImpulse(w,c.id,c.vector);break;
      case 'pause': w.paused=!w.paused;break;
      case 'reset': room.world=createWorld();break;
      case 'gravity': w.gravity=c.value;break;
      case 'field': w.field=c.value;break;
    }
    send(ws,{type:'space-receipt',seq:c.seq,accepted:applied,code:applied?'accepted':'not_applied'});
    if(applied){room.revision++;announce(room);}
  }
  function accept(ws){
    ws.spaceRoom=null;ws.spaceRole=0;ws.countWindow=Date.now();ws.messageCount=0;
    ws.on('message',raw=>{
      const now=Date.now();
      if(now-ws.countWindow>=1000){ws.countWindow=now;ws.messageCount=0;}
      if(++ws.messageCount>20){ws.close(1008,'Rate limit');return;}
      let m;try{m=JSON.parse(raw.toString());}catch{return;}
      if(!m||typeof m!=='object'||Array.isArray(m))return;
      if(m.type==='space-join')join(ws,m);
      else if(m.type==='space-command')command(ws,m);
    });
    ws.on('close',()=>leave(ws));ws.on('error',()=>leave(ws));
  }
  const timer=setInterval(()=>{
    for(const room of rooms.values()){
      if(!room.world.paused)stepWorld(room.world,tickMs/1000);
      room.revision++;announce(room);
    }
  },tickMs);
  timer.unref?.();
  return {accept,rooms,close:()=>{clearInterval(timer);rooms.clear();}};
}
