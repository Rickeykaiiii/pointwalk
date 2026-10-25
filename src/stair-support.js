// Stair-run controller: authored recovery poses + world-space foot contacts +
// analytic two-bone IK. See MOTION-SOURCES.txt for design references.
export function createGait(THREE) {
  const UP = new THREE.Vector3(0, 1, 0);
  const STEP = 1, THIGH = .63, SHIN = .61, SOLE = .13;
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
  const mod = (v,n) => (v%n+n)%n;
  const ease = v => { v=clamp(v); return v*v*v*(v*(v*6-15)+10); };
  const pulse = v => v<=0||v>=1 ? 0 : Math.sin(Math.PI*v)**2;
  // One alternating contact per tread: left and right always land on
  // consecutive stair indices; each same-side stride advances two stairs.
  const coordinate = k => .28 + k*STEP;
  // C1 Hermite pose track. End velocities are zero so locked feet release and
  // land continuously; internal tangents carry momentum through the poses.
  function track(keys,t) {
    let i=0;
    while(i<keys.length-2 && t>keys[i+1][0]) i++;
    const [ta,a]=keys[i], [tb,b]=keys[i+1], h=tb-ta, u=clamp((t-ta)/h);
    const tangent=j=> j===0||j===keys.length-1 ? new THREE.Vector3() :
      keys[j+1][1].clone().sub(keys[j-1][1]).divideScalar(keys[j+1][0]-keys[j-1][0]);
    return a.clone().multiplyScalar(2*u**3-3*u*u+1)
      .addScaledVector(tangent(i),h*(u**3-2*u*u+u))
      .addScaledVector(b,-2*u**3+3*u*u)
      .addScaledVector(tangent(i+1),h*(u**3-u*u));
  }
  function solveKnee(hip,ankle,forward) {
    const axis=ankle.clone().sub(hip), d=axis.length(); axis.divideScalar(Math.max(d,.001));
    const reach=clamp(d,.03,THIGH+SHIN-.002);
    const along=(THIGH**2-SHIN**2+reach**2)/(2*reach);
    const pole=forward.clone().addScaledVector(axis,-forward.dot(axis)).normalize();
    return hip.clone().addScaledVector(axis,along)
      .addScaledVector(pole,Math.sqrt(Math.max(0,THIGH**2-along**2)));
  }
  return { update(progress,elapsed,sampleGround,headingAt) {
    const time=(progress+6.3-.28)/STEP+.5;
    const event=Math.floor(time), phase=time-event;
    const forward=headingAt(progress+6.3).clone().normalize();
    const right=new THREE.Vector3(-forward.z,0,forward.x);
    const center=k=>sampleGround(coordinate(k),0);
    const contact=(k,side)=>sampleGround(coordinate(k),side*.19);
    const p0=center(event-1), p1=center(event), p2=center(event+1);
    const pelvis=p0.clone().multiplyScalar(.5*(1-phase)**2)
      .addScaledVector(p1,.75-(phase-.5)**2).addScaledVector(p2,.5*phase**2);
    const supportHeight=pelvis.y;
    const strideAngle=Math.PI*time;
    // A broad, low rise follows the support exchange, not a sharp impact pulse.
    const boundPhase=mod(time-10,16);
    const bound=.075*pulse(boundPhase/2);
    pelvis.y+=1.08+.035*(1-Math.cos(2*Math.PI*(phase-.12)))/2+bound;
    pelvis.addScaledVector(right,.025*Math.sin(strideAngle-.25));

    const legs=[-1,1].map((side,i)=>{
      const last=Math.floor((time-i)/2)*2+i, age=time-last;
      const from=contact(last,side), to=contact(last+2,side);
      const toeOff=.70, planted=age<=toeOff;
      const swing=clamp((age-toeOff)/(2-toeOff));
      const roll=planted?ease((age-.36)/(toeOff-.36)):1-ease(swing/.32);
      const footForward=headingAt(coordinate(last)).clone()
        .lerp(headingAt(coordinate(last+2)),ease(swing)).normalize();
      let ankle;
      if(planted) {
        // Toe stays on the same tread while the heel rises for push-off.
        ankle=from.clone().addScaledVector(UP,SOLE+.10*roll)
          .addScaledVector(footForward,.025*roll);
      } else {
        const start=from.clone().addScaledVector(UP,SOLE+.10).addScaledVector(footForward,.025);
        const finish=to.clone().addScaledVector(UP,SOLE);
        // Recover heel toward the seat; lift knee over the riser; reach forward
        // only after clearance. Do not interpolate a straight extended leg.
        const recovery=from.clone().lerp(to,.15).addScaledVector(UP,.68+bound)
          .addScaledVector(footForward,-.10);
        const drive=from.clone().lerp(to,.68);
        drive.y=Math.max(from.y,to.y)+.50+bound;
        const approach=from.clone().lerp(to,.96).addScaledVector(UP,.29);
        ankle=track([[0,start],[.28,recovery],[.60,drive],[.83,approach],[1,finish]],swing);
        // Keep the ankle below the hip: a folded running knee must never pass
        // through the hip/ankle singularity and flip its bend plane.
        const ceiling=pelvis.y-.30;
        ankle.y=.5*(ankle.y+ceiling-Math.sqrt((ankle.y-ceiling)**2+.0001));
      }
      const pitch=planted?-.30*roll:-.30*(1-ease(swing/.35))+.12*pulse(swing);
      const toe=planted ? from.clone().addScaledVector(footForward,.32).addScaledVector(UP,.12) :
        ankle.clone().addScaledVector(footForward,.32*Math.cos(pitch)).addScaledVector(UP,.32*Math.sin(pitch)-.01);
      const stage=planted?(age<.28?'load':'push'):swing<.34?'recover':swing<.76?'drive':'land';
      return {side,ankle,toe,footForward,planted,contact:from,contactCoordinate:coordinate(last),
        age,swing,heelRoll:roll,lift:ankle.y-from.y-SOLE,stage};
    });
    // Reach correction is only a safety layer after the authored pose. Smooth
    // minimum avoids a hard knee lock when a warped tread is unusually low.
    for(const leg of legs) {
      const hip=pelvis.clone().addScaledVector(right,leg.side*.20);
      const horizontal=Math.hypot(hip.x-leg.ankle.x,hip.z-leg.ankle.z);
      const roof=leg.ankle.y+Math.sqrt(Math.max(.02,1.20**2-horizontal**2));
      pelvis.y=.5*(pelvis.y+roof-Math.sqrt((pelvis.y-roof)**2+.0004));
    }
    const twist=Math.sin(strideAngle-.22);
    const chest=pelvis.clone().addScaledVector(UP,.755).addScaledVector(forward,.24+.025*bound)
      .addScaledVector(right,-.018*twist);
    const head=chest.clone().addScaledVector(UP,.405).addScaledVector(forward,.055);
    let maxLegDistance=0;
    for(const leg of legs) {
      leg.hip=pelvis.clone().addScaledVector(right,leg.side*.20).addScaledVector(forward,leg.side*.025*twist);
      leg.knee=solveKnee(leg.hip,leg.ankle,forward);
      maxLegDistance=Math.max(maxLegDistance,leg.hip.distanceTo(leg.ankle));
    }
    const arms=legs.map(leg=>{
      const side=leg.side;
      // Same-side arm is back as the foot lands forward. The opposing arm
      // leads with a slight phase delay and a relaxed elbow on the backswing.
      const wave=-Math.cos(Math.PI*leg.age-.24);
      const shoulder=chest.clone().addScaledVector(right,side*.345)
        .addScaledVector(UP,-.065).addScaledVector(forward,-side*.045*twist);
      const upper=.08+.64*wave, flex=1.28+.22*wave;
      const elbow=shoulder.clone().addScaledVector(forward,.43*Math.sin(upper))
        .addScaledVector(UP,-.43*Math.cos(upper)).addScaledVector(right,side*.12);
      const wrist=elbow.clone().addScaledVector(forward,.36*Math.sin(upper+flex))
        .addScaledVector(UP,-.36*Math.cos(upper+flex)).addScaledVector(right,-side*.07);
      return {side,shoulder,elbow,wrist};
    });
    const mode=boundPhase<2?'bound':'run';
    return {pelvis,chest,head,forward,right,legs,arms,mode,
      debug:{mode,controller:'stair-run-v2',progress,event,phase,stride:STEP,
        stages:legs.map(l=>l.stage),planted:legs.map(l=>l.planted),
        contactCoordinates:legs.map(l=>l.contactCoordinate),maxLegDistance,legReach:THIGH+SHIN,
        pelvisHeight:pelvis.y-supportHeight,headHeight:head.y-supportHeight+.315,elapsed}};
  }};
}
