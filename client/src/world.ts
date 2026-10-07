import * as THREE from "three";

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface DeskSpot {
  id: number;
  seat: THREE.Vector3; // dónde se coloca el jugador
  ry: number; // hacia dónde mira el jugador sentado (orientado al monitor)
  led: THREE.Mesh;
  screen: THREE.Mesh;
  cam: THREE.Vector3; // posición de cámara al sentarse
  look: THREE.Vector3;
}

export const ROOM = { halfX: 13, halfZ: 9.5 };

const lam = (c: number, emissive = 0x000000) =>
  new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive });

function textTexture(text: string, w: number, h: number, bg: string, fg: string, size = 64): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d")!;
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);
  c.fillStyle = fg;
  c.font = `bold ${size}px system-ui, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  const lines = text.split("\n");
  lines.forEach((ln, i) => c.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (size * 1.15)));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene: THREE.Scene) {
  const colliders: Box[] = [];
  const desks: DeskSpot[] = [];
  const { halfX, halfZ } = ROOM;

  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, c: number, x: number, y: number, z: number) =>
    add(new THREE.BoxGeometry(w, h, d), lam(c), x, y, z);
  const solid = (w: number, h: number, d: number, c: number, x: number, y: number, z: number) => {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return box(w, h, d, c, x, y, z);
  };

  // Luz y ambiente
  scene.background = new THREE.Color(0x1b2430);
  scene.fog = new THREE.Fog(0x1b2430, 22, 48);
  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a3326, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 0.8);
  sun.position.set(6, 14, 8);
  scene.add(sun);

  // Suelo (moqueta a cuadros) y techo
  const floor = add(new THREE.PlaneGeometry(halfX * 2, halfZ * 2), lam(0x4a5566), 0, 0, 0);
  floor.rotation.x = -Math.PI / 2;
  for (let i = -halfX; i < halfX; i += 2) {
    for (let j = -halfZ; j < halfZ; j += 2) {
      if (((i + j) / 2) % 2 === 0) {
        const tile = add(new THREE.PlaneGeometry(2, 2), lam(0x434d5e), i + 1, 0.005, j + 1);
        tile.rotation.x = -Math.PI / 2;
      }
    }
  }

  // Paredes
  const wallC = 0xc9c3b4;
  box(halfX * 2, 4, 0.3, wallC, 0, 2, -halfZ);
  box(halfX * 2, 4, 0.3, wallC, 0, 2, halfZ);
  box(0.3, 4, halfZ * 2, wallC, -halfX, 2, 0);
  box(0.3, 4, halfZ * 2, wallC, halfX, 2, 0);
  box(halfX * 2, 0.35, 0.32, 0x6a5a46, 0, 0.17, -halfZ + 0.02);
  box(halfX * 2, 0.35, 0.32, 0x6a5a46, 0, 0.17, halfZ - 0.02);

  // Luces de techo (un solo material: el apagón las apaga todas)
  const ceilingMat = lam(0xffffff, 0xfff6d6);
  for (let x = -9; x <= 9; x += 6) {
    for (let z = -6; z <= 6; z += 6) {
      add(new THREE.BoxGeometry(2.2, 0.08, 0.7), ceilingMat, x, 3.95, z);
    }
  }

  // Carteles motivacionales (y satíricos)
  const posters = [
    { t: "¡VENDE\nMÁS!", bg: "#d9433b", x: -8, z: -halfZ + 0.2, ry: 0 },
    { t: "SONRÍE:\nTE GRABAMOS", bg: "#2f6fb0", x: -2, z: -halfZ + 0.2, ry: 0 },
    { t: "EQUIPO =\nFAMILIA*\n*sin vacaciones", bg: "#3b8f57", x: 3, z: -halfZ + 0.2, ry: 0 },
    { t: "CUOTA\nO CALLE", bg: "#222", x: -6, z: halfZ - 0.2, ry: Math.PI },
    { t: "EL CAFÉ\nNO ES\nGRATIS", bg: "#8a5a2b", x: 4, z: halfZ - 0.2, ry: Math.PI },
  ];
  for (const p of posters) {
    const tex = textTexture(p.t, 256, 320, p.bg, "#fff", 36);
    const m = new THREE.MeshBasicMaterial({ map: tex });
    const pl = add(new THREE.PlaneGeometry(2, 2.5), m, p.x, 2.3, p.z);
    pl.rotation.y = p.ry;
  }

  // Mesas: dos filas de cuatro, mirando al pasillo central
  let id = 0;
  for (const row of [-1, 1]) {
    for (const x of [-8.5, -3, 3, 8.5]) {
      const deskZ = row * 3.6;
      const dz = 1.5;
      solid(3.2, 0.1, dz, 0x8d6e4c, x, 0.78, deskZ);
      colliders.pop();
      colliders.push({ minX: x - 1.6, maxX: x + 1.6, minZ: deskZ - dz / 2, maxZ: deskZ + dz / 2 });
      box(0.12, 0.78, dz - 0.1, 0x6b523a, x - 1.5, 0.39, deskZ);
      box(0.12, 0.78, dz - 0.1, 0x6b523a, x + 1.5, 0.39, deskZ);

      const behind = row; // el monitor está en el lado de la pared, el jugador en el del pasillo
      const mz = deskZ + behind * 0.35;
      box(0.9, 0.06, 0.4, 0x2a2a2a, x, 0.84, mz); // base
      const screen = add(
        new THREE.BoxGeometry(1.5, 0.9, 0.08),
        lam(0x1b3a5c, 0x16324f),
        x,
        1.38,
        mz,
      );
      box(1.6, 1.0, 0.06, 0x222222, x, 1.38, mz + behind * 0.05);
      screen.position.z = mz - behind * 0.03;
      const led = add(new THREE.SphereGeometry(0.07, 6, 4), lam(0x33dd66, 0x22aa44), x + 1.1, 0.9, deskZ - behind * 0.3);
      box(0.28, 0.1, 0.5, 0x333333, x + 1.1, 0.84, deskZ - behind * 0.1); // teléfono

      // silla
      const seatZ = deskZ - row * 1.45;
      box(0.8, 0.12, 0.8, 0x2b2f3a, x, 0.55, seatZ - row * 0.55);
      box(0.8, 0.9, 0.12, 0x2b2f3a, x, 1.0, seatZ - row * 0.98);
      box(0.1, 0.5, 0.1, 0x555555, x, 0.28, seatZ - row * 0.55);

      desks.push({
        id: id++,
        seat: new THREE.Vector3(x, 0, deskZ - row * 1.55),
        ry: row === -1 ? Math.PI : 0,
        led,
        screen,
        cam: new THREE.Vector3(x, 1.75, deskZ - row * 3.3),
        look: new THREE.Vector3(x, 1.35, mz),
      });
    }
  }

  // Despacho del jefe (esquina trasera derecha) con paredes de cristal
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0.28 });
  const gw = add(new THREE.BoxGeometry(7, 3, 0.1), glass, 9.5, 1.5, -7.2);
  void gw;
  colliders.push({ minX: 6, maxX: 13, minZ: -7.3, maxZ: -7.1 });
  add(new THREE.BoxGeometry(0.1, 3, 5), glass, 6, 1.5, -9.5 + 2.5 - 0.0);
  colliders.push({ minX: 5.9, maxX: 6.1, minZ: -9.5, maxZ: -7.2 });
  solid(2.6, 0.9, 1.1, 0x3a2a22, 10, 0.45, -8.4);
  box(0.4, 0.5, 0.3, 0x111111, 10, 1.05, -8.4);
  const bossSign = add(
    new THREE.PlaneGeometry(2.4, 0.7),
    new THREE.MeshBasicMaterial({ map: textTexture("DIRECCIÓN", 384, 112, "#111", "#f2c14e", 56) }),
    9.5,
    2.8,
    -7.14,
  );
  void bossSign;

  // Máquina de café, plantas, fotocopiadora
  solid(0.9, 1.4, 0.8, 0x884433, -11.8, 0.7, -8.4);
  box(0.5, 0.2, 0.1, 0x222222, -11.8, 1.1, -8.0);
  for (const [px, pz] of [[-12, 8.4], [12, 8.4], [-12, -3], [12, 1.6]] as const) {
    solid(0.7, 0.5, 0.7, 0xa05a3c, px, 0.25, pz);
    const leaf = add(new THREE.IcosahedronGeometry(0.65, 0), lam(0x3b8f4a), px, 1.0, pz);
    leaf.scale.y = 1.3;
  }
  solid(1.4, 1.1, 0.9, 0xb8bcc4, -11.6, 0.55, 5.5);
  box(1.4, 0.1, 0.9, 0x6a6e76, -11.6, 1.15, 5.5);

  return { colliders, desks, lights: { hemi, sun, ceiling: ceilingMat } };
}

// Empuja un círculo fuera de las cajas.
export function resolveCollisions(p: THREE.Vector3, r: number, boxes: Box[]) {
  for (const b of boxes) {
    const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
    const dx = p.x - cx;
    const dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      } else {
        // dentro de la caja: sacar por el lado más cercano
        const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z;
        const m = Math.min(l, rr, t, bt);
        if (m === l) p.x = b.minX - r;
        else if (m === rr) p.x = b.maxX + r;
        else if (m === t) p.z = b.minZ - r;
        else p.z = b.maxZ + r;
      }
    }
  }
  p.x = Math.max(-ROOM.halfX + r + 0.2, Math.min(ROOM.halfX - r - 0.2, p.x));
  p.z = Math.max(-ROOM.halfZ + r + 0.2, Math.min(ROOM.halfZ - r - 0.2, p.z));
}
