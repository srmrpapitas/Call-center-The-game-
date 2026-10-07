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
  {
    id: "medusa",
    customer: "Doña Medusa",
    emoji: "🐍",
    product: "Espejos Antirreflejo",
    rounds: [
      {
        say: "Sssí, ¿quién es? Y no me mire, que es peor.",
        options: [
          { t: "¡No la miro, se lo prometo! Llamo justo por eso: espejos que no devuelven la mirada.", pts: 3, reply: "Sssugerente." },
          { t: "Tengo una oferta que le dejará de piedra.", pts: 1, reply: "Eso lo hago yo, querido." },
          { t: "¿Puede activar la videollamada?", pts: 0, reply: "Usted no aprende, ¿eh?" },
        ],
      },
      {
        say: "Mi último peluquero acabó de estatua. ¿Y los espejos?",
        options: [
          { t: "Irrompibles, y con garantía de que ninguno sale petrificado.", pts: 3, reply: "Por fin un poco de seguridad laboral." },
          { t: "Son espejos normales, pero más caros.", pts: 1, reply: "Qué sinceridad tan poco comercial." },
          { t: "Su peluquero no estará en nuestra base de clientes, ¿no?", pts: 0, reply: "Está en mi jardín." },
        ],
      },
      {
        say: "¿Y si me canso de ellos?",
        options: [
          { t: "Los decora usted con sus serpientes. Edición limitada.", pts: 3, reply: "Mis niñas estarán encantadas. Trato." },
          { t: "Tiene catorce días para devolverlos.", pts: 1, reply: "El mensajero no sobrevivirá." },
          { t: "Pues los tira, como todo el mundo.", pts: 0, reply: "Sssin alma." },
        ],
      },
    ],
  },
  {
    id: "barbanegra",
    customer: "Capitán Barbanegra",
    emoji: "🏴‍☠️",
    product: "GPS para Tesoros Enterrados",
    rounds: [
      {
        say: "¡Arrr! ¿Quién se atreve a llamar a mi loro?",
        options: [
          { t: "Su proveedor oficial de mapas, capitán. Sin la X borrosa.", pts: 3, reply: "¡Arrr! Esa X me trae por la calle de la amargura." },
          { t: "Un servicio de atención al pirata.", pts: 1, reply: "¿Atención? Yo atiendo a cañonazos." },
          { t: "Creo que me he equivocado de número.", pts: 0, reply: "¡A la tabla con él!" },
        ],
      },
      {
        say: "Ya tengo un mapa. Me lo dio un tipo con una pata de palo.",
        options: [
          { t: "Ese mapa tiene dos siglos y ninguna actualización. El nuestro avisa de los tiburones.", pts: 3, reply: "Los tiburones me deben un brazo..." },
          { t: "El nuestro es más bonito.", pts: 1, reply: "La belleza no da doblones." },
          { t: "¿Seguro que no es un mapa del metro?", pts: 0, reply: "¡Arrr, insolente!" },
        ],
      },
      {
        say: "¿Cuánto me cuesta?",
        options: [
          { t: "Un 10 % del tesoro que encuentre. Si no encuentra nada, no paga... casi.", pts: 3, reply: "¡Trato hecho, grumete!" },
          { t: "Tenemos planes desde 29,99 al mes.", pts: 1, reply: "¿Mes? Yo cuento en mareas." },
          { t: "Solo aceptamos tarjeta, nada de oro.", pts: 0, reply: "¡Pues hundan su barco!" },
        ],
      },
    ],
  },
  {
    id: "manolo",
    customer: "Manolo el Zombi",
    emoji: "🧟",
    product: "Plan de Dieta Sin Cerebros",
    rounds: [
      {
        say: "Ceeerebrooos... digo, ¿diga?",
        options: [
          { t: "¡Manolo! Le llamo para ayudarle a dejar ese mal hábito.", pts: 3, reply: "Llevo siglos intentándolo, uuugh." },
          { t: "Le ofrezco un plan de alimentación.", pts: 1, reply: "¿Lleva... cerebros?" },
          { t: "Uy, qué voz más rara tiene usted.", pts: 0, reply: "Se me cayó la mandíbula. Literal." },
        ],
      },
      {
        say: "¿Y qué voy a comer, entonces?",
        options: [
          { t: "Coliflor. Tiene la misma forma y cero remordimientos.", pts: 3, reply: "Coliflor... qué idea más brillante." },
          { t: "Ensaladas variadas.", pts: 1, reply: "Las ensaladas no corren. Qué aburrido." },
          { t: "Lo que quiera, menos a mí.", pts: 0, reply: "Ya veremos." },
        ],
      },
      {
        say: "¿Y si me cuesta seguirlo?",
        options: [
          { t: "Incluye un coach motivacional que, por contrato, ya no tiene cerebro que perder.", pts: 3, reply: "Me apunto, uuugh." },
          { t: "Puede pedir ayuda a su médico.", pts: 1, reply: "Me lo comí en 1987." },
          { t: "Pues no se apunte.", pts: 0, reply: "Uuugh. Grosero." },
        ],
      },
    ],
  },
  {
    id: "bruja",
    customer: "La Abuela Bruja",
    emoji: "🧙‍♀️",
    product: "Escobas Eléctricas",
    rounds: [
      {
        say: "¿Quién es? Tengo el caldero al fuego, sé breve.",
        options: [
          { t: "Su asesor de movilidad sostenible, señora. Escobas con batería de litio.", pts: 3, reply: "¿Batería? Como el móvil de mi nieta." },
          { t: "Alguien que la quiere ayudar.", pts: 1, reply: "Eso decía Hansel." },
          { t: "Huele a quemado desde aquí.", pts: 0, reply: "Es la cena. Y sobra sitio." },
        ],
      },
      {
        say: "Mi escoba de paja vuela de maravilla.",
        options: [
          { t: "Y ahora con asiento calefactable y GPS para no perderse en la niebla.", pts: 3, reply: "La niebla me tiene harta, sí." },
          { t: "La nuestra vuela más rápido.", pts: 1, reply: "¿Y para qué tanta prisa?" },
          { t: "Pues siga con ella, a mí qué.", pts: 0, reply: "Te convertiría en sapo si tuviera tiempo." },
        ],
      },
      {
        say: "¿Y cómo se carga?",
        options: [
          { t: "Con un rayo de luna llena o con un enchufe normal, lo que pille más cerca.", pts: 3, reply: "¡Moderna y tradicional! Me la llevo." },
          { t: "Viene con un cargador.", pts: 1, reply: "Otro cable más en la cueva." },
          { t: "No lo sé, nunca he volado.", pts: 0, reply: "Se nota." },
        ],
      },
    ],
  },
];

export function pickCall(last?: string): CallDef {
  const pool = CALLS.filter((c) => c.id !== last);
  return pool[Math.floor(Math.random() * pool.length)];
}
