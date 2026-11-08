import {SPACE_PROTOCOL,ROOM_RE,validateSpaceCommand,validSpaceState} from './protocol.js';
export function spaceEndpoint(value){
  let u;try{u=new URL(String(value||'').trim());}catch{throw new Error('Enter a valid WSS server URL.');}
  const local=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  if(u.protocol!=='wss:'&&!(local&&u.protocol==='ws:'))throw new Error('Use wss:// or local ws://localhost.');
  if(u.username||u.password||u.hash||u.search)throw new Error('Remove URL credentials, query and fragment.');
  u.pathname=u.pathname.replace(/\/+$/,'').replace(/\/space$/,'')+'/space';
  return u.toString();
}
export class SpaceClient{
  constructor(handlers={}){this.handlers=handlers;this.ws=null;this.connected=false;this.role=null;this.epoch=null;this.seq=0;this.revision=-1;}
  emit(kind,payload){this.handlers[kind]?.(payload);}
  connect(endpoint,room){
    const code=String(room||'').trim().toUpperCase();
    if(!ROOM_RE.test(code))throw new Error('Space room requires 8 letters or numbers.');
    const url=spaceEndpoint(endpoint);this.disconnect();
    const ws=new WebSocket(url);this.ws=ws;this.emit('status',{phase:'connecting'});
    ws.addEventListener('open',()=>{if(this.ws===ws)ws.send(JSON.stringify({type:'space-join',room:code}));});
    ws.addEventListener('message',e=>{
      if(this.ws!==ws)return;
      let m;try{m=JSON.parse(e.data);}catch{return;}
      if(!m||typeof m!=='object')return;
      if(m.type==='space-welcome'){
        if(m.protocol!==SPACE_PROTOCOL||m.room!==code||![1,2].includes(m.role)||typeof m.epoch!=='string')return;
        this.connected=true;this.role=m.role;this.epoch=m.epoch;this.revision=-1;
        this.emit('status',{phase:'joined',role:m.role,room:code});
      }else if(m.type==='space-state'){
        if(!this.connected||m.epoch!==this.epoch||!validSpaceState(m)||m.revision<=this.revision)return;
        this.revision=m.revision;this.emit('snapshot',m);
      }else if(m.type==='space-peer-left'){
        if(this.connected&&m.role===1){this.role=1;this.emit('status',{phase:'joined',role:1,room:code});}
      }else if(m.type==='space-peer-joined')this.emit('peerJoined');
      else if(m.type==='space-receipt')this.emit('receipt',m);
      else if(m.type==='space-error'){
        this.emit('error','Space server: '+String(m.code||'error').slice(0,45));
        if(m.fatal)this.disconnect();
      }
    });
    ws.addEventListener('error',()=>{if(this.ws===ws)this.emit('error','WebSocket failed. Check the WSS service.');});
    ws.addEventListener('close',()=>{if(this.ws!==ws)return;this.ws=null;this.connected=false;this.role=null;this.emit('status',{phase:'offline'});});
  }
  command(action,fields={}){
    if(!this.connected||this.ws?.readyState!==WebSocket.OPEN)return false;
    const msg={type:'space-command',seq:++this.seq,action,...fields};
    if(!validateSpaceCommand(msg))return false;
    this.ws.send(JSON.stringify(msg));return true;
  }
  disconnect(){
    const old=this.ws;this.ws=null;this.connected=false;this.role=null;this.epoch=null;this.revision=-1;this.seq=0;
    if(old)old.close();this.emit('status',{phase:'offline'});
  }
}
