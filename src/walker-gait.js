import {createGait as createSupport} from './stair-support.js';
import {createRunClip} from './run-clip.js';

// Original Quaternius animation drives the pose. Terrain is a correction layer.
export function createGait(THREE) {
 const support=createSupport(THREE), clip=createRunClip(THREE);
 const UP=new THREE.Vector3(0,1,0);
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 return {update(progress,elapsed,sampleGround,headingAt,jump={}){
  const pose=support.update(progress,elapsed,sampleGround,headingAt);
  const cycle=(pose.debug.event+pose.debug.phase)/2;
  const source=clip.sample(cycle);
  const {forward,right}=pose;
  const airborne=jump.blend || 0;
  const direction=(a,b)=>{
   const d=source[b].clone().sub(source[a]).normalize();
   return right.clone().multiplyScalar(-d.x).addScaledVector(UP,d.y).addScaledVector(forward,d.z);
  };
  // Retarget segment directions, not source body dimensions. The existing
  // short legs, low shoulders and hood silhouette remain unchanged.
  pose.pelvis.y+=(source.pelvis.y-.84)*.30 - .12 + (jump.height || 0);
  pose.chest.copy(pose.pelvis).addScaledVector(direction('pelvis','spine_03'),.79)
    .addScaledVector(forward,.13);
  pose.head.copy(pose.chest).addScaledVector(direction('spine_03','Head'),.41);
  for(const leg of pose.legs){
   const suffix=leg.side<0?'l':'r';
   leg.hip.copy(pose.pelvis).addScaledVector(right,leg.side*.20);
   const upper=direction('thigh_'+suffix,'calf_'+suffix);
   const lower=direction('calf_'+suffix,'foot_'+suffix);
   const animatedKnee=leg.hip.clone().addScaledVector(upper,.63);
   const animatedFoot=animatedKnee.clone().addScaledVector(lower,.61);
   const terrainFoot=leg.ankle.clone(), terrainToe=leg.toe.clone();
   // Lock the support foot, fade out during toe-off, fade back for landing.
   // The middle of the swing is entirely the imported animation.
   const lock=(leg.planted?1:Math.max(1-ease(leg.swing/.20),ease((leg.swing-.78)/.22)))*(1-ease(airborne/.30));
   leg.ankle.copy(animatedFoot).lerp(terrainFoot,lock);
   // Raise only as needed to clear the next riser, with a continuous envelope.
   const swingClearance=leg.planted?0:Math.sin(Math.PI*leg.swing)**2;
   const floor=terrainFoot.y-.20;
   leg.ankle.y+=Math.max(0,floor-leg.ankle.y)*swingClearance;
   // Airborne feet follow the pelvis instead of reaching back to a tread.
   // A compact tuck keeps both knees bent without changing bone lengths.
   const tuck=ease(airborne/.65);
   const tuckedFoot=leg.hip.clone().addScaledVector(UP,-.69)
     .addScaledVector(forward,-.13);
   leg.ankle.lerp(tuckedFoot,tuck);
   const delta=leg.ankle.clone().sub(leg.hip), distance=delta.length();
   const axis=delta.clone().divideScalar(Math.max(distance,.001));
   // A soft reach cap prevents numerical straight-leg flips.
   const d=Math.max(.16,Math.min(1.215,distance));
   if(distance>1.215 || distance<.16)leg.ankle.copy(leg.hip).addScaledVector(axis,d);
   const along=(.63**2-.61**2+d*d)/(2*d);
   // Preserve a stable forward knee plane while terrain changes the target.
   const pole=forward.clone().addScaledVector(axis,-forward.dot(axis)).normalize();
   leg.knee.copy(leg.hip).addScaledVector(axis,along)
     .addScaledVector(pole,Math.sqrt(Math.max(0,.63**2-along**2)));
   if(!leg.planted || airborne>0){
    const toeDirection=direction('foot_'+suffix,'ball_'+suffix);
    const targetDirection=terrainToe.clone().sub(leg.ankle).normalize();
    toeDirection.lerp(targetDirection,lock).normalize();
    leg.toe.copy(leg.ankle).addScaledVector(toeDirection,.31);
   }
  }
  if(airborne>0) pose.legs.forEach(leg=>{leg.planted=false;});
  for(const arm of pose.arms){
   const suffix=arm.side<0?'l':'r';
   arm.shoulder.copy(pose.chest).addScaledVector(right,arm.side*.345).addScaledVector(UP,-.065).addScaledVector(forward,.30);
   arm.elbow.copy(arm.shoulder).addScaledVector(direction('upperarm_'+suffix,'lowerarm_'+suffix),.43);
   arm.wrist.copy(arm.elbow).addScaledVector(direction('lowerarm_'+suffix,'hand_'+suffix),.37);
  }
  if((jump.crouch||0)>0 && airborne===0){pose.mode='crouch';pose.debug.mode='crouch';}
  if(airborne>0){pose.mode='jump';pose.debug.mode='jump';}
  pose.debug.jumpStairs=jump.stairs || 0;
  pose.debug.controller='quaternius-jog-retarget';
  pose.debug.animation='Quaternius / Jog_Fwd_Loop';
  pose.debug.clipDuration=clip.duration;
  pose.debug.maxLegDistance=Math.max(...pose.legs.map(l=>l.hip.distanceTo(l.ankle)));
  return pose;
 }};
}
