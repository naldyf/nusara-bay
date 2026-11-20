// Nusara Bay itself: a procedural golden-hour city built from instanced boxes,
// canvas textures (no image files, no network) and a warm low sun.
// Districts: glass downtown in the middle, night market west, old town east,
// harbor dock south-west, beach south-east, teal water along the south edge.
//
// Iteration 3 re-lights everything: the dusk-purple of v2 is gone. The sky is
// a canvas gradient (violet zenith -> pink -> orange horizon -> peach haze),
// the fog is FogExp2 in the peach haze colour the sky gradient fades into
// at the bottom — not the orange horizon band itself — so the far skyline
// dissolves into haze, and the sun sits low in the north-west (~19 degrees)
// throwing long shadows down the boulevards. Buildings are instanced per
// material —
// one draw call per archetype instead of one per building — with per-archetype
// lit-window emissive textures and rooftop clutter.
import * as THREE from 'three';
import { WORLD, PALETTE, GOLDEN_HOUR } from './config.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 6);
const m4 = new THREE.Matrix4();
const q0 = new THREE.Quaternion();
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();

// Push a circle out of every building AABB it overlaps. Returns true on a hit.
export function collideCircle(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        pos.x = c.maxX + radius;
      }
    }
  }
  return hit;
}

// True when a point in the air is not inside any building/container/crane.
// The chase camera pulls in until this is true, so it never clips into a wall.
export function cameraClear(x, y, z, colliders) {
  for (const c of colliders) {
    if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ && y < (c.top ?? 999)) return false;
  }
  return true;
}

export function clampToWorld(pos, radius) {
  const lim = WORLD.half - radius;
  pos.x = Math.max(-lim, Math.min(lim, pos.x));
  pos.z = Math.max(-lim, Math.min(lim, pos.z));
}

// A golden-hour sky painted on a canvas: violet zenith, pink band, orange
// horizon, peach haze at the bottom — the fog colour lives at the bottom so
// the ground haze and the sky meet with no visible seam.
function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#6b4f9e');
  grad.addColorStop(0.42, '#b06a8a');
  grad.addColorStop(0.58, '#ff9a5c');
  grad.addColorStop(0.74, '#f7c9a0');
  grad.addColorStop(1, '#f7c9a0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A soft radial glow, reused for the sun disc and for lamp light pools.
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,246,216,1)');
  grad.addColorStop(0.35, 'rgba(255,217,160,0.85)');
  grad.addColorStop(1, 'rgba(255,196,107,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A lit-window texture drawn on a canvas at runtime. The background is
// near-black so only the lit windows glow through the emissive map; the
// wall colour itself comes from the material. cols/rows/lits set the
// archetype: dense small windows for slabs, sparse big ones for houses.
function windowTexture(rng, cols, rows, litRatio, bg) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 64, 128);
  const cw = 64 / cols;
  const ch = 128 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      if (rng.next() < litRatio) {
        // Warm tungsten mostly, one cool fluorescent in ten.
        g.fillStyle =
          rng.next() < 0.9
            ? rng.pick(['#ffd27a', '#ffb36b', '#ffe9b0'])
            : '#7fd4ff';
        g.fillRect(col * cw + cw * 0.2, r * ch + ch * 0.2, cw * 0.6, ch * 0.55);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Asphalt with worn edge lines and speckle noise, drawn once and repeated
// along every road. The vertical variant has the lines on the sides.
function roadTexture(rng, vertical) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#34343f';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    g.fillRect(rng.range(0, 256), rng.range(0, 256), 2, 2);
  }
  // Faded centre wear where tyres run.
  g.fillStyle = 'rgba(0,0,0,0.10)';
  if (vertical) g.fillRect(88, 0, 80, 256);
  else g.fillRect(0, 88, 256, 80);
  // Solid edge lines, worn at the ends.
  g.fillStyle = 'rgba(201,194,160,0.85)';
  if (vertical) {
    g.fillRect(5, 0, 4, 256);
    g.fillRect(247, 0, 4, 256);
  } else {
    g.fillRect(0, 5, 256, 4);
    g.fillRect(0, 247, 256, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Warm concrete pavers for the sidewalks — a grid that reads at street level.
function sidewalkTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#4d485c';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 220; i++) {
    g.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.10)';
    g.fillRect(rng.range(0, 128), rng.range(0, 128), 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  for (let p = 0; p <= 128; p += 32) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 128); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(128, p); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A neon sign texture drawn on a canvas at runtime.
function signTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Compose one instance matrix for a unit box/cylinder: position, optional
// Y-rotation, scale. Keeps every InstancedMesh build in one place.
function pushInstance(list, x, y, z, sx, sy, sz, ry = 0) {
  q0.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
  v3.set(x, y, z);
  s3.set(sx, sy, sz);
  m4.compose(v3, q0, s3);
  list.push(m4.clone());
}

function buildInstanced(scene, geo, mat, list, { shadow = false } = {}) {
  if (list.length === 0) return null;
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  scene.add(mesh);
  return mesh;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const winTexA = windowTexture(rng, 8, 16, 0.45, '#0a0f18');
  const winTexB = windowTexture(rng, 6, 12, 0.35, '#0a0f18');
  const winTexC = windowTexture(rng, 10, 20, 0.55, '#0a0f18');
  const houseWinA = windowTexture(rng, 3, 2, 0.5, '#000000');
  const houseWinB = windowTexture(rng, 3, 2, 0.4, '#000000');
  const glowTex = glowTexture();

  // --- golden-hour sky, fog, sun, hemisphere --------------------------------
  // The sun is low in the north-west: elevation ~19 degrees, so shadows run
  // long down the boulevards and the chase shot (driving north) faces it.
  scene.background = skyTexture();
  scene.fog = new THREE.FogExp2(GOLDEN_HOUR.fog, GOLDEN_HOUR.fogDensity);
  const sun = new THREE.DirectionalLight(GOLDEN_HOUR.sun, GOLDEN_HOUR.sunIntensity);
  sun.position.set(-95, 36, -62);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(
    new THREE.HemisphereLight(GOLDEN_HOUR.hemiSky, GOLDEN_HOUR.hemiGround, GOLDEN_HOUR.hemiIntensity),
  );
  scene.add(new THREE.AmbientLight(0x503828, 0.4));

  // Visible sun disc low on the horizon, plus a wide halo. fog:false keeps it
  // bright; without it the frame reads as "warm filter" instead of sunset.
  const sunDir = new THREE.Vector3(-95, 36, -62).normalize();
  const sunDisc = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false, opacity: 0.95 }),
  );
  sunDisc.position.copy(sunDir).multiplyScalar(300);
  sunDisc.scale.set(64, 64, 1);
  scene.add(sunDisc);
  const sunHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false, opacity: 0.32 }),
  );
  sunHalo.position.copy(sunDir).multiplyScalar(300);
  sunHalo.scale.set(170, 170, 1);
  scene.add(sunHalo);

  // --- ground, roads, sidewalks, beach, water -------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2, WORLD.half * 2),
    new THREE.MeshStandardMaterial({ color: 0x453f4d, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadTexH = roadTexture(rng, false);
  roadTexH.repeat.set(34, 1);
  const roadTexV = roadTexture(rng, true);
  roadTexV.repeat.set(1, 34);
  const roadMatH = new THREE.MeshStandardMaterial({ map: roadTexH, roughness: 0.95 });
  const roadMatV = new THREE.MeshStandardMaterial({ map: roadTexV, roughness: 0.95 });
  const walkTex = sidewalkTexture(rng);
  walkTex.repeat.set(17, 1);
  const walkTexV = walkTex.clone();
  walkTexV.repeat.set(1, 17);
  walkTexV.needsUpdate = true;
  const walkMatH = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 1 });
  const walkMatV = new THREE.MeshStandardMaterial({ map: walkTexV, roughness: 1 });
  const span = WORLD.half * 2;
  for (const s of WORLD.streets) {
    for (const [w, mat, y] of [
      [16, walkMatH, 0.01],
      [WORLD.roadWidth, roadMatH, 0.02],
    ]) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(span, w), mat);
      a.rotation.x = -Math.PI / 2;
      a.position.set(0, y, s);
      a.receiveShadow = true;
      scene.add(a);
    }
    for (const [w, mat, y] of [
      [16, walkMatV, 0.01],
      [WORLD.roadWidth, roadMatV, 0.02],
    ]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(w, span), mat);
      b.rotation.x = -Math.PI / 2;
      b.position.set(s, y, 0);
      b.receiveShadow = true;
      scene.add(b);
    }
  }
  // Centre dashes, instanced: one draw call for every street.
  const dashGeo = new THREE.BoxGeometry(3, 0.05, 0.5);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d2a8 });
  const dashSpots = [];
  for (const s of WORLD.streets) {
    for (let p = -160; p <= 160; p += 9) {
      if (WORLD.streets.some((t) => Math.abs(p - t) < 8)) continue;
      dashSpots.push([p, s, 0]);
      dashSpots.push([s, p, 1]);
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashSpots.length);
  dashSpots.forEach(([a, b, rot], i) => {
    m4.makeRotationY(rot ? Math.PI / 2 : 0);
    m4.setPosition(a, 0.05, b);
    dashes.setMatrixAt(i, m4);
  });
  scene.add(dashes);

  // Beach sand (south-east) and teal water (south edge). The water picks up
  // the low sun with a low roughness and a little metalness.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 32),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(85, 0.03, 116);
  sand.receiveShadow = true;
  scene.add(sand);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(span, 60),
    new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.15, metalness: 0.5 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, 162);
  scene.add(water);

  // --- buildings (instanced per material) -----------------------------------
  // One InstancedMesh per material instead of one Mesh per building: the v2
  // city was ~300 draw calls of boxes alone. Archetypes: downtown gets slabs,
  // stepped towers and podium+towers; market gets shops; the rest gets houses.
  const towerWin = [winTexA, winTexB, winTexC, winTexA];
  const towerMats = PALETTE.downtownGlass.map(
    (c, i) =>
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.35,
        metalness: 0.55,
        emissive: 0xffffff,
        emissiveMap: towerWin[i],
        emissiveIntensity: 0.9,
      }),
  );
  const houseWin = [houseWinA, houseWinB, houseWinA, houseWinB, houseWinA];
  const houseMats = PALETTE.house.map(
    (c, i) =>
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.85,
        emissive: 0xffffff,
        emissiveMap: houseWin[i],
        emissiveIntensity: 0.55,
      }),
  );
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 1 });
  const hvacMat = new THREE.MeshStandardMaterial({ color: 0x5a5a60, roughness: 0.6, metalness: 0.4 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.8 });

  const towerBoxes = towerMats.map(() => []);
  const houseBoxes = houseMats.map(() => []);
  const roofBoxes = [];
  const hvacBoxes = [];
  const antennaCyls = [];
  const tankCyls = [];

  // A building is one box, optionally with a smaller box stacked on top.
  // The collider covers the base footprint and the full height.
  function addBuilding(cx, cz, w, d, h, matList, matIndex, top = null) {
    pushInstance(matList[matIndex], cx, h / 2, cz, w, h, d);
    let topH = h;
    let topW = w;
    let topD = d;
    if (top) {
      pushInstance(matList[matIndex], cx, h + top.h / 2, cz, top.w, top.h, top.d);
      topH = h + top.h;
      topW = top.w;
      topD = top.d;
    }
    pushInstance(roofBoxes, cx, topH + 0.25, cz, topW + 0.4, 0.5, topD + 0.4);
    colliders.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
      top: topH,
    });
    // Rooftop clutter on tall downtown towers only: HVAC boxes, an antenna,
    // sometimes a water tank — the silhouette that reads as "dense city".
    if (topH >= 18 && matList === towerBoxes) {
      const n = 1 + Math.floor(rng.next() * 3);
      for (let i = 0; i < n; i++) {
        pushInstance(
          hvacBoxes,
          cx + rng.jitter(0, topW / 2 - 2),
          topH + 0.75,
          cz + rng.jitter(0, topD / 2 - 2),
          rng.range(1.2, 2), 1.5, rng.range(1, 1.6),
          rng.range(0, Math.PI),
        );
      }
      if (rng.bool()) {
        const ah = rng.range(4, 7);
        pushInstance(
          antennaCyls,
          cx + rng.jitter(0, topW / 2 - 1),
          topH + 0.5 + ah / 2,
          cz + rng.jitter(0, topD / 2 - 1),
          0.12, ah, 0.12,
        );
      }
      if (rng.bool(0.3)) {
        pushInstance(
          tankCyls,
          cx + rng.jitter(0, topW / 2 - 2),
          topH + 1.4,
          cz + rng.jitter(0, topD / 2 - 2),
          0.9, 1.8, 0.9,
        );
      }
    }
  }

  // Blocks are the cells between streets (plus the outer ring).
  const edges = [-170, ...WORLD.streets, 170];
  for (let ix = 0; ix < edges.length - 1; ix++) {
    for (let iz = 0; iz < edges.length - 1; iz++) {
      const x0 = edges[ix] + 9;
      const x1 = edges[ix + 1] - 9;
      const z0 = edges[iz] + 9;
      const z1 = edges[iz + 1] - 9;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (cz > 96) continue; // beach / harbor strip handled below
      const bw = x1 - x0;
      const bd = z1 - z0;
      if (Math.abs(cx) < 62 && Math.abs(cz) < 62) {
        // Downtown: one or two towers per block, in three archetypes.
        const n = rng.bool() ? 1 : 2;
        for (let k = 0; k < n; k++) {
          const bx = cx + (n === 1 ? 0 : (k === 0 ? -1 : 1) * (bw / 4));
          const bz = cz + (n === 1 ? 0 : (k === 0 ? -1 : 1) * (bd / 4));
          const w = rng.range(10, 16);
          const d = rng.range(10, 16);
          const mi = Math.floor(rng.next() * towerMats.length);
          const arch = rng.next();
          if (arch < 0.45) {
            // Slab: one tall glass box.
            addBuilding(bx, bz, w, d, rng.range(26, 62), towerBoxes, mi);
          } else if (arch < 0.75) {
            // Stepped: a base with a smaller tower on top.
            const h1 = rng.range(10, 16);
            addBuilding(bx, bz, w, d, h1, towerBoxes, mi, {
              w: w * 0.62, d: d * 0.62, h: rng.range(14, 26),
            });
          } else {
            // Podium + tower: a low wide base with a slim tower on it.
            const h1 = rng.range(5, 8);
            addBuilding(bx, bz, w, d, h1, towerBoxes, mi, {
              w: w * 0.55, d: d * 0.55, h: rng.range(20, 34),
            });
          }
        }
      } else if (cx < -40 && Math.abs(cz) < 70) {
        // Night market: low shops with neon awnings.
        for (let k = 0; k < 3; k++) {
          const w = rng.range(6, 9);
          const d = rng.range(6, 9);
          addBuilding(
            cx + rng.range(-8, 8),
            cz + rng.range(-8, 8),
            w,
            d,
            rng.range(4, 7),
            houseBoxes,
            Math.floor(rng.next() * houseMats.length),
          );
        }
      } else {
        // Old town / mid-rise: two or three low houses per block.
        for (let k = 0; k < 3; k++) {
          const w = rng.range(7, 11);
          const d = rng.range(7, 11);
          addBuilding(
            cx + rng.range(-7, 7),
            cz + rng.range(-7, 7),
            w,
            d,
            rng.range(5, 12),
            houseBoxes,
            Math.floor(rng.next() * houseMats.length),
          );
        }
      }
    }
  }
  towerBoxes.forEach((list, i) => buildInstanced(scene, boxGeo, towerMats[i], list, { shadow: true }));
  houseBoxes.forEach((list, i) => buildInstanced(scene, boxGeo, houseMats[i], list, { shadow: true }));
  buildInstanced(scene, boxGeo, roofMat, roofBoxes);
  buildInstanced(scene, boxGeo, hvacMat, hvacBoxes);
  buildInstanced(scene, unitCyl, hvacMat, antennaCyls);
  buildInstanced(scene, unitCyl, tankMat, tankCyls);

  // --- harbor: containers, cranes, dock ------------------------------------
  const containerMats = PALETTE.container.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.3 }),
  );
  const dock = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 26),
    new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 }),
  );
  dock.rotation.x = -Math.PI / 2;
  dock.position.set(-80, 0.04, 112);
  dock.receiveShadow = true;
  scene.add(dock);
  const containerBoxes = containerMats.map(() => []);
  for (let i = 0; i < 26; i++) {
    const w = rng.range(6, 9);
    const h = rng.range(2.5, 7.5);
    const cx = -150 + rng.range(0, 135);
    const cz = 104 + rng.range(0, 16);
    const ry = rng.next() < 0.5 ? 0 : Math.PI / 2;
    pushInstance(containerBoxes[Math.floor(rng.next() * containerMats.length)], cx, h / 2 + 0.05, cz, w, h, 3, ry);
    colliders.push({ minX: cx - 4.5, maxX: cx + 4.5, minZ: cz - 4.5, maxZ: cz + 4.5, top: h + 0.05 });
  }
  containerBoxes.forEach((list, i) => buildInstanced(scene, boxGeo, containerMats[i], list, { shadow: true }));
  // Two gantry cranes: legs, crossbeam, jib.
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd98a2e, roughness: 0.6, metalness: 0.4 });
  for (const cx of [-120, -45]) {
    const crane = new THREE.Group();
    for (const dx of [-5, 5]) {
      const leg = new THREE.Mesh(boxGeo, craneMat);
      leg.scale.set(1.2, 26, 1.2);
      leg.position.set(dx, 13, 0);
      leg.castShadow = true;
      crane.add(leg);
    }
    const beam = new THREE.Mesh(boxGeo, craneMat);
    beam.scale.set(13, 1.5, 2);
    beam.position.set(0, 26, 0);
    crane.add(beam);
    const jib = new THREE.Mesh(boxGeo, craneMat);
    jib.scale.set(1.5, 1.5, 22);
    jib.position.set(0, 25, 10);
    crane.add(jib);
    crane.position.set(cx, 0, 108);
    scene.add(crane);
    colliders.push({ minX: cx - 6, maxX: cx + 6, minZ: 102, maxZ: 114, top: 26 });
  }

  // --- night-market stalls + neon signs -------------------------------------
  const neonMats = PALETTE.neon.map(
    (c) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: 2.2 }),
  );
  const stallBases = houseMats.map(() => []);
  const stallAwnings = neonMats.map(() => []);
  for (let i = 0; i < 14; i++) {
    const sx = -115 + (i % 7) * 12 + rng.range(-2, 2);
    const sz = -30 + Math.floor(i / 7) * 22 + rng.range(-3, 3);
    pushInstance(stallBases[Math.floor(rng.next() * houseMats.length)], sx, 1.1, sz, 4, 2.2, 3);
    pushInstance(stallAwnings[Math.floor(rng.next() * neonMats.length)], sx, 2.6, sz, 4.6, 0.3, 3.6);
    colliders.push({ minX: sx - 2.3, maxX: sx + 2.3, minZ: sz - 1.8, maxZ: sz + 1.8, top: 2.6 });
  }
  stallBases.forEach((list, i) => buildInstanced(scene, boxGeo, houseMats[i], list, { shadow: true }));
  stallAwnings.forEach((list, i) => buildInstanced(scene, boxGeo, neonMats[i], list));
  function addSign(text, color, x, y, z, ry) {
    const tex = signTexture(text, color);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 3.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    sign.position.set(x, y, z);
    sign.rotation.y = ry;
    scene.add(sign);
  }
  addSign('NIGHT MARKET', '#ff2e88', -80, 9, -32, 0);
  addSign('SAFEHOUSE', '#7cff4f', -100, 7, -100, Math.PI / 4);
  addSign('HARBOR', '#00e5ff', -80, 12, 100, Math.PI);
  addSign('NUSARA BAY', '#ffd21f', 0, 16, -60, 0);

  // Safehouse: a small green-lit house at the south-west corner.
  const safehouse = new THREE.Mesh(boxGeo, houseMats[4]);
  safehouse.scale.set(10, 6, 8);
  safehouse.position.set(-100, 3, -100);
  safehouse.castShadow = true;
  scene.add(safehouse);
  colliders.push({ minX: -105, maxX: -95, minZ: -104, maxZ: -96, top: 6 });
  const safeGlow = new THREE.PointLight(0x7cff4f, 30, 30);
  safeGlow.position.set(-100, 5, -92);
  scene.add(safeGlow);

  // --- palms (instanced trunks + two-tier canopies) --------------------------
  const palmSpots = [];
  for (let i = 0; i < 46; i++) {
    const x = rng.range(-150, 150);
    const z = rng.pick([rng.range(96, 128), rng.range(-150, 150)]);
    if (z < 96 && WORLD.streets.some((s) => Math.abs(x - s) < 8 || Math.abs(z - s) < 8)) continue;
    palmSpots.push([x, z]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 6, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const canopyGeo = new THREE.ConeGeometry(3.2, 2.6, 6);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2e6b34, roughness: 1 });
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, palmSpots.length);
  const crownGeo = new THREE.ConeGeometry(1.9, 1.8, 6);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x3a7d3c, roughness: 1 });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    // A little lean and a scale wobble so no two palms match.
    const s = rng.range(0.9, 1.2);
    const lean = rng.range(-0.06, 0.06);
    m4.makeRotationY(rng.range(0, Math.PI * 2));
    m4.multiply(new THREE.Matrix4().makeRotationZ(lean));
    m4.scale(new THREE.Vector3(s, s, s));
    m4.setPosition(x, 3 * s, z);
    trunks.setMatrixAt(i, m4);
    m4.makeRotationY(rng.range(0, Math.PI * 2));
    m4.scale(new THREE.Vector3(s, s, s));
    m4.setPosition(x, 7 * s, z);
    canopies.setMatrixAt(i, m4);
    m4.makeRotationY(rng.range(0, Math.PI * 2));
    m4.scale(new THREE.Vector3(s, s, s));
    m4.setPosition(x, 8.6 * s, z);
    crowns.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  scene.add(trunks);
  scene.add(canopies);
  scene.add(crowns);

  // --- streetlights (instanced poles + lamps + fake light pools) -------------
  const lampSpots = [];
  for (const s of WORLD.streets) {
    for (let p = -140; p <= 140; p += 40) {
      lampSpots.push([s + 6, p]);
      lampSpots.push([p, s + 6]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 5.5, 5);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.8 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const lampGeo = new THREE.SphereGeometry(0.35, 6, 5);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    m4.identity();
    m4.setPosition(x, 2.75, z);
    poles.setMatrixAt(i, m4);
    m4.setPosition(x, 5.5, z);
    lamps.setMatrixAt(i, m4);
  });
  scene.add(poles);
  scene.add(lamps);
  // Fake light pools: one additive radial decal under every lamp. Real
  // point lights would cost a draw call and a shadow pass each; this is the
  // one draw call that makes the street feel lit at golden hour.
  const poolGeo = new THREE.CircleGeometry(3.2, 16);
  const poolMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.32,
  });
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    m4.makeRotationX(-Math.PI / 2);
    m4.setPosition(x, 0.06, z);
    pools.setMatrixAt(i, m4);
  });
  scene.add(pools);
  const marketGlow = new THREE.PointLight(0xff2e88, 40, 45);
  marketGlow.position.set(-80, 8, -10);
  scene.add(marketGlow);
  const downtownGlow = new THREE.PointLight(0x7fb8d4, 50, 70);
  downtownGlow.position.set(0, 20, 0);
  scene.add(downtownGlow);

  // --- dust motes in the low sun --------------------------------------------
  // ~180 drifting points around downtown; the update below moves them.
  const DUST_N = 180;
  const dustBase = new Float32Array(DUST_N * 3);
  for (let i = 0; i < DUST_N; i++) {
    dustBase[i * 3] = rng.range(-120, 120);
    dustBase[i * 3 + 1] = rng.range(1, 25);
    dustBase[i * 3 + 2] = rng.range(-120, 120);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustBase.slice(), 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0xffd9a8,
      size: 0.3,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(dust);
  let dustT = 0;

  return {
    colliders,
    streets: WORLD.streets,
    safehousePos: { x: -100, z: -92 },
    spawn: {
      market: { x: -80, z: 0 },
      downtown: { x: 0, z: -40 },
      harbor: { x: -60, z: 108 },
      beach: { x: 80, z: 108 },
    },
    // Drift the dust slowly so the air feels alive; called every frame.
    updateAtmosphere(dt) {
      dustT += dt;
      const pos = dustGeo.attributes.position;
      for (let i = 0; i < DUST_N; i++) {
        pos.array[i * 3] = dustBase[i * 3] + Math.sin(dustT * 0.15 + i * 1.7) * 0.8;
        pos.array[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(dustT * 0.3 + i) * 0.5;
      }
      pos.needsUpdate = true;
    },
  };
}
