export const GAME_TITLE = "CALL CENTER"; // título provisional: se cambia solo aquí y en index.html
export const MAX_PLAYERS = 4;

export type Accessory = "none" | "headset" | "glasses" | "tie" | "bun" | "beard";

export interface CastDef {
  name: string;
  alias: string; // el nombre "occidental" con el que se presenta al teléfono
  role: string;
  quirk: string;
  skin: number;
  shirt: number;
  pants: number;
  hair: number;
  hairStyle: "short" | "long" | "bun" | "bald";
  accessory: Accessory;
}

// Elenco ficticio de la centralita, de todas partes. El chiste es la estafa y la empresa:
// cada uno tiene su manía, no su pasaporte.
export const CAST: CastDef[] = [
  { name: "Mohit", alias: "Steven Myers", role: "El Veterano", quirk: "Jura que llama desde Texas. Nunca ha visto un caballo.", skin: 0x9c6b3f, shirt: 0xe9b44c, pants: 0x2b3a55, hair: 0x151515, hairStyle: "short", accessory: "headset" },
  { name: "Omanga", alias: "Jimmy", role: "El Primo del Príncipe", quirk: "Asegura que el príncipe existe. Le debe 50 dólares.", skin: 0x6b4226, shirt: 0x2fa7a0, pants: 0x3a3a3a, hair: 0x151515, hairStyle: "short", accessory: "tie" },
  { name: "Harpreet", alias: "Jennifer", role: "La Estratega", quirk: "Tiene un Excel con las excusas de cada abuela.", skin: 0xa87654, shirt: 0x8b5cd6, pants: 0x222222, hair: 0x120d0a, hairStyle: "long", accessory: "glasses" },
  { name: "Rahim", alias: "Kevin", role: "El Optimista", quirk: "Cree que la empresa es una familia. La empresa no le devuelve las llamadas.", skin: 0x8d5a34, shirt: 0x4aa564, pants: 0x30343c, hair: 0x0f0f12, hairStyle: "short", accessory: "beard" },
  { name: "Thura", alias: "Brad", role: "El Fantasma", quirk: "Nadie recuerda haberle contratado. Ni él.", skin: 0xc68e5e, shirt: 0x8a8f98, pants: 0x4b3b2a, hair: 0x1a1410, hairStyle: "short", accessory: "none" },
  { name: "Dmitri", alias: "Mike", role: "El Becario Eterno", quirk: "Habla con la fotocopiadora. Ella sí le contesta.", skin: 0xf0c8a0, shirt: 0x2b5a9a, pants: 0x222222, hair: 0xb98c4a, hairStyle: "short", accessory: "glasses" },
  { name: "Lucía", alias: "Jessica", role: "La Sargento", quirk: "Cronometra hasta los suspiros del cliente.", skin: 0xd9a273, shirt: 0xd9433b, pants: 0x1f2a44, hair: 0x2a1a12, hairStyle: "bun", accessory: "bun" },
];

// El jefe: no se puede elegir, solo aparece en su ronda de inspección.
export const BOSS: CastDef = {
  name: "Don Bonifacio",
  alias: "Don Bonifacio",
  role: "El Jefe",
  quirk: "Mide la productividad en suspiros por minuto.",
  skin: 0xe2b48c,
  shirt: 0x1c1f26,
  pants: 0x1c1f26,
  hair: 0x9a9a9a,
  hairStyle: "bald",
  accessory: "tie",
};
