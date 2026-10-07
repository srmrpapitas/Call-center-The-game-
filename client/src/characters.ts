import * as THREE from "three";
import { CAST } from "./config";

const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

export interface Avatar {
  group: THREE.Group;
  body: THREE.Group;
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

export function buildAvatar(idx: number): Avatar {
  const d = CAST[((idx % CAST.length) + CAST.length) % CAST.length];
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

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), skin);
  head.position.y = 2.0;
  head.scale.set(1, 1.05, 1);
  body.add(head);

  for (const sx of [-0.14, 0.14]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.05), dark);
    eye.position.set(sx, 2.04, 0.37);
    body.add(eye);
  }

  if (d.hairStyle !== "bald") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.43, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    cap.position.y = 2.04;
    cap.rotation.x = -0.15;
    body.add(cap);
  }
  if (d.hairStyle === "long") {
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.22), hair);
    back.position.set(0, 1.75, -0.28);
    body.add(back);
  }
  if (d.accessory === "bun") {
    const bun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), hair);
    bun.position.set(0, 2.5, -0.1);
    body.add(bun);
  }
  if (d.accessory === "headset") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 5, 12, Math.PI), dark);
    band.position.y = 2.02;
    band.rotation.z = 0;
    body.add(band);
    const mic = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), dark);
    mic.position.set(0.3, 1.85, 0.3);
    body.add(mic);
  }
  if (d.accessory === "glasses") {
    for (const sx of [-0.15, 0.15]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 4, 8), dark);
      r.position.set(sx, 2.04, 0.39);
      body.add(r);
    }
  }
  if (d.accessory === "tie") {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.05), mat(0xb02a30));
    tie.position.set(0, 1.3, 0.23);
    body.add(tie);
  }
  if (d.accessory === "beard") {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.15), hair);
    b.position.set(0, 1.82, 0.3);
    body.add(b);
  }

  const legL = limb(0.28, 0.85, 0.3, pants, -0.18, 0.88);
  const legR = limb(0.28, 0.85, 0.3, pants, 0.18, 0.88);
  const armL = limb(0.2, 0.75, 0.22, shirt, -0.5, 1.65);
  const armR = limb(0.2, 0.75, 0.22, shirt, 0.5, 1.65);
  body.add(legL, legR, armL, armR);

  return { group, body, legL, legR, armL, armR };
}

export function animateAvatar(a: Avatar, t: number, moving: boolean) {
  const s = moving ? Math.sin(t * 10) * 0.8 : 0;
  a.legL.rotation.x = s;
  a.legR.rotation.x = -s;
  a.armL.rotation.x = -s * 0.9;
  a.armR.rotation.x = s * 0.9;
  a.body.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.06 : Math.sin(t * 2) * 0.012;
}
