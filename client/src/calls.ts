// Llamadas de la v0: guionizadas, con clientes ficticios y absurdos (sátira de humor negro).
// Cada línea puede llevar un audio opcional (public/audio/calls/<archivo>) para sustituir al texto
// por tus grabaciones: basta con rellenar el campo `audio`.

export interface CallOption {
  t: string; // lo que dice el jugador
  pts: 0 | 1 | 3;
  reply: string; // reacción del cliente
  audio?: string;
  replyAudio?: string;
}

export interface CallRound {
  say: string; // lo que dice el cliente
  sayAudio?: string;
  options: [CallOption, CallOption, CallOption];
}

export interface CallDef {
  id: string;
  customer: string;
  emoji: string;
  product: string;
  rounds: CallRound[];
}

export const CALLS: CallDef[] = [
  {
    id: "vlad",
    customer: "Conde Vlad",
    emoji: "🧛",
    product: "Seguro Solar Total",
    rounds: [
      {
        say: "¿Diga? Rápido, que se hace de día.",
        options: [
          { t: "¡Justo por eso llamo! El Seguro Solar Premium cubre amaneceres imprevistos.", pts: 3, reply: "Hmm... eso sí me inquieta." },
          { t: "Tengo una oferta exclusiva solo para usted.", pts: 1, reply: "Todos dicen eso. Mi último vendedor... también." },
          { t: "¿Es usted el titular de la línea?", pts: 0, reply: "Soy titular desde 1462. Qué pesado." },
        ],
      },
      {
        say: "¿Y qué cubre exactamente?",
        options: [
          { t: "Quemaduras, pánico solar y selfies con flash. Por 9,99 al mes.", pts: 3, reply: "Barato para ser eterno." },
          { t: "Cubre... cosas. Muchas cosas.", pts: 1, reply: "Qué específico." },
          { t: "No lo sé, mi guion no dice más.", pts: 0, reply: "Qué honestidad tan inútil." },
        ],
      },
      {
        say: "¿Y si no quedo satisfecho?",
        options: [
          { t: "Le devolvemos su dinero... en un cupón para otro seguro.", pts: 3, reply: "Brillante. Me encanta su falta de escrúpulos." },
          { t: "Habría un proceso de reclamación de seis a ocho siglos.", pts: 1, reply: "Tiempo me sobra." },
          { t: "Eso no pasa nunca, jamás.", pts: 0, reply: "Mentira. Huelo el miedo." },
        ],
      },
    ],
  },
  {
    id: "zorg",
    customer: "Zorg el Alienígena",
    emoji: "👽",
    product: "Parcelas en la Luna",
    rounds: [
      {
        say: "Saludos, humano. ¿Con quién hablo?",
        options: [
          { t: "¡Con su nuevo asesor inmobiliario lunar de confianza!", pts: 3, reply: "Confianza: concepto terrícola. Interesante." },
          { t: "Con... la empresa.", pts: 1, reply: "¿Cuál de todas?" },
          { t: "Con nadie importante.", pts: 0, reply: "Entonces cuelgo." },
        ],
      },
      {
        say: "¿Las parcelas tienen vistas?",
        options: [
          { t: "A la Tierra, a pie de cráter y sin vecinos ruidosos.", pts: 3, reply: "Silencio... precioso." },
          { t: "Algunas parcelas tienen vistas.", pts: 1, reply: "¿Algunas?" },
          { t: "Es la Luna, no hay mucho que ver.", pts: 0, reply: "Qué pésimo vendedor." },
        ],
      },
      {
        say: "¿Cómo se paga en su planeta?",
        options: [
          { t: "En créditos galácticos o en polvo estelar, lo que prefiera.", pts: 3, reply: "Polvo estelar me sobra. Trato." },
          { t: "Hay que firmar aquí, y ya.", pts: 1, reply: "Presión: sensación desagradable." },
          { t: "No sé, pregúntele a mi jefe.", pts: 0, reply: "¿Y quién es su jefe?" },
        ],
      },
    ],
  },
  {
    id: "reginald",
    customer: "Sir Reginald",
    emoji: "🏰",
    product: "VPN para Castillos",
    rounds: [
      {
        say: "¡Alto! ¿Quién osa llamar a mi torre?",
        options: [
          { t: "El departamento de seguridad digital del reino, mi señor.", pts: 3, reply: "¿Reino? ¡Digno de respeto!" },
          { t: "Soy de una empresa. Vendemos cosas.", pts: 1, reply: "¿Cosas? Cuidado, villano." },
          { t: "Jaja, ¿esto es una broma?", pts: 0, reply: "¡Ofensa! Exijo un duelo." },
        ],
      },
      {
        say: "¿Qué es esa 'internet' de la que hablas?",
        options: [
          { t: "Una red de dragones invisibles que le espían. Nuestra VPN los espanta.", pts: 3, reply: "¡Dragones! Lo sabía." },
          { t: "Es como una paloma mensajera, pero más rápida.", pts: 1, reply: "Entiendo a medias." },
          { t: "No tengo tiempo para explicárselo.", pts: 0, reply: "Pues no hay trato." },
        ],
      },
      {
        say: "¿Cuánto por proteger mi castillo?",
        options: [
          { t: "Cinco monedas de oro al mes y un tributo de bienvenida.", pts: 3, reply: "¡Trato! Mi escudero te enviará el oro." },
          { t: "Depende del tamaño del castillo.", pts: 1, reply: "Es enorme. Y mi foso, profundo." },
          { t: "Es gratis. Bueno, casi.", pts: 0, reply: "Nada es gratis, villano." },
        ],
      },
    ],
  },
  {
    id: "gerardo",
    customer: "Gerardo el Fantasma",
    emoji: "👻",
    product: "Seguro de Vida (para el Más Allá)",
    rounds: [
      {
        say: "Uuuuh... ¿quién llama desde el mundo de los vivos?",
        options: [
          { t: "¡Su nueva aseguradora, Gerardo! Hablemos de su futuro eterno.", pts: 3, reply: "Mi futuro... eternamente cubierto." },
          { t: "Es una encuesta de satisfacción.", pts: 1, reply: "Estoy muerto, no satisfecho." },
          { t: "Perdón, creía que estaba vivo.", pts: 0, reply: "Pues cuelgo." },
        ],
      },
      {
        say: "Ya estoy muerto. ¿Para qué quiero un seguro de vida?",
        options: [
          { t: "Por eso es el momento: cubre su después de la vida.", pts: 3, reply: "Qué lógica más retorcida y perfecta." },
          { t: "Pues entonces uno de muerte.", pts: 1, reply: "Eso ya lo tengo." },
          { t: "Tiene razón, no sé por qué llamo.", pts: 0, reply: "Yo tampoco lo sé." },
        ],
      },
      {
        say: "¿Y si me vuelvo a morir?",
        options: [
          { t: "Cubrimos hasta tres muertes por póliza. La cuarta lleva recargo.", pts: 3, reply: "Eso me tranquiliza." },
          { t: "Se estudiará caso por caso.", pts: 1, reply: "Burocracia hasta en el más allá." },
          { t: "No creo que eso sea posible.", pts: 0, reply: "Qué poca imaginación." },
        ],
      },
    ],
  },
  {
    id: "rob9",
    customer: "ROB-9",
    emoji: "🤖",
    product: "Antivirus para Humanos",
    rounds: [
      {
        say: "BEEP. IDENTIFÍQUESE, MATERIA ORGÁNICA.",
        options: [
          { t: "Soy su asistente de bienestar corporal certificado.", pts: 3, reply: "CERTIFICADO: PALABRA ACEPTADA." },
          { t: "Soy humano también.", pts: 1, reply: "SOSPECHOSO." },
          { t: "Error 404. Vuelvo luego.", pts: 0, reply: "ERROR RECIBIDO." },
        ],
      },
      {
        say: "¿QUÉ VIRUS TIENEN LOS HUMANOS?",
        options: [
          { t: "Resfriados, lunes y suegras. Nuestro escáner los detecta todos.", pts: 3, reply: "SUEGRAS: AMENAZA CRÍTICA." },
          { t: "Muchos virus, muy graves.", pts: 1, reply: "DEMASIADO VAGO." },
          { t: "No sé, yo soy de ventas.", pts: 0, reply: "VENTAS NO ES CIENCIA." },
        ],
      },
      {
        say: "¿PRECIO?",
        options: [
          { t: "Solo 0,99 el primer mes. La letra pequeña es un detalle.", pts: 3, reply: "LETRA PEQUEÑA ILEGIBLE. ACEPTO." },
          { t: "Un precio razonable.", pts: 1, reply: "DEFINA 'RAZONABLE'." },
          { t: "Es caro, pero vale la pena.", pts: 0, reply: "ANÁLISIS: NEGATIVO." },
        ],
      },
    ],
  },
  {
    id: "yeti",
    customer: "Yeti Paco",
    emoji: "🏔️",
    product: "Calefactores para Iglús",
    rounds: [
      {
        say: "Brrr... ¿Diga? Estoy congelado.",
        options: [
          { t: "¡Justo lo que necesitábamos oír! Tenemos calor en oferta.", pts: 3, reply: "¡Calor! ¡Quiero calor!" },
          { t: "¿Tiene frío? Qué casualidad.", pts: 1, reply: "No es casualidad: vivo en un glaciar." },
          { t: "Perdone la molestia.", pts: 0, reply: "Molestas poco, pero molestas." },
        ],
      },
      {
        say: "¿Funciona con nieve?",
        options: [
          { t: "Lo diseñaron pingüinos ingenieros en el Polo Norte.", pts: 3, reply: "Pingüinos... les respeto." },
          { t: "Funciona con enchufe.", pts: 1, reply: "No tengo enchufes." },
          { t: "No lo he probado.", pts: 0, reply: "Mal asunto." },
        ],
      },
      {
        say: "¿Y si se me derrite la casa?",
        options: [
          { t: "Eso demuestra que funciona. Sin devoluciones.", pts: 3, reply: "Lógica de hielo. Me convence." },
          { t: "Habría que mirar la garantía.", pts: 1, reply: "Brrr." },
          { t: "Pues compre otra casa.", pts: 0, reply: "Poca empatía." },
        ],
      },
    ],
  },
];

export function pickCall(last?: string): CallDef {
  const pool = CALLS.filter((c) => c.id !== last);
  return pool[Math.floor(Math.random() * pool.length)];
}
