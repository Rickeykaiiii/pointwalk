// Continuous forward motion with a 0.45-second crouch before each jump.
let seed=18473,end=0,total=0;
const events=[];
const PACE=2.3,CROUCH=.45;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const ease=t=>t*t*t*(t*(t*6-15)+10);
export function jumpAt(time){
 while(end<time+13){
  const preparation=end+5+random()*7,start=preparation+CROUCH;
  const duration=.92+random()*.16,stairs=3+Math.floor(random()*2);
  const loss=0,extra=stairs-duration*PACE;
  events.push({preparation,start,duration,stairs,loss,extra,before:total});
  total+=extra-loss;end=start+duration;
 }
 let advance=0;
 for(const e of events){
  if(time<e.preparation)break;
  if(time>=e.start+e.duration){advance=e.before+e.extra-e.loss;continue;}
  if(time<e.start){
   const crouch=ease((time-e.preparation)/CROUCH);
   return {advance:e.before,height:-.32*crouch,blend:0,crouch,stage:'crouch',stairs:e.stairs};
  }
  const phase=(time-e.start)/e.duration,lift=Math.sin(Math.PI*phase)**2;
  const crouch=1-ease(Math.min(1,phase/.22));
  return {advance:e.before-e.loss+e.extra*ease(phase),height:1.30*lift-.32*crouch,blend:lift,crouch,stage:'jump',stairs:e.stairs};
 }
 return {advance,height:0,blend:0,crouch:0,stage:'run',stairs:0};
}
