import source from './vendor/quaternius-jog.js';
export function createRunClip(THREE) {
 const root=new THREE.Group();
 const nodes=source.nodes.map((n,i)=>{
  const o=new THREE.Object3D();o.name='joint_'+i;
  if(n.translation)o.position.fromArray(n.translation);
  if(n.rotation)o.quaternion.fromArray(n.rotation);
  if(n.scale)o.scale.fromArray(n.scale);
  return o;
 });
 source.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>nodes[i].add(nodes[j])));
 nodes.filter(n=>!n.parent).forEach(n=>root.add(n));
 const paths={translation:'position',rotation:'quaternion',scale:'scale'};
 const tracks=source.tracks.map(t=>new (t.path==='rotation'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack)(
  'joint_'+t.node+'.'+paths[t.path],t.times,t.values));
 const clip=new THREE.AnimationClip(source.name,-1,tracks);
 const mixer=new THREE.AnimationMixer(root);mixer.clipAction(clip).play();
 const names=Object.fromEntries(source.nodes.map((n,i)=>[n.name,nodes[i]]));
 return {duration:clip.duration, sample(phase){
  mixer.setTime(((phase%1)+1)%1*clip.duration);root.updateMatrixWorld(true);
  return Object.fromEntries(Object.entries(names).map(([name,n])=>[name,n.getWorldPosition(new THREE.Vector3())]));
 }};
}
