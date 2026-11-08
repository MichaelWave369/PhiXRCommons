/* ΦSpace R3 · local, bounded, one-shot OverStrings adapter. No global events. */
import {GestureTracker,JOINT_NAMES} from './overstrings/gesture.mjs';
import {PhiPoseInterpreter} from './overstrings/phipose.mjs';
export const POSE_ACTIONS=Object.freeze({
 'spacedynamics.select-next':Object.freeze({script:'L:open > R:pinch',label:'SELECT NEXT ORB'}),
 'spacedynamics.push':Object.freeze({script:'R:open > R:pinch',label:'PUSH SELECTED ORB'})
});
export const PERMIT_MS=120000,ARM_MS=45000;
export class SpaceGestureBridge{
 constructor({onAction=()=>{},onStatus=()=>{}}={}){
   this.onAction=onAction;this.onStatus=onStatus;this.tracker=new GestureTracker();
   this.permission=null;this.engine=null;this.armedUntil=0;
 }
 get enabled(){return this.permission!==null;}
 get armed(){return this.engine?.armed===true;}
 cancel(reason){
   this.engine?.disarm();this.engine=null;this.armedUntil=0;this.tracker.reset();
   if(reason)this.onStatus(reason);
 }
 disable(reason='Gesture control disabled'){
   this.cancel();this.permission=null;this.onStatus(reason);
 }
 enable(now,{source='webxr',allowSyntheticDemo=false}={}){
   this.disable();
   if(!Number.isFinite(now)||now<0||
     !['webxr','synthetic'].includes(source)||
     (source==='synthetic'&&!allowSyntheticDemo))throw new TypeError('Explicit source and demo opt-in required');
   this.permission={source,allowSyntheticDemo,until:now+PERMIT_MS};
   this.onStatus('Enabled for 2 minutes. Arm one sentence explicitly.');
 }
 tick(now){
   if(!Number.isFinite(now)||now<0)return;
   if(this.permission && now>=this.permission.until)this.disable('Gesture permit expired');
   else if(this.armed&&now>=this.armedUntil)this.cancel('One-shot phrase expired; re-arm');
 }
 arm(action,now){
   this.tick(now);
   if(!this.enabled||!Number.isFinite(now)||!Object.hasOwn(POSE_ACTIONS,action))return false;
   this.cancel();
   this.engine=new PhiPoseInterpreter({advisoryActionIds:Object.keys(POSE_ACTIONS)});
   this.engine.configure({script:POSE_ACTIONS[action].script,actionId:action,
     source:this.permission.source,allowSyntheticDemo:this.permission.allowSyntheticDemo});
   if(!this.engine.arm().armed){this.cancel();return false;}
   this.armedUntil=Math.min(now+ARM_MS,this.permission.until);
   this.onStatus('Armed: '+POSE_ACTIONS[action].script);
   return true;
 }
 ingest(evt,now){
   this.tick(now);
   if(!this.armed)return {accepted:false,reason:'not_armed'};
   if(evt?.phase==='lost'){this.cancel('Hand tracking lost; disarmed');return {accepted:false,reason:'tracking_lost'};}
   if(evt?.phase!=='start'||evt.gesture==='neutral')return {accepted:false,reason:'ignored'};
   const result=this.engine.consume(evt,now);
   if(result.accepted){
     const id=result.intent.action_id;
     this.cancel();
     if(!Object.hasOwn(POSE_ACTIONS,id))return {accepted:false,reason:'disallowed'};
     this.onAction(id);
     this.onStatus('Recognized '+POSE_ACTIONS[id].label+'. Re-arm to repeat.');
   }else if(!this.engine?.armed)this.cancel('Phrase rejected: '+result.reason);
   return result;
 }
 updateHand(hand,joints,now){
   this.tick(now);
   if(!this.armed||this.permission?.source!=='webxr')return [];
   const events=this.tracker.update(hand,joints,now,'webxr');
   for(const event of events){this.ingest(event,now);if(!this.armed)break;}
   return events;
 }
 sample(frame,session,referenceSpace,now){
   this.tick(now);
   if(!this.armed||this.permission?.source!=='webxr')return;
   if(!frame||!referenceSpace||!session?.inputSources){
     this.cancel('XR frame unavailable; disarmed');return;
   }
   const sources=Array.from(session.inputSources);
   for(const hand of ['left','right']){
     if(!this.armed)break;
     const input=sources.find(s=>s.handedness===hand&&s.hand);
     const joints={};let valid=Boolean(input?.hand&&frame.getJointPose);
     if(valid)try{
       for(const name of JOINT_NAMES){
         const s=input.hand.get(name),pose=s&&frame.getJointPose(s,referenceSpace);
         const p=pose?.transform?.position;
         if(!p||![p.x,p.y,p.z].every(Number.isFinite)){valid=false;break;}
         joints[name]={x:p.x,y:p.y,z:p.z};
       }
     }catch{valid=false;}
     this.updateHand(hand,valid?joints:null,now);
   }
 }
 synthetic(hand,gesture,now){
   this.tick(now);
   if(!this.armed||this.permission?.source!=='synthetic')return {accepted:false,reason:'demo_disabled'};
   return this.ingest({type:'overstrings.gesture',version:1,source:'synthetic',
     handedness:hand,gesture,phase:'start',timestamp_ms:Math.round(now)},now);
 }
}
