// Nusara Bay itself: a procedural dusk city built from shared boxes, instanced
// palms and streetlights, and runtime canvas textures (no image files, no network).
// Districts: glass downtown in the middle, night market west, old town east,
// harbor dock south-west, beach south-east, teal water along the south edge.
import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

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

// A lit-window texture drawn on a canvas at runtime — dusk towers glow amber.
function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2f45';
  g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 10) {
    for (let x = 4; x < 60; x += 10) {
      if (rng.next() < 0.42) {
        g.fillStyle = rng.pick(['#ffd27a', '#ffb36b', '#ffe9b0', '#7fd4ff']);
        g.fillRect(x, y, 6, 6);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
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

export function buildCity(scene, rng) {
  const colliders = [];
  const winTex = windowTexture(rng);

  // --- sky, fog, sun, hemisphere -------------------------------------------
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(0x3d2c5c, 120, 340);
  const sun = new THREE.DirectionalLight(PALETTE.sun, PALETTE.sunIntensity);
  sun.position.set(-90, 55, -70);
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
  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, PALETTE.hemiIntensity));
  scene.add(new THREE.AmbientLight(0x403060, 0.5));

  // --- ground, roads, sidewalks, beach, water -------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2, WORLD.half * 2),
    new THREE.MeshStandardMaterial({ color: 0x453f4d, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.95 });
  const walkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
  const span = WORLD.half * 2;
  for (const s of WORLD.streets) {
    for (const [w, mat, y] of [
      [16, walkMat, 0.01],
      [WORLD.roadWidth, roadMat, 0.02],
    ]) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(span, w), mat);
      a.rotation.x = -Math.PI / 2;
      a.position.set(0, y, s);
      a.receiveShadow = true;
      scene.add(a);
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
  const m4 = new THREE.Matrix4();
  dashSpots.forEach(([a, b, rot], i) => {
    m4.makeRotationY(rot ? Math.PI / 2 : 0);
    m4.setPosition(a, 0.05, b);
    dashes.setMatrixAt(i, m4);
  });
  scene.add(dashes);

  // Beach sand (south-east) and teal water (south edge).
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
    new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.25, metalness: 0.35 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, 162);
  scene.add(water);

  // --- buildings ------------------------------------------------------------
  const towerMats = PALETTE.downtownGlass.map(
    (c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.35,
        metalness: 0.55,
        emissive: 0xffffff,
        emissiveMap: winTex,
        emissiveIntensity: 0.85,
      }),
  );
  const houseMats = PALETTE.house.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
  );
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 1 });

  function addBuilding(cx, cz, w, d, h, mat) {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(w + 0.4, 0.5, d + 0.4);
    roof.position.set(cx, h + 0.25, cz);
    scene.add(roof);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, top: h });
    return mesh;
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
        // Downtown: one or two glass towers per block.
        const n = rng.next() < 0.5 ? 1 : 2;
        for (let k = 0; k < n; k++) {
          const w = rng.range(10, 16);
          const d = rng.range(10, 16);
          const h = rng.range(26, 62);
          addBuilding(
            cx + (n === 1 ? 0 : (k === 0 ? -1 : 1) * (bw / 4)),
            cz + (n === 1 ? 0 : (k === 0 ? -1 : 1) * (bd / 4)),
            w,
            d,
            h,
            rng.pick(towerMats),
          );
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
            rng.pick(houseMats),
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
            rng.pick(houseMats),
          );
        }
      }
    }
  }

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
  for (let i = 0; i < 26; i++) {
    const w = rng.range(6, 9);
    const h = rng.range(2.5, 7.5);
    const cx = -150 + rng.range(0, 135);
    const cz = 104 + rng.range(0, 16);
    const mesh = new THREE.Mesh(boxGeo, rng.pick(containerMats));
    mesh.scale.set(w, h, 3);
    mesh.position.set(cx, h / 2 + 0.05, cz);
    mesh.rotation.y = rng.next() < 0.5 ? 0 : Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({ minX: cx - 4.5, maxX: cx + 4.5, minZ: cz - 4.5, maxZ: cz + 4.5, top: h + 0.05 });
  }
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
  const stallPositions = [];
  for (let i = 0; i < 14; i++) {
    const sx = -115 + (i % 7) * 12 + rng.range(-2, 2);
    const sz = -30 + Math.floor(i / 7) * 22 + rng.range(-3, 3);
    const stall = new THREE.Group();
    const base = new THREE.Mesh(boxGeo, rng.pick(houseMats));
    base.scale.set(4, 2.2, 3);
    base.position.y = 1.1;
    base.castShadow = true;
    stall.add(base);
    const awning = new THREE.Mesh(boxGeo, rng.pick(neonMats));
    awning.scale.set(4.6, 0.3, 3.6);
    awning.position.y = 2.6;
    stall.add(awning);
    stall.position.set(sx, 0, sz);
    scene.add(stall);
    colliders.push({ minX: sx - 2.3, maxX: sx + 2.3, minZ: sz - 1.8, maxZ: sz + 1.8, top: 2.6 });
    stallPositions.push([sx, sz]);
  }
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

  // --- palms (instanced trunks + canopies) ----------------------------------
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
  palmSpots.forEach(([x, z], i) => {
    m4.makeRotationY(rng.range(0, Math.PI * 2));
    m4.setPosition(x, 3, z);
    trunks.setMatrixAt(i, m4);
    m4.makeRotationY(rng.range(0, Math.PI * 2));
    m4.setPosition(x, 7, z);
    canopies.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  scene.add(trunks);
  scene.add(canopies);

  // --- streetlights (instanced poles + emissive lamps) -----------------------
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
  const marketGlow = new THREE.PointLight(0xff2e88, 40, 45);
  marketGlow.position.set(-80, 8, -10);
  scene.add(marketGlow);
  const downtownGlow = new THREE.PointLight(0x7fb8d4, 50, 70);
  downtownGlow.position.set(0, 20, 0);
  scene.add(downtownGlow);

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
  };
}
