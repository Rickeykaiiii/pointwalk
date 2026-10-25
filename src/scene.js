import {jumpAt} from './jump-schedule.js';
import * as THREE from './vendor/three.module.js';
import { createWalker } from './walker.js';

// All scenery is generated here. No images, video, network calls or AI assets.
const host = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setClearColor(0x050509);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(53, 1, .1, 170);
const colors = ['#a68ae2','#7d72d5','#739ddd','#e9bb75','#efa179','#62b5ac','#b299e4'];
const palette = colors.map(c => new THREE.Color(c));
const stairPalette = ['#3988d7','#659ee2','#7b72d9','#a17cde','#6b86dc'].map(c=>new THREE.Color(c));
let seed=13417;
const random = () => { seed = (1664525*seed+1013904223)>>>0; return seed/4294967296; };
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const x=clamp((v-a)/(b-a));return x*x*(3-2*x);};
const uniforms = { time:{value:0}, grain:{value:1}, pixelRatio:{value:renderer.getPixelRatio()} };
function makePointMaterial(life={value:1},fade=false) { return new THREE.ShaderMaterial({
  uniforms:{...uniforms,life}, vertexColors:true, transparent:fade, depthWrite:true,
  vertexShader:`attribute float radius; attribute float phase; attribute float heightRank; varying vec3 vColor; varying float vFog; varying float vHeight; uniform float time; uniform float grain; uniform float pixelRatio; uniform float life;
    void main(){vec3 p=position; p.x+=sin(time*.65+phase)*.012; p.y+=cos(time*.6+phase*1.7)*.009;
    vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
    vHeight=heightRank;
    gl_PointSize=clamp(radius*grain*pixelRatio*340./max(2.,-mv.z),.8,11.*pixelRatio);
    vColor=color*(.94+.06*sin(phase+time*1.2)); vFog=smoothstep(38.,115.,-mv.z);}`,
  fragmentShader:`varying vec3 vColor; varying float vFog; varying float vHeight; uniform float life;
    void main(){vec2 q=gl_PointCoord*2.-1.; if(dot(q,q)>1.) discard;
    gl_FragColor=vec4(mix(vColor,vec3(.008,.007,.018),vFog*.93),life);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`
}); }
const pointMaterial=makePointMaterial();
function makeTreeMaterial(life) { return new THREE.ShaderMaterial({
  uniforms:{life}, vertexColors:true, transparent:true,
  vertexShader:`attribute float heightRank;varying vec3 vColor;varying float vHeight;varying vec3 vLocal;
    void main(){vColor=color;vHeight=heightRank;vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float life;varying vec3 vColor;varying float vHeight;varying vec3 vLocal;
    void main(){float grit=fract(sin(dot(floor(vLocal*44.),vec3(12.9898,78.233,37.719)))*43758.5453);
    gl_FragColor=vec4(vColor*mix(.73,1.06,grit),life);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`
}); }
let totalPoints=0;
function pointCloud(points, shades, radii, phases, heights=null, material=pointMaterial) {
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(shades,3));
  g.setAttribute('radius',new THREE.Float32BufferAttribute(radii,1));
  g.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));
  g.setAttribute('heightRank',new THREE.Float32BufferAttribute(heights||radii.map(()=>-1),1));
  totalPoints+=radii.length;
  return new THREE.Points(g,material);
}
const COUNT=36, DEPTH=1.20, RISE=.28, WIDTH=7.5;
const segments=[];
const blackMaterial=new THREE.MeshBasicMaterial({color:0x030307});
const mod=(n,m)=>(n%m+m)%m;
const curve=n=>Math.sin(n*.105)*4.2;
function treadPoint(index,u,v) {
  const phase=index*1.73, width=WIDTH+.55*Math.sin(phase);
  return new THREE.Vector3(
    u*width/2+.10*Math.sin(v*3+phase),
    .10*Math.sin(phase*.8)+u*.17*Math.sin(phase+1.3)+.055*Math.sin(u*5.8+phase)+.035*Math.sin(v*6+u*3+phase),
    -v*DEPTH+.13*Math.sin(u*4.8+phase)+.055*Math.sin(u*11-phase)
  );
}
function makeTread(index) {
  const vertices=[],tri=(a,b,c)=>vertices.push(...a,...b,...c),get=(u,v)=>treadPoint(index,u,v).toArray();
  const NX=32,NZ=8;
  for(let x=0;x<NX;x++)for(let z=0;z<NZ;z++) {
    const a=get(x/NX*2-1,z/NZ),b=get((x+1)/NX*2-1,z/NZ),c=get((x+1)/NX*2-1,(z+1)/NZ),d=get(x/NX*2-1,(z+1)/NZ);
    tri(a,b,c);tri(a,c,d);
  }
  for(let x=0;x<NX;x++) {
    const a=get(x/NX*2-1,0),b=get((x+1)/NX*2-1,0),c=[b[0],b[1]-.66,b[2]],d=[a[0],a[1]-.66,a[2]];
    tri(a,d,c);tri(a,c,b);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  return new THREE.Mesh(g,blackMaterial);
}
function makeSegment(index) {
  const group=new THREE.Group(), trees=new THREE.Group(), stairs=new THREE.Group(), p=[],c=[],r=[],ph=[],ranks=[],occlusion=[],bodyColors=[],bodyRanks=[];
  const life={value:0}; group.userData={trees,stairs,life};group.add(trees,stairs);
  function add(x,y,z,color,size=1,rank=-1) {
    p.push(x,y,z); const shade=random()<.17?.09:.76+random()*.4;
    c.push(color.r*shade,color.g*shade,color.b*shade);
    r.push((.085+random()*.075)*size); ph.push(random()*Math.PI*2);
    ranks.push(rank);
  }
  // Each blue/purple tread has a bowed, ragged edge and a slightly tilted top.
  for(let j=0;j<3300;j++) {
    const u=random()*2-1,v=random(),point=treadPoint(index,u,v);
    const color=stairPalette[Math.floor((u+1)*1.4+v*.8+index*.63)%stairPalette.length];
    add(point.x,point.y+.016,point.z,color,.9);
  }
  stairs.add(makeTread(index));stairs.add(pointCloud(p,c,r,ph));
  p.length=c.length=r.length=ph.length=ranks.length=0;
  // Keep the original tree count, placing each inner canopy edge beside the
  // tread instead of leaving a wide strip of empty ground along the stairs.
  for(const side of [-1,1]) {
    for(let j=0;j<2;j++) {
      // Mix distinct proportions as well as independent size variations, so
      // neighboring crowns are visibly squat, slender, broad or small.
      const profile=Math.floor(random()*4);
      const proportions=[
        {h:[1.3,3.2],x:[.70,1.65],z:[.55,1.5]},
        {h:[6.8,11.0],x:[.55,1.25],z:[.60,1.8]},
        {h:[2.2,4.5],x:[1.90,3.25],z:[1.10,2.9]},
        {h:[3.6,8.0],x:[1.05,2.55],z:[.70,3.0]}
      ][profile];
      const pick=range=>range[0]+random()*(range[1]-range[0]);
      const height=pick(proportions.h),rx=pick(proportions.x),rz=pick(proportions.z);
      const stairEdge=(WIDTH+.55*Math.sin(index*1.73))/2;
      const cx=side*(stairEdge+rx-.65+random()*.10);
      const cz=-(j*.5+.08+random()*.30)*DEPTH;
      const color=palette[(index*2+j+(side+1)*2)%palette.length];
      const solid=new THREE.SphereGeometry(1,28,20).toNonIndexed();
      const vertices=solid.getAttribute('position');
      for(let vtx=0;vtx<vertices.count;vtx++) {
        const vx=vertices.getX(vtx),vy=vertices.getY(vtx),vz=vertices.getZ(vtx);
        const angle=Math.atan2(vz,vx),wave=1+.12*Math.sin(angle*5+vy*8)+.07*Math.sin(angle*9-vy*4);
        occlusion.push(cx+vx*rx*wave*.99,height*.5+vy*height*.5*.99,cz+vz*rz*wave*.99);
        const light=.47+.23*Math.max(0,vx*.25+vy*.5+vz*.8);
        bodyColors.push(color.r*light,color.g*light,color.b*light);
        bodyRanks.push((vy+1)/2);
      }
      solid.dispose();
      for(let k=0;k<2200;k++) {
        const theta=random()*Math.PI*2,v=random()*2-1;
        const ring=Math.sqrt(1-v*v),wav=1+.12*Math.sin(theta*5+v*8)+.07*Math.sin(theta*9-v*4);
        const x=cx+Math.cos(theta)*ring*rx*wav;
        const y=height*.5+v*height*.5;
        const z=cz+Math.sin(theta)*ring*rz*wav;
        const speck=random();
        const shade=speck<.11?palette[(index+j+3)%palette.length]:color;
        add(x,y,z,shade,1.1,(v+1)/2);
      }
    }
  }
  const occlusionGeometry=new THREE.BufferGeometry();
  occlusionGeometry.setAttribute('position',new THREE.Float32BufferAttribute(occlusion,3));
  occlusionGeometry.setAttribute('color',new THREE.Float32BufferAttribute(bodyColors,3));
  occlusionGeometry.setAttribute('heightRank',new THREE.Float32BufferAttribute(bodyRanks,1));
  trees.add(new THREE.Mesh(occlusionGeometry,makeTreeMaterial(life)));
  trees.add(pointCloud(p,c,r,ph,ranks,makePointMaterial(life,true)));scene.add(group);return group;
}
for(let i=0;i<COUNT;i++) segments.push(makeSegment(i));

// Full-viewport star background: clip-space coverage stays full on any aspect.
{
 const p=[],c=[],r=[],ph=[];
 for(let i=0;i<2400;i++) {
  p.push(random()*2-1,random()*2-1,0);
  const col=palette[i%7],kind=random();
  const size=kind<.72?.65+random()*.65:kind<.95?1.4+random()*1.2:2.8+random()*1.8;
  const light=.45+random()*.5;
  c.push(col.r*light,col.g*light,col.b*light);r.push(size);ph.push(random()*6.28);
 }
 const starMaterial=new THREE.ShaderMaterial({
  uniforms,vertexColors:true,depthWrite:false,depthTest:true,
  vertexShader:`attribute float radius;attribute float phase;varying vec3 vColor;
    uniform float time;uniform float pixelRatio;
    void main(){gl_Position=vec4(position.xy,.99999,1.);
      gl_PointSize=radius*pixelRatio;
      vColor=color*(.88+.12*sin(time*.7+phase));}`,
  fragmentShader:`varying vec3 vColor;
    void main(){vec2 q=gl_PointCoord*2.-1.;float d=dot(q,q);if(d>1.)discard;
      gl_FragColor=vec4(vColor*(1.-.35*d),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
 });
 const stars=pointCloud(p,c,r,ph,null,starMaterial);
 stars.frustumCulled=false;stars.renderOrder=-1000;scene.add(stars);
}

// Keep the running zone (roughly d=5..8) fixed; animate only distant or
// foreground treads. Use the same offset for drawing and contact sampling.
function stairOffset(d) {
 return -12*smooth(10,19,d)-12*(1-smooth(-8,-4,d));
}
// Foot contacts are sampled from these exact moving and irregular tread surfaces.
const walker=createWalker(THREE,scene,camera);
function sampleGround(stepCoordinate,lateralOffset=0) {
  const n=Math.floor(stepCoordinate),index=mod(n,COUNT),v=stepCoordinate-n;
  const width=WIDTH+.55*Math.sin(index*1.73);
  const point=treadPoint(index,lateralOffset/(width/2),v);
  const yaw=-(curve(n+.05)-curve(n))/.05/DEPTH;
  point.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
  return point.add(new THREE.Vector3(curve(n)-curve(progress),(n-progress)*RISE+stairOffset(n-progress),-(n-progress)*DEPTH));
}
function sampleHeading(stepCoordinate) {
  return new THREE.Vector3((curve(stepCoordinate+.12)-curve(stepCoordinate-.12))/.24,0,-DEPTH).normalize();
}

// Locked presentation: authored pace and grain are both fixed at 1.0.
const SPEED=1.0;
uniforms.grain.value=1.0;
const requestedFrame=new URLSearchParams(location.search).get('frame');
const initialTime=requestedFrame!==null&&Number.isFinite(Number(requestedFrame))?Math.max(0,Number(requestedFrame)):0;
const PACE=2.3;
let running=requestedFrame===null,progress=initialTime*PACE,elapsed=initialTime,last=performance.now(),dirty=true;
let pointerX=0,pointerY=0,lookX=0,lookY=0;
window.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){pointerX=(e.clientX/innerWidth-.5)*.5;pointerY=(e.clientY/innerHeight-.5)*.22;}});
window.addEventListener('pointerout',e=>{if(!e.relatedTarget){pointerX=0;pointerY=0;}});
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<650?56:53;camera.updateProjectionMatrix();dirty=true;}
addEventListener('resize',resize);resize();
function render(now) {
  requestAnimationFrame(render);
  const dt=Math.min((now-last)/1000,.06);last=now;
  const moving=running&&!document.hidden;
  if(moving) {const step=dt*SPEED;elapsed+=step;}
  if(!moving&&!dirty&&Math.abs(pointerX-lookX)+Math.abs(pointerY-lookY)<.001)return;
  dirty=false;
  const jump=jumpAt(elapsed);
  progress=elapsed*PACE+jump.advance;
  uniforms.time.value=elapsed;
  for(let slot=0;slot<COUNT;slot++) {
    // Keep old segments well behind the camera before recycling them, so
    // foreground trees leave the frame naturally rather than popping away.
    const n=slot+COUNT*Math.ceil((progress-9-slot)/COUNT),d=n-progress;
    segments[slot].position.set(curve(n)-curve(progress),d*RISE,-d*DEPTH);
    segments[slot].rotation.y=-(curve(n+.05)-curve(n))/.05/DEPTH;
    const stairs=segments[slot].userData.stairs;
    stairs.position.y=stairOffset(d);
    stairs.visible=d>-8&&d<19;
    // Whole trees rise on entry and sink before reaching the camera.
    // Start ahead of the camera so even the widest/tallest crowns clear it.
    const stagger=Math.sin(slot*2.37)*.65;
    const life=1-smooth(7.5,14.5,d+stagger);
    const exit=1-smooth(-3,2,d);
    segments[slot].userData.trees.position.y=-13*(1-life)-16*exit;
    segments[slot].userData.life.value=smooth(0,.12,life)*smooth(0,.04,1-exit);
    segments[slot].userData.trees.visible=life>.0001&&exit<.9999;
  }
  const follow=1-Math.exp(-dt*3); lookX+=(pointerX-lookX)*follow;lookY+=(pointerY-lookY)*follow;
  camera.position.set(1.7+lookX,4.35+lookY,8.8);
  camera.lookAt(-.25,4.4,-19);
  walker.update(progress,elapsed,sampleGround,sampleHeading,jump);
  renderer.render(scene,camera);
  // Read-only diagnostics for local QA; not part of the interface.
  window.pointwalk={points:totalPoints,running,progress,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,walker:walker.getDebug?.()};
  renderer.domElement.dataset.points=String(totalPoints);
  renderer.domElement.dataset.progress=progress.toFixed(3);
  renderer.domElement.dataset.running=String(running);
  renderer.domElement.dataset.motion=walker.getDebug().mode;
}
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();const s=document.querySelector('#status');s.hidden=false;s.textContent='繪圖連線暫時中斷，請重新整理頁面。';});
document.querySelector('#status').hidden=true;
requestAnimationFrame(render);
