// Nusara Bay, the city itself: a procedural golden-hour island built from
// instanced boxes, canvas-painted textures (no image files, no network) and
// one low warm sun. Glass downtown in the middle, a neon night market to
// the west, old town to the east, a container harbor in the south-west and
// a beach with teal water along the south edge.
//
// The light is the whole look: a canvas sky (violet zenith, pink band,
// orange horizon, peach haze at the bottom), FogExp2 in the same peach the
// sky fades into, and a sun low in the north-west throwing long shadows
// down the boulevards. Buildings are instanced per material — one draw call
// per archetype instead of one per building — with per-archetype lit-window
// textures and rooftop clutter on the tall ones.
import * as THREE from 'three';
import { WORLD, PALETTE, GOLDEN_HOUR } from './config.js';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitTube = new THREE.CylinderGeometry(1, 1, 1, 6);
const scratchMatrix = new THREE.Matrix4();
const scratchQuat = new THREE.Quaternion();
const scratchPos = new THREE.Vector3();
const scratchScale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Shove a circle out of every building box it overlaps. True when it hit.
export function collideCircle(pos, radius, colliders) {
  let bumped = false;
  for (const box of colliders) {
    const nearX = Math.max(box.minX, Math.min(pos.x, box.maxX));
    const nearZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
    const dx = pos.x - nearX;
    const dz = pos.z - nearZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      bumped = true;
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        pos.x = nearX + (dx / dist) * radius;
        pos.z = nearZ + (dz / dist) * radius;
      } else {
        pos.x = box.maxX + radius;
      }
    }
  }
  return bumped;
}

// True when a point in the air is clear of every building, container and
// crane. The chase camera pulls in along its ray until this is true, so it
// never clips through a wall.
export function cameraClear(x, y, z, colliders) {
  for (const box of colliders) {
    if (x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ && y < (box.top ?? 999)) {
      return false;
    }
  }
  return true;
}

export function clampToWorld(pos, radius) {
  const edge = WORLD.half - radius;
  pos.x = Math.max(-edge, Math.min(edge, pos.x));
  pos.z = Math.max(-edge, Math.min(edge, pos.z));
}

// A dusk sky painted on a canvas: violet up top, pink, then an orange
// horizon, then peach haze at the bottom — the fog colour lives at the
// bottom, so ground haze and sky meet with no visible seam.
function paintSky() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  const wash = g.createLinearGradient(0, 0, 0, 512);
  wash.addColorStop(0.0, '#2e245e');
  wash.addColorStop(0.38, '#7e4c85');
  wash.addColorStop(0.56, '#ff8642');
  wash.addColorStop(0.72, '#e8a87c');
  wash.addColorStop(1.0, '#e8a87c');
  g.fillStyle = wash;
  g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One soft radial glow, reused for the sun disc and for lamp light pools.
function paintGlow() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  const fade = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  fade.addColorStop(0, 'rgba(255,246,216,1)');
  fade.addColorStop(0.35, 'rgba(255,217,160,0.85)');
  fade.addColorStop(1, 'rgba(255,196,107,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// HD lit windows (256x512) with mullion frames, curtain gradients and dark
// reflective glass. Two maps come back: a diffuse map (frames + dark glass,
// tinted by the material colour) and an emissive map (only the lit windows
// glow, on a near-black ground). Columns, rows and lit ratio set the
// archetype — dense small windows for slabs, sparse big ones for houses.
// One window pane, painted on both maps at once: dark glass with a
// sky-reflection highlight on the diffuse map, and — when the pane is lit —
// a warm or cool gradient with a curtain or blind on the emissive map.
// The rng calls happen in the same order for every pane, so the texture
// is deterministic for a given seed.
function paintPane(fg, lg, rng, x, y, paneW, paneH, litRatio) {
  fg.fillStyle = rng.next() < 0.5 ? '#6d8299' : '#586d85';
  fg.fillRect(x, y, paneW, paneH);
  fg.fillStyle = 'rgba(255, 210, 170, 0.18)';
  fg.fillRect(x, y, paneW, paneH * 0.32);
  if (rng.next() >= litRatio) return;
  const warm = rng.next() < 0.88;
  const top = warm ? rng.pick(['#ffd27a', '#ffb86c', '#ffe8ad', '#f7a554']) : '#8ce0ff';
  const shade = lg.createLinearGradient(x, y, x, y + paneH);
  shade.addColorStop(0, top);
  shade.addColorStop(1, warm ? '#c97836' : '#4a98c4');
  lg.fillStyle = shade;
  lg.fillRect(x, y, paneW, paneH);
  // Curtain or blind variation, so lit windows are not flat squares.
  if (rng.next() < 0.35) {
    lg.fillStyle = 'rgba(0,0,0,0.35)';
    lg.fillRect(x, y, paneW, paneH * rng.range(0.25, 0.5));
  }
}

function paintWindows(rng, cols, rows, litRatio, ground) {
  const w = 256;
  const h = 512;
  const litCanvas = document.createElement('canvas');
  litCanvas.width = w;
  litCanvas.height = h;
  const lg = litCanvas.getContext('2d');
  lg.fillStyle = ground;
  lg.fillRect(0, 0, w, h);

  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = w;
  faceCanvas.height = h;
  const fg = faceCanvas.getContext('2d');
  fg.fillStyle = '#c8d2dc';
  fg.fillRect(0, 0, w, h);

  const cellW = w / cols;
  const cellH = h / rows;
  const insetX = cellW * 0.16;
  const insetY = cellH * 0.18;
  const paneW = cellW - insetX * 2;
  const paneH = cellH - insetY * 2;

  for (let row = 0; row < rows; row++) {
    // Floor separator between storeys.
    fg.fillStyle = 'rgba(15, 20, 30, 0.35)';
    fg.fillRect(0, row * cellH, w, 2);
    for (let col = 0; col < cols; col++) {
      paintPane(fg, lg, rng, col * cellW + insetX, row * cellH + insetY, paneW, paneH, litRatio);
    }
  }

  const map = new THREE.CanvasTexture(faceCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(litCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

// HD asphalt (512x512) with a roughness map: the golden hour and the
// headlights catch the semi-damp patches and tyre tracks instead of a flat
// matte road. The vertical variant turns the edge lines to the sides.
// Fine aggregate speckle over the asphalt, light and dark flecks.
function speckle(g, rng, size, n) {
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    g.fillStyle = rng.next() < 0.45 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.14)';
    g.fillRect(x, y, 2, 2);
  }
}

// Semi-damp smooth patches on the roughness map, so the golden-hour
// reflection feels alive instead of a flat matte road.
function dampPatches(rg, rng, size, n) {
  for (let i = 0; i < n; i++) {
    const px = rng.range(40, size - 40);
    const py = rng.range(40, size - 40);
    const rad = rng.range(28, 72);
    const patch = rg.createRadialGradient(px, py, 4, px, py, rad);
    patch.addColorStop(0, 'rgba(65, 65, 65, 0.75)');
    patch.addColorStop(1, 'rgba(200, 200, 200, 0)');
    rg.fillStyle = patch;
    rg.beginPath();
    rg.arc(px, py, rad, 0, Math.PI * 2);
    rg.fill();
  }
}

function paintRoad(rng, vertical) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rg = roughCanvas.getContext('2d');

  // Dark asphalt base, so markings and light read.
  g.fillStyle = '#262630';
  g.fillRect(0, 0, size, size);
  // Roughness base fairly rough (bright = rough, dark = more reflective).
  rg.fillStyle = '#c8c8c8';
  rg.fillRect(0, 0, size, size);

  speckle(g, rng, size, 4500);
  dampPatches(rg, rng, size, 16);

  // Tyre-wear lanes: a touch darker, a touch smoother and more reflective.
  g.fillStyle = 'rgba(0,0,0,0.14)';
  rg.fillStyle = 'rgba(110,110,110,0.45)';
  for (const lane of [145, 315]) {
    if (vertical) {
      g.fillRect(lane, 0, 52, size);
      rg.fillRect(lane, 0, 52, size);
    } else {
      g.fillRect(0, lane, size, 52);
      rg.fillRect(0, lane, size, 52);
    }
  }

  // Sharp edge lines.
  g.fillStyle = 'rgba(220, 212, 178, 0.9)';
  if (vertical) {
    g.fillRect(12, 0, 7, size);
    g.fillRect(size - 19, 0, 7, size);
  } else {
    g.fillRect(0, 12, size, 7);
    g.fillRect(0, size - 19, size, 7);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap };
}

// Warm concrete pavers for the sidewalks — HD (256x256), grout lines and a
// kerb highlight, so they read at street level.
function paintSidewalk(rng) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#484354';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.11)';
    g.fillRect(rng.range(0, size), rng.range(0, size), 2, 2);
  }
  for (let p = 0; p <= size; p += 64) {
    g.strokeStyle = 'rgba(0,0,0,0.32)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, size);
    g.stroke();
    g.beginPath();
    g.moveTo(0, p);
    g.lineTo(size, p);
    g.stroke();

    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(p + 2, 0);
    g.lineTo(p + 2, size);
    g.stroke();
    g.beginPath();
    g.moveTo(0, p + 2);
    g.lineTo(size, p + 2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Procedural ripple texture for the sea's bump map; the atmosphere update
// scrolls its offset so the water moves.
function paintRipples(rng) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 240; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const w = rng.range(18, 52);
    const h = rng.range(3, 8);
    g.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
    g.fillRect(x, y, w, h);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 4);
  return tex;
}

// A neon sign, painted on a canvas at runtime.
function paintSign(text, colour) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = colour;
  g.shadowBlur = 18;
  g.fillStyle = colour;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One instance matrix for a unit box or cylinder: position, optional
// Y-rotation, scale. Every InstancedMesh build in this file goes through it.
function stageInstance(list, x, y, z, sx, sy, sz, ry = 0) {
  scratchQuat.setFromAxisAngle(UP, ry);
  scratchPos.set(x, y, z);
  scratchScale.set(sx, sy, sz);
  scratchMatrix.compose(scratchPos, scratchQuat, scratchScale);
  list.push(scratchMatrix.clone());
}

function buildInstances(scene, geo, mat, list, shadowed = false) {
  if (list.length === 0) return null;
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = shadowed;
  mesh.receiveShadow = shadowed;
  scene.add(mesh);
  return mesh;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const glassA = paintWindows(rng, 8, 16, 0.48, '#070b12');
  const glassB = paintWindows(rng, 6, 12, 0.38, '#070b12');
  const glassC = paintWindows(rng, 10, 20, 0.56, '#070b12');
  const homeGlassA = paintWindows(rng, 3, 2, 0.52, '#000000');
  const homeGlassB = paintWindows(rng, 3, 2, 0.42, '#000000');
  const glow = paintGlow();

  // --- golden-hour sky, fog, sun and sky fill ------------------------------
  // The sun sits low in the north-west, so shadows run long down the
  // boulevards and the chase shot, driving north, faces it.
  scene.background = paintSky();
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
  scene.add(new THREE.HemisphereLight(GOLDEN_HOUR.hemiSky, GOLDEN_HOUR.hemiGround, GOLDEN_HOUR.hemiIntensity));
  scene.add(new THREE.AmbientLight(0x503828, 0.4));

  // A visible sun disc low on the horizon, with a wide halo. fog:false
  // keeps it bright — without it the frame reads as a warm filter rather
  // than a sunset.
  const sunDir = new THREE.Vector3(-95, 36, -62).normalize();
  const disc = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow, fog: false, depthWrite: false, opacity: 0.95 }),
  );
  disc.position.copy(sunDir).multiplyScalar(300);
  disc.scale.set(64, 64, 1);
  scene.add(disc);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow, fog: false, depthWrite: false, opacity: 0.32 }),
  );
  halo.position.copy(sunDir).multiplyScalar(300);
  halo.scale.set(170, 170, 1);
  scene.add(halo);

  // --- ground, roads, sidewalks, beach, sea --------------------------------
  const span = WORLD.half * 2;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(span, span),
    new THREE.MeshStandardMaterial({ color: 0x453f4d, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadAcross = paintRoad(rng, false);
  roadAcross.map.repeat.set(34, 1);
  roadAcross.roughnessMap.repeat.set(34, 1);
  const roadAlong = paintRoad(rng, true);
  roadAlong.map.repeat.set(1, 34);
  roadAlong.roughnessMap.repeat.set(1, 34);
  const roadMatAcross = new THREE.MeshStandardMaterial({
    map: roadAcross.map,
    roughnessMap: roadAcross.roughnessMap,
    roughness: 0.78,
    metalness: 0.08,
  });
  const roadMatAlong = new THREE.MeshStandardMaterial({
    map: roadAlong.map,
    roughnessMap: roadAlong.roughnessMap,
    roughness: 0.78,
    metalness: 0.08,
  });
  const walkTex = paintSidewalk(rng);
  walkTex.repeat.set(17, 1);
  const walkTexTurned = walkTex.clone();
  walkTexTurned.repeat.set(1, 17);
  walkTexTurned.needsUpdate = true;
  const walkMatAcross = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 1 });
  const walkMatAlong = new THREE.MeshStandardMaterial({ map: walkTexTurned, roughness: 1 });
  // One ground strip: a flat plane at a small height, receiving shadows.
  function layStrip(w, h, mat, x, y, z) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x, y, z);
    strip.receiveShadow = true;
    scene.add(strip);
  }
  for (const street of WORLD.streets) {
    // Sidewalk (wider, lower) then road, across the street and along it.
    layStrip(span, 16, walkMatAcross, 0, 0.01, street);
    layStrip(span, WORLD.roadWidth, roadMatAcross, 0, 0.02, street);
    layStrip(16, span, walkMatAlong, street, 0.01, 0);
    layStrip(WORLD.roadWidth, span, roadMatAlong, street, 0.02, 0);
  }
  // Centre dashes, instanced: one draw call for every street.
  const dashGeo = new THREE.BoxGeometry(3, 0.05, 0.5);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d2a8 });
  const dashSpots = [];
  for (const street of WORLD.streets) {
    for (let p = -160; p <= 160; p += 9) {
      if (WORLD.streets.some((other) => Math.abs(p - other) < 8)) continue;
      dashSpots.push([p, street, 0]);
      dashSpots.push([street, p, 1]);
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashSpots.length);
  dashSpots.forEach(([a, b, turned], i) => {
    scratchMatrix.makeRotationY(turned ? Math.PI / 2 : 0);
    scratchMatrix.setPosition(a, 0.05, b);
    dashes.setMatrixAt(i, scratchMatrix);
  });
  scene.add(dashes);

  // Beach sand (south-east) and teal water (south edge). The water picks
  // up the low sun with low roughness and a little metalness.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 32),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(85, 0.03, 116);
  sand.receiveShadow = true;
  scene.add(sand);
  const ripples = paintRipples(rng);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(span, 60),
    new THREE.MeshStandardMaterial({
      color: PALETTE.water,
      roughness: 0.1,
      metalness: 0.65,
      bumpMap: ripples,
      bumpScale: 0.18,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.05, 162);
  scene.add(sea);

  // --- buildings, instanced per material ------------------------------------
  // One InstancedMesh per material instead of one Mesh per building. Three
  // downtown archetypes (slab, stepped, podium + tower), low shops in the
  // market, low houses everywhere else.
  const glassSet = [glassA, glassB, glassC, glassA];
  const towerMats = PALETTE.downtownGlass.map(
    (colour, i) =>
      new THREE.MeshStandardMaterial({
        color: colour,
        map: glassSet[i].map,
        roughness: 0.2,
        metalness: 0.72,
        emissive: 0xffffff,
        emissiveMap: glassSet[i].emissiveMap,
        emissiveIntensity: 1.05,
      }),
  );
  const homeGlassSet = [homeGlassA, homeGlassB, homeGlassA, homeGlassB, homeGlassA];
  const houseMats = PALETTE.house.map(
    (colour, i) =>
      new THREE.MeshStandardMaterial({
        color: colour,
        map: homeGlassSet[i].map,
        roughness: 0.82,
        metalness: 0.05,
        emissive: 0xffffff,
        emissiveMap: homeGlassSet[i].emissiveMap,
        emissiveIntensity: 0.7,
      }),
  );
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 1 });
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x5a5a60, roughness: 0.6, metalness: 0.4 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.8 });

  const towerSlots = towerMats.map(() => []);
  const houseSlots = houseMats.map(() => []);
  const roofSlots = [];
  const ventSlots = [];
  const mastSlots = [];
  const tankSlots = [];

  // One building is a box, optionally with a smaller box stacked on top.
  // The collider covers the base footprint and the full height.
  function raiseBuilding(cx, cz, w, d, h, slots, slotIndex, crown = null) {
    stageInstance(slots[slotIndex], cx, h / 2, cz, w, h, d);
    let fullH = h;
    let fullW = w;
    let fullD = d;
    if (crown) {
      stageInstance(slots[slotIndex], cx, h + crown.h / 2, cz, crown.w, crown.h, crown.d);
      fullH = h + crown.h;
      fullW = crown.w;
      fullD = crown.d;
    }
    stageInstance(roofSlots, cx, fullH + 0.25, cz, fullW + 0.4, 0.5, fullD + 0.4);
    colliders.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      top: fullH,
    });
    // Rooftop clutter on tall downtown towers only: vents, an antenna,
    // sometimes a water tank — the silhouette that reads as dense city.
    if (fullH >= 18 && slots === towerSlots) {
      const ventCount = 1 + Math.floor(rng.next() * 3);
      for (let i = 0; i < ventCount; i++) {
        stageInstance(
          ventSlots,
          cx + rng.jitter(0, fullW / 2 - 2),
          fullH + 0.75,
          cz + rng.jitter(0, fullD / 2 - 2),
          rng.range(1.2, 2),
          1.5,
          rng.range(1, 1.6),
          rng.range(0, Math.PI),
        );
      }
      if (rng.bool()) {
        const mastH = rng.range(4, 7);
        stageInstance(
          mastSlots,
          cx + rng.jitter(0, fullW / 2 - 1),
          fullH + 0.5 + mastH / 2,
          cz + rng.jitter(0, fullD / 2 - 1),
          0.12,
          mastH,
          0.12,
        );
      }
      if (rng.bool(0.3)) {
        stageInstance(
          tankSlots,
          cx + rng.jitter(0, fullW / 2 - 2),
          fullH + 1.4,
          cz + rng.jitter(0, fullD / 2 - 2),
          0.9,
          1.8,
          0.9,
        );
      }
    }
  }

  // Downtown: one or two towers per block, in three archetypes.
  function downtownBlock(cx, cz, bw, bd) {
    const count = rng.bool() ? 1 : 2;
    for (let k = 0; k < count; k++) {
      const px = cx + (count === 1 ? 0 : (k === 0 ? -1 : 1) * (bw / 4));
      const pz = cz + (count === 1 ? 0 : (k === 0 ? -1 : 1) * (bd / 4));
      const w = rng.range(10, 16);
      const d = rng.range(10, 16);
      const matIndex = Math.floor(rng.next() * towerMats.length);
      const shape = rng.next();
      if (shape < 0.45) {
        // Slab: one tall glass box.
        raiseBuilding(px, pz, w, d, rng.range(26, 62), towerSlots, matIndex);
      } else if (shape < 0.75) {
        // Stepped: a base with a smaller tower on top.
        const baseH = rng.range(10, 16);
        raiseBuilding(px, pz, w, d, baseH, towerSlots, matIndex, {
          w: w * 0.62,
          d: d * 0.62,
          h: rng.range(14, 26),
        });
      } else {
        // Podium and tower: a low wide base with a slim tower on it.
        const baseH = rng.range(5, 8);
        raiseBuilding(px, pz, w, d, baseH, towerSlots, matIndex, {
          w: w * 0.55,
          d: d * 0.55,
          h: rng.range(20, 34),
        });
      }
    }
  }

  // Night market: low shops with neon awnings.
  function marketBlock(cx, cz) {
    for (let k = 0; k < 3; k++) {
      const w = rng.range(6, 9);
      const d = rng.range(6, 9);
      raiseBuilding(
        cx + rng.range(-8, 8),
        cz + rng.range(-8, 8),
        w,
        d,
        rng.range(4, 7),
        houseSlots,
        Math.floor(rng.next() * houseMats.length),
      );
    }
  }

  // Old town and mid-rise: two or three low houses per block.
  function houseBlock(cx, cz) {
    for (let k = 0; k < 3; k++) {
      const w = rng.range(7, 11);
      const d = rng.range(7, 11);
      raiseBuilding(
        cx + rng.range(-7, 7),
        cz + rng.range(-7, 7),
        w,
        d,
        rng.range(5, 12),
        houseSlots,
        Math.floor(rng.next() * houseMats.length),
      );
    }
  }

  // Blocks are the cells between streets, plus the outer ring.
  const borders = [-170, ...WORLD.streets, 170];
  for (let bx = 0; bx < borders.length - 1; bx++) {
    for (let bz = 0; bz < borders.length - 1; bz++) {
      const x0 = borders[bx] + 9;
      const x1 = borders[bx + 1] - 9;
      const z0 = borders[bz] + 9;
      const z1 = borders[bz + 1] - 9;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (cz > 96) continue; // beach and harbor strip are built below
      const bw = x1 - x0;
      const bd = z1 - z0;
      if (Math.abs(cx) < 62 && Math.abs(cz) < 62) downtownBlock(cx, cz, bw, bd);
      else if (cx < -40 && Math.abs(cz) < 70) marketBlock(cx, cz);
      else houseBlock(cx, cz);
    }
  }
  towerSlots.forEach((list, i) => buildInstances(scene, unitBox, towerMats[i], list, true));
  houseSlots.forEach((list, i) => buildInstances(scene, unitBox, houseMats[i], list, true));
  buildInstances(scene, unitBox, roofMat, roofSlots);
  buildInstances(scene, unitBox, ventMat, ventSlots);
  buildInstances(scene, unitTube, ventMat, mastSlots);
  buildInstances(scene, unitTube, tankMat, tankSlots);

  // Harbor: containers, cranes, dock. The containers are instanced per
  // colour; the cranes are built from scaled unit boxes.
  function buildHarbor() {
    const containerMats = PALETTE.container.map(
      (colour) => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.7, metalness: 0.3 }),
    );
    const dock = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 26),
      new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 }),
    );
    dock.rotation.x = -Math.PI / 2;
    dock.position.set(-80, 0.04, 112);
    dock.receiveShadow = true;
    scene.add(dock);
    const containerSlots = containerMats.map(() => []);
    Array.from({ length: 26 }, () => {
      const w = rng.range(6, 9);
      const h = rng.range(2.5, 7.5);
      const cx = -150 + rng.range(0, 135);
      const cz = 104 + rng.range(0, 16);
      const turn = rng.next() < 0.5 ? 0 : Math.PI / 2;
      const slot = Math.floor(rng.next() * containerMats.length);
      stageInstance(containerSlots[slot], cx, h / 2 + 0.05, cz, w, h, 3, turn);
      colliders.push({ minX: cx - 4.5, maxX: cx + 4.5, minZ: cz - 4.5, maxZ: cz + 4.5, top: h + 0.05 });
    });
    containerSlots.forEach((list, i) => buildInstances(scene, unitBox, containerMats[i], list, true));
    // Two gantry cranes: legs, crossbeam, jib.
    const craneMat = new THREE.MeshStandardMaterial({ color: 0xd98a2e, roughness: 0.6, metalness: 0.4 });
    function cranePart(parent, sx, sy, sz, x, y, z) {
      const m = new THREE.Mesh(unitBox, craneMat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }
    for (const cx of [-120, -45]) {
      const crane = new THREE.Group();
      for (const dx of [-5, 5]) {
        const leg = cranePart(crane, 1.2, 26, 1.2, dx, 13, 0);
        leg.castShadow = true;
      }
      cranePart(crane, 13, 1.5, 2, 0, 26, 0);
      cranePart(crane, 1.5, 1.5, 22, 0, 25, 10);
      crane.position.set(cx, 0, 108);
      scene.add(crane);
      colliders.push({ minX: cx - 6, maxX: cx + 6, minZ: 102, maxZ: 114, top: 26 });
    }
  }
  buildHarbor();

  // Night-market stalls with neon awnings, the four neon signs, and the
  // safehouse: a small green-lit house at the south-west corner.
  function buildMarket() {
    const neonMats = PALETTE.neon.map(
      (colour) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: colour, emissiveIntensity: 2.2 }),
    );
    const stallSlots = houseMats.map(() => []);
    const awningSlots = neonMats.map(() => []);
    for (let i = 0; i < 14; i++) {
      const col = i % 7;
      const row = Math.floor(i / 7);
      const sx = -115 + col * 12 + rng.range(-2, 2);
      const sz = -30 + row * 22 + rng.range(-3, 3);
      const houseIdx = Math.floor(rng.next() * houseMats.length);
      const neonIdx = Math.floor(rng.next() * neonMats.length);
      stageInstance(stallSlots[houseIdx], sx, 1.1, sz, 4, 2.2, 3);
      stageInstance(awningSlots[neonIdx], sx, 2.6, sz, 4.6, 0.3, 3.6);
      colliders.push({ minX: sx - 2.3, maxX: sx + 2.3, minZ: sz - 1.8, maxZ: sz + 1.8, top: 2.6 });
    }
    stallSlots.forEach((list, i) => buildInstances(scene, unitBox, houseMats[i], list, true));
    awningSlots.forEach((list, i) => buildInstances(scene, unitBox, neonMats[i], list));
    const signs = [
      ['NIGHT MARKET', '#ff2e88', -80, 9, -32, 0],
      ['SAFEHOUSE', '#7cff4f', -100, 7, -100, Math.PI / 4],
      ['HARBOR', '#00e5ff', -80, 12, 100, Math.PI],
      ['NUSARA BAY', '#ffd21f', 0, 16, -60, 0],
    ];
    for (const [text, colour, x, y, z, ry] of signs) {
      const tex = paintSign(text, colour);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 3.5),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
      );
      sign.position.set(x, y, z);
      sign.rotation.y = ry;
      scene.add(sign);
    }
    const safehouse = new THREE.Mesh(unitBox, houseMats[4]);
    safehouse.scale.set(10, 6, 8);
    safehouse.position.set(-100, 3, -100);
    safehouse.castShadow = true;
    scene.add(safehouse);
    colliders.push({ minX: -105, maxX: -95, minZ: -104, maxZ: -96, top: 6 });
    const safeLight = new THREE.PointLight(0x7cff4f, 30, 30);
    safeLight.position.set(-100, 5, -92);
    scene.add(safeLight);
  }
  buildMarket();

  // Palms: instanced trunks with two-tier canopies. A little lean and a
  // scale wobble each, so no two palms match.
  function plantPalms() {
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
      const s = rng.range(0.9, 1.2);
      const lean = rng.range(-0.06, 0.06);
      scratchMatrix.makeRotationY(rng.range(0, Math.PI * 2));
      scratchMatrix.multiply(new THREE.Matrix4().makeRotationZ(lean));
      scratchMatrix.scale(new THREE.Vector3(s, s, s));
      scratchMatrix.setPosition(x, 3 * s, z);
      trunks.setMatrixAt(i, scratchMatrix);
      scratchMatrix.makeRotationY(rng.range(0, Math.PI * 2));
      scratchMatrix.scale(new THREE.Vector3(s, s, s));
      scratchMatrix.setPosition(x, 7 * s, z);
      canopies.setMatrixAt(i, scratchMatrix);
      scratchMatrix.makeRotationY(rng.range(0, Math.PI * 2));
      scratchMatrix.scale(new THREE.Vector3(s, s, s));
      scratchMatrix.setPosition(x, 8.6 * s, z);
      crowns.setMatrixAt(i, scratchMatrix);
    });
    trunks.castShadow = true;
    scene.add(trunks);
    scene.add(canopies);
    scene.add(crowns);
  }
  plantPalms();

  // Streetlights: instanced poles, lamps and fake light pools. Real point
  // lights would cost a draw call and a shadow pass each; the single
  // additive decal draw call below is what makes the street feel lit.
  function lightStreets() {
    const lampSpots = [];
    for (const street of WORLD.streets) {
      for (let p = -140; p <= 140; p += 40) {
        lampSpots.push([street + 6, p]);
        lampSpots.push([p, street + 6]);
      }
    }
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 5.5, 5);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.8 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
    const lampGeo = new THREE.SphereGeometry(0.35, 6, 5);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
    lampSpots.forEach(([x, z], i) => {
      scratchMatrix.identity();
      scratchMatrix.setPosition(x, 2.75, z);
      poles.setMatrixAt(i, scratchMatrix);
      scratchMatrix.setPosition(x, 5.5, z);
      lamps.setMatrixAt(i, scratchMatrix);
    });
    scene.add(poles);
    scene.add(lamps);
    // Fake light pools: one additive radial decal under every lamp.
    const poolGeo = new THREE.CircleGeometry(3.2, 16);
    const poolMat = new THREE.MeshBasicMaterial({
      map: glow,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.32,
    });
    const pools = new THREE.InstancedMesh(poolGeo, poolMat, lampSpots.length);
    lampSpots.forEach(([x, z], i) => {
      scratchMatrix.makeRotationX(-Math.PI / 2);
      scratchMatrix.setPosition(x, 0.06, z);
      pools.setMatrixAt(i, scratchMatrix);
    });
    scene.add(pools);
  }
  lightStreets();
  const marketLight = new THREE.PointLight(0xff2e88, 40, 45);
  marketLight.position.set(-80, 8, -10);
  scene.add(marketLight);
  const downtownLight = new THREE.PointLight(0x7fb8d4, 50, 70);
  downtownLight.position.set(0, 20, 0);
  scene.add(downtownLight);

  // Dust motes in the low sun: about 180 drifting points around downtown.
  // The returned update moves them, and scrolls the sea's ripple map.
  const DUST_N = 180;
  const dustHome = new Float32Array(DUST_N * 3);
  Array.from({ length: DUST_N }, (_, i) => {
    dustHome[i * 3] = rng.range(-120, 120);
    dustHome[i * 3 + 1] = rng.range(1, 25);
    dustHome[i * 3 + 2] = rng.range(-120, 120);
  });
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustHome.slice(), 3));
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
  let dustClock = 0;

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
      dustClock += dt;
      ripples.offset.x += dt * 0.03;
      ripples.offset.y += dt * 0.015;
      const pos = dustGeo.attributes.position;
      for (let i = 0; i < DUST_N; i++) {
        pos.array[i * 3] = dustHome[i * 3] + Math.sin(dustClock * 0.15 + i * 1.7) * 0.8;
        pos.array[i * 3 + 1] = dustHome[i * 3 + 1] + Math.sin(dustClock * 0.3 + i) * 0.5;
      }
      pos.needsUpdate = true;
    },
  };
}
