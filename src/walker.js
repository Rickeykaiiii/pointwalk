import { createGait } from './walker-gait.js';

// Project a grounded 3D pose, union its shapes, then erase the fill. The result
// is one transparent chalk contour with scenery visible inside, without joints.
export function createWalker(THREE, scene, camera) {
  const group = new THREE.Group();
  group.name = 'continuous-outline-climber';
  scene.add(group);
  const gait = createGait(THREE);
  const MODEL_SCALE = 1.22;
  const width = 384, height = 512, span = 3.6 * MODEL_SCALE;
  const ink = document.createElement('canvas');
  const mask = document.createElement('canvas');
  ink.width = mask.width = width;
  ink.height = mask.height = height;
  const ctx = ink.getContext('2d');
  const fill = mask.getContext('2d');
  const texture = new THREE.CanvasTexture(ink);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const material = new THREE.ShaderMaterial({
    uniforms: { drawing: { value: texture }, bounds: { value: new THREE.Vector4() } },
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; uniform vec4 bounds;
      void main(){vUv=uv;gl_Position=vec4(bounds.xy+uv*bounds.zw,0.,1.);}`,
    fragmentShader: `varying vec2 vUv; uniform sampler2D drawing;
      float grain(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        // Stationary dry-brush fibers: no time-based noise or flickering ink.
        vec2 paper=vUv*vec2(384.,512.);
        float edge=grain(floor(paper*.65));
        vec2 warp=vec2(sin(paper.y*.47),sin(paper.x*.61))*.0009;
        vec4 ink=texture2D(drawing,vUv+warp);
        float tooth=grain(floor(paper*1.8));
        float fibers=.68+.32*grain(vec2(floor(paper.x*2.5),floor(paper.y*.16)));
        ink.a*=fibers*(.72+.28*tooth);
        float fringe=texture2D(drawing,vUv+warp+vec2(.0018,-.0012)).a;
        ink.a=max(ink.a,fringe*.19*edge);
        gl_FragColor=vec4(vec3(1.,.985,.945),ink.a);
      }`
  });
  const drawing = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  drawing.frustumCulled = false;
  drawing.renderOrder = 1000;
  group.add(drawing);
  const up = new THREE.Vector3(0, 1, 0);
  const cameraRight = new THREE.Vector3();
  let debug = {}, center, sx, sy;

  function project(point) {
    const p = point.clone().project(camera);
    return [(p.x - center.x) * sx + width / 2, height / 2 - (p.y - center.y) * sy];
  }
  function offset(point, right, x, y = 0) {
    return point.clone().addScaledVector(right, x * MODEL_SCALE).addScaledVector(up, y * MODEL_SCALE);
  }
  function paint(path) {
    ctx.fill(path); ctx.stroke(path); fill.fill(path);
  }
  function roundedPolygon(points, softness = .2) {
    const path = new Path2D();
    for (let i = 0; i < points.length; i++) {
      const p = points[i], prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
      const a = [p[0] + (prev[0] - p[0]) * softness, p[1] + (prev[1] - p[1]) * softness];
      const b = [p[0] + (next[0] - p[0]) * softness, p[1] + (next[1] - p[1]) * softness];
      if (i === 0) path.moveTo(...a); else path.lineTo(...a);
      path.quadraticCurveTo(...p, ...b);
    }
    path.closePath(); return path;
  }
  function ribbon(worldPoints, radii, softness = .23) {
    const points = worldPoints.map(project);
    const unit = width / span * MODEL_SCALE;
    // Union individual segments so a folded elbow or knee never flips its
    // contour. Joint discs are erased with the fill and leave no visible seam.
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.max(.001, Math.hypot(dx, dy));
      const nx = -dy / d, ny = dx / d, ra = radii[i] * unit, rb = radii[i + 1] * unit;
      paint(roundedPolygon([
        [a[0] + nx * ra, a[1] + ny * ra], [b[0] + nx * rb, b[1] + ny * rb],
        [b[0] - nx * rb, b[1] - ny * rb], [a[0] - nx * ra, a[1] - ny * ra]
      ], softness * .25));
    }
    points.forEach((p, i) => {
      const cap = new Path2D(); cap.arc(p[0], p[1], radii[i] * unit, 0, Math.PI * 2); paint(cap);
    });
  }
  function body(pose) {
    const { pelvis, chest, head, right } = pose;
    const p = new Path2D();
    const at = (v, x, y) => project(offset(v, right, x, y));
    const leftShoulder = pose.arms.find(arm => arm.side < 0).shoulder;
    const rightShoulder = pose.arms.find(arm => arm.side > 0).shoulder;
    // The rounded hood flows into sloping shoulders and an elongated torso.
    p.moveTo(...at(head, -.215, -.12));
    p.bezierCurveTo(...at(head, -.225, .08), ...at(head, -.19, .21), ...at(head, .015, .215));
    p.bezierCurveTo(...at(head, .225, .21), ...at(head, .21, .07), ...at(head, .235, -.14));
    p.quadraticCurveTo(...at(head, .255, -.24), ...project(offset(rightShoulder, right, .035, .045)));
    p.quadraticCurveTo(...at(chest, .365, -.17), ...at(pelvis, .32, .06));
    p.quadraticCurveTo(...at(pelvis, .31, -.125), ...at(pelvis, .13, -.14));
    p.lineTo(...at(pelvis, -.14, -.14));
    p.quadraticCurveTo(...at(pelvis, -.34, -.14), ...at(pelvis, -.325, .07));
    p.quadraticCurveTo(...at(chest, -.37, -.16), ...project(offset(leftShoulder, right, -.035, .045)));
    p.quadraticCurveTo(...at(head, -.27, -.25), ...at(head, -.215, -.12));
    p.closePath(); paint(p);
  }

  function update(progress, elapsed, sampleGround, headingAt, jump = {}) {
    // Solve contacts in scaled rig space, then return to world space. This
    // enlarges the whole figure while keeping planted feet on their treads.
    const pose = gait.update(progress, elapsed,
      (s, lateral = 0) => sampleGround(s, lateral * MODEL_SCALE).divideScalar(MODEL_SCALE), headingAt, {...jump, height:(jump.height || 0)/MODEL_SCALE});
    const joints = new Set([pose.pelvis, pose.chest, pose.head,
      ...pose.legs.flatMap(l => [l.hip, l.knee, l.ankle, l.toe]),
      ...pose.arms.flatMap(a => [a.shoulder, a.elbow, a.wrist])]);
    joints.forEach(p => p.multiplyScalar(MODEL_SCALE));
    // Narrow the limb silhouette in the character's own sideways axis.
    // Forward/backward motion from the imported clip is preserved.
    for (const leg of pose.legs) {
      for (const joint of [leg.hip, leg.knee, leg.ankle, leg.toe]) {
        const lateral = joint.clone().sub(pose.pelvis).dot(pose.right);
        joint.addScaledVector(pose.right, -lateral * .16);
      }
    }
    for (const arm of pose.arms) {
      for (const joint of [arm.shoulder, arm.elbow, arm.wrist]) {
        const lateral = joint.clone().sub(pose.chest).dot(pose.right);
        joint.addScaledVector(pose.right, -lateral * .20);
      }
    }
    pose.head.addScaledVector(up, -.10 * MODEL_SCALE);
    camera.updateMatrixWorld();
    center = pose.pelvis.clone().project(camera);
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
    const scalePoint = pose.pelvis.clone().add(cameraRight).project(camera);
    const ndcWidth = Math.abs(scalePoint.x - center.x) * span;
    const ndcHeight = ndcWidth * camera.aspect * height / width;
    sx = width / ndcWidth; sy = height / ndcHeight;
    material.uniforms.bounds.value.set(center.x - ndcWidth / 2, center.y - ndcHeight / 2, ndcWidth, ndcHeight);
    ctx.clearRect(0, 0, width, height); fill.clearRect(0, 0, width, height);
    ctx.fillStyle = ctx.strokeStyle = '#fffdf3'; fill.fillStyle = '#fff';
    ctx.lineJoin = ctx.lineCap = 'round'; ctx.lineWidth = 9.5;
    for (const leg of pose.legs) {
      ribbon([leg.hip, leg.knee, leg.ankle], [.15, .137, .113], .19);
      const heel = leg.ankle.clone().addScaledVector(leg.footForward, -.10 * MODEL_SCALE).addScaledVector(up, -.01 * MODEL_SCALE);
      ribbon([heel, leg.toe], [.12, .13], .46);
    }
    for (const arm of pose.arms) ribbon([arm.shoulder, arm.elbow, arm.wrist], [.115, .101, .097], .26);
    body(pose);
    ctx.globalCompositeOperation = 'destination-out'; ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; texture.needsUpdate = true;
    debug = { ...pose.debug, mode: pose.mode, style: 'dry-brush-transparent-outline' };
  }
  return { group, update, getDebug: () => debug };
}
