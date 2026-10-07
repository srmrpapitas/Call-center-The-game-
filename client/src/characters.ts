import * as THREE from "three";
import { CAST, type CastDef } from "./config";

const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

export interface Avatar {
  group: THREE.Group;
  body: THREE.Group;
  head: THREE.Group; // pivote en el cuello: se balancea al hablar
  talking: boolean;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
}

function limb(w: number, h: number, d: number, m: THREE.Material, x: number, y: number): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, -h / 2, 0); // pivote en la parte alta
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, 0);
  return mesh;
}

// Caras opcionales: public/faces/<nombre>.png (p. ej. lucia.png). Si no existe, se dejan los ojos.
const faceLoader = new THREE.TextureLoader();
export const faceFile = (name: string) =>
  name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png";

export function buildAvatar(look: number | CastDef): Avatar {
  const d = typeof look === "number" ? CAST[((look % CAST.length) + CAST.length) % CAST.length] : look;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const skin = mat(d.skin);
  const shirt = mat(d.shirt);
  const pants = mat(d.pants);
  const hair = mat(d.hair);
  const dark = mat(0x111111);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.85, 0.42), shirt);
  torso.position.y = 1.3;
  body.add(torso);

  // Todo lo de la cabeza cuelga de este grupo, con el pivote en el cuello (y = 1.72).
  const headG = new THREE.Group();
  headG.position.y = 1.72;
  body.add(headG);
  const onHead = (m: THREE.Object3D, x: number, y: number, z: number) => {
    m.position.set(x, y - 1.72, z);
    headG.add(m);
    return m;
  };

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), skin);
  head.scale.set(1, 1.05, 1);
  onHead(head, 0, 2.0, 0);

  const eyes: THREE.Object3D[] = []; // se ocultan si hay foto (ojos y gafas)
  for (const sx of [-0.14, 0.14]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.05), dark);
    eyes.push(onHead(eye, sx, 2.04, 0.37));
  }
  // foto de la cara pegada delante, como una careta
  faceLoader.load(
    `faces/${faceFile(d.name)}`,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.74), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      onHead(face, 0, 1.98, 0.42);
      eyes.forEach((e) => (e.visible = false));
    },
    undefined,
    () => {
      /* sin foto: se quedan los ojos */
    },
  );

  if (d.hairStyle !== "bald") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.43, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    cap.rotation.x = -0.15;
    onHead(cap, 0, 2.04, 0);
  }
  if (d.hairStyle === "long") {
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.22), hair);
    onHead(back, 0, 1.75, -0.28);
  }
  if (d.accessory === "bun") {
    const bun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), hair);
    onHead(bun, 0, 2.5, -0.1);
  }
  if (d.accessory === "headset") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 5, 12, Math.PI), dark);
    onHead(band, 0, 2.02, 0);
    const mic = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), dark);
    onHead(mic, 0.3, 1.85, 0.3);
  }
  if (d.accessory === "glasses") {
    for (const sx of [-0.15, 0.15]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 4, 8), dark);
      eyes.push(onHead(r, sx, 2.04, 0.43));
    }
  }
  if (d.accessory === "tie") {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.05), mat(0xb02a30));
    tie.position.set(0, 1.3, 0.23);
    body.add(tie);
  }
  if (d.accessory === "beard") {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.15), hair);
    onHead(b, 0, 1.82, 0.3);
  }

  const legL = limb(0.28, 0.85, 0.3, pants, -0.18, 0.88);
  const legR = limb(0.28, 0.85, 0.3, pants, 0.18, 0.88);
  const armL = limb(0.2, 0.75, 0.22, shirt, -0.5, 1.65);
  const armR = limb(0.2, 0.75, 0.22, shirt, 0.5, 1.65);
  body.add(legL, legR, armL, armR);

  return { group, body, head: headG, talking: false, legL, legR, armL, armR };
}

export function animateAvatar(a: Avatar, t: number, moving: boolean) {
  const s = moving ? Math.sin(t * 10) * 0.8 : 0;
  a.legL.rotation.x = s;
  a.legR.rotation.x = -s;
  a.armL.rotation.x = -s * 0.9;
  a.armR.rotation.x = s * 0.9;
  a.body.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.06 : Math.sin(t * 2) * 0.012;
  // al hablar por teléfono, la cabeza se balancea de lado a lado
  const goal = a.talking ? Math.sin(t * 7) * 0.22 + Math.sin(t * 2.3) * 0.06 : 0;
  a.head.rotation.z += (goal - a.head.rotation.z) * 0.25;
}
