export const GAME_TITLE = "CALL CENTER"; // título provisional: se cambia solo aquí y en index.html
export const SHIFT_SECONDS = 240;
export const MAX_PLAYERS = 4;
export const QUOTA_PER_PLAYER = 30;

export type Accessory = "none" | "headset" | "glasses" | "tie" | "bun" | "beard";

export interface CastDef {
  name: string;
  role: string;
  quirk: string;
  skin: number;
  shirt: number;
  pants: number;
  hair: number;
  hairStyle: "short" | "long" | "bun" | "bald";
  accessory: Accessory;
}

// Elenco ficticio y multicultural. Cada personaje se define por su personalidad y su look,
// no por su origen.
export const CAST: CastDef[] = [
  { name: "Chidi", role: "El Veterano", quirk: "Lleva 12 años 'a punto de dimitir'.", skin: 0x6b4226, shirt: 0xe9b44c, pants: 0x2b3a55, hair: 0x151515, hairStyle: "short", accessory: "tie" },
  { name: "Farhan", role: "El Optimista", quirk: "Cree que la empresa es una familia.", skin: 0xa87654, shirt: 0x2fa7a0, pants: 0x3a3a3a, hair: 0x1a1410, hairStyle: "short", accessory: "headset" },
  { name: "Priya", role: "La Estratega", quirk: "Tiene un Excel hasta para el café.", skin: 0x9c6b3f, shirt: 0x8b5cd6, pants: 0x222222, hair: 0x120d0a, hairStyle: "long", accessory: "glasses" },
  { name: "Marek", role: "El Becario Eterno", quirk: "Habla con la fotocopiadora.", skin: 0xf0c8a0, shirt: 0x8a8f98, pants: 0x4b3b2a, hair: 0xb98c4a, hairStyle: "short", accessory: "glasses" },
  { name: "Lucía", role: "La Sargento", quirk: "Cronometra hasta los suspiros.", skin: 0xd9a273, shirt: 0xd9433b, pants: 0x1f2a44, hair: 0x2a1a12, hairStyle: "bun", accessory: "bun" },
  { name: "Wei", role: "El Fantasma", quirk: "Nadie recuerda haberle contratado.", skin: 0xe8c39e, shirt: 0x4aa564, pants: 0x30343c, hair: 0x0f0f12, hairStyle: "short", accessory: "none" },
];
