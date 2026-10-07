// Llamadas: parodia de humor negro de los call center que estafan. Víctimas y empresas ficticias;
// las estafas son absurdas y no enseñan ninguna técnica real.
//
// Cada respuesta sube o baja la CONFIANZA del cliente. Si llega a TRUST_WIN se cierra el trato al
// momento; si cae a 0, cuelga. Al acabar las rondas, con TRUST_DEAL o más también hay trato.
// El cliente reacciona con frases genéricas (react) que valen para muchas respuestas, así que cada
// cliente necesita pocos audios. En los textos, {alias} se cambia por el alias del empleado.
//
// Audios: public/audio/calls/<id>_<clave>.mp3 (p. ej. doris_r1_cliente.mp3, doris_bien1.mp3).
// La lista completa: `npm run guion` (GUION-AUDIOS.md). Si falta un audio, solo se ve el texto.

export interface CallOption {
  t: string; // lo que dice el empleado
  trust: number; // cuánto sube o baja la confianza
}

export interface CallRound {
  say: string; // lo que dice el cliente
  options: [CallOption, CallOption, CallOption];
}

export type Reaction = "bien1" | "bien2" | "duda1" | "duda2" | "mal" | "trato" | "cuelga";

export interface CallDef {
  id: string;
  customer: string;
  emoji: string;
  scam: string; // el timo de la llamada
  rounds: CallRound[];
  react: Record<Reaction, string>;
  bank: { balance: number; extra: string }; // lo que hay en su cuenta (balance 0 = cuenta trampa)
}

export const TRUST_START = 25;
export const TRUST_WIN = 100;
export const TRUST_DEAL = 70;
const GOOD = 30;
const MEH = 5;
const BAD = -20;

export const REACTION_INFO: Record<Reaction, string> = {
  bien1: "le convence (1)",
  bien2: "le convence (2)",
  duda1: "duda (1)",
  duda2: "duda (2)",
  mal: "se mosquea",
  trato: "TRATO CERRADO",
  cuelga: "CUELGA",
};

export const CALLS: CallDef[] = [
  {
    id: "doris",
    customer: "Doris, 84 años",
    emoji: "👵",
    scam: "Soporte técnico de Microsofty",
    rounds: [
      {
        say: "¿Hola? ¿Eres tú, Timmy? ¡Nunca me llamas!",
        options: [
          { t: "Buenos días, señora, la llamo por su ordenador.", trust: MEH },
          { t: "Sí, abuela… digo, soy {alias}, del soporte técnico de Microsofty. Su ordenador nos ha llamado llorando.", trust: GOOD },
          { t: "No soy Timmy. Timmy no la quiere. Deme su tarjeta.", trust: BAD },
        ],
      },
      {
        say: "¿Mi ordenador? Si solo lo uso para el solitario y para ver fotos de gatos.",
        options: [
          { t: "El solitario es ilegal desde ayer.", trust: BAD },
          { t: "Puede que tenga un problema… técnico.", trust: MEH },
          { t: "Exacto: los gatos traen virus. Lo dice la ciencia de Microsofty.", trust: GOOD },
        ],
      },
      {
        say: "¿Y qué tengo que hacer, cielo?",
        options: [
          { t: "Nada, Doris: léame los números de su tarjeta y yo le espanto los gatos víricos.", trust: GOOD },
          { t: "Sobrevivir a su ordenador, básicamente.", trust: BAD },
          { t: "Pues comprar un antivirus, supongo.", trust: MEH },
        ],
      },
    ],
    react: {
      bien1: "Ay, qué chico más educado.",
      bien2: "Eso tiene sentido, como el horóscopo.",
      duda1: "I don't know… se lo voy a preguntar a mi gato.",
      duda2: "Mmm… ¿seguro que no eres Timmy?",
      mal: "¡Oiga! ¡Que tengo 84 años, no soy tonta!",
      trato: "Espera, que busco las gafas… La tarjeta empieza por 4… ¿Quieres también el PIN, cariño?",
      cuelga: "Voy a llamar a Timmy. Al de verdad.",
    },
    bank: { balance: 3214.5, extra: "+ 14 caramelos de menta en la caja fuerte" },
  },
  {
    id: "gary",
    customer: "Gary, el conspiranoico",
    emoji: "🧢",
    scam: "Devolución de la Agencia Fiscal Federal",
    rounds: [
      {
        say: "¿Quién es? ¿Cómo has conseguido este número? Lo cambio todos los martes.",
        options: [
          { t: "Me lo ha dado la NSA, como a todo el mundo.", trust: BAD },
          { t: "Gary, soy el agente {alias}. El gobierno le debe dinero. Sí, a usted.", trust: GOOD },
          { t: "Le llamo de una agencia oficial.", trust: MEH },
        ],
      },
      {
        say: "El gobierno nunca devuelve nada. Esto huele a trampa.",
        options: [
          { t: "Por eso le llamamos en secreto, desde un sótano, sin que se entere el gobierno.", trust: GOOD },
          { t: "Es un procedimiento normal, de verdad.", trust: MEH },
          { t: "Sí, es una trampa, pero de las buenas.", trust: BAD },
        ],
      },
      {
        say: "Vale. ¿Cómo me pagáis? No me fío de los bancos.",
        options: [
          { t: "Por transferencia, como todo el mundo.", trust: MEH },
          { t: "En bitcoins que guardamos en un calcetín.", trust: BAD },
          { t: "Deme sus datos bancarios y se lo ingresamos antes de que los lagartos se den cuenta.", trust: GOOD },
        ],
      },
    ],
    react: {
      bien1: "Lo sabía. Siempre lo supe.",
      bien2: "Eso es justo lo que diría alguien de dentro… Me gusta.",
      duda1: "I don't know, man… se oye un ventilador raro de fondo.",
      duda2: "Hmm. Tengo que consultarlo con mi foro.",
      mal: "¡Eres un lagarto! ¡Lo noto en la voz!",
      trato: "Apunta rápido, que nos escuchan: el número de cuenta es…",
      cuelga: "Me voy al búnker. No vuelvas a llamar.",
    },
    bank: { balance: 48210, extra: "+ 3 lingotes enterrados en el jardín (no declarados)" },
  },
  {
    id: "karen",
    customer: "Karen, quiere hablar con tu encargado",
    emoji: "💅",
    scam: "Reembolso de un pedido que nunca hizo",
    rounds: [
      {
        say: "¿Quién es? Si es publicidad, exijo hablar con tu encargado.",
        options: [
          { t: "Señora, YO soy el encargado. El encargado del encargado, de hecho.", trust: GOOD },
          { t: "Mi encargado está en la playa con su dinero.", trust: BAD },
          { t: "Llamamos por un reembolso de su pedido.", trust: MEH },
        ],
      },
      {
        say: "¿Reembolso? No he pedido nada. Bueno, cuarenta velas aromáticas.",
        options: [
          { t: "Puede haber un error en el sistema.", trust: MEH },
          { t: "Le cobramos 4.000 por error. Ya he despedido al culpable, señora.", trust: GOOD },
          { t: "Las velas eran feas, la verdad.", trust: BAD },
        ],
      },
      {
        say: "Quiero mi dinero ahora mismo. Y una disculpa por escrito.",
        options: [
          { t: "¿Por escrito? Si quiere le canto una canción.", trust: BAD },
          { t: "Se lo devolvemos en unos días hábiles.", trust: MEH },
          { t: "Por supuesto. Necesito su número de cuenta y, por las molestias, una reseña de cinco estrellas.", trust: GOOD },
        ],
      },
    ],
    react: {
      bien1: "Por fin alguien competente.",
      bien2: "Así se trata a una clienta.",
      duda1: "I don't know… esto no me lo explicaron en el grupo de madres.",
      duda2: "Hmm, tu tono no me convence.",
      mal: "¡Pásame con tu encargado AHORA!",
      trato: "Apunta. Y que conste que lo hago porque soy muy razonable.",
      cuelga: "Una estrella. Y te denuncio en Facebook.",
    },
    bank: { balance: 15999.99, extra: "+ un vale para 40 velas aromáticas" },
  },
  {
    id: "herbert",
    customer: "Herbert, viudo y solitario",
    emoji: "👴",
    scam: "La herencia del Príncipe de Nigeria",
    rounds: [
      {
        say: "¿Sí? Hacía tanto que no sonaba el teléfono que creía que se había roto.",
        options: [
          { t: "Hola, tengo una propuesta de negocio.", trust: MEH },
          { t: "¿Está usted solo en casa? Lo pregunto por nada.", trust: BAD },
          { t: "Saludos, Herbert. Soy {alias}, secretario de Su Alteza el Príncipe. Busca un hombre de confianza y le ha elegido a usted.", trust: GOOD },
        ],
      },
      {
        say: "¿Un príncipe? ¿Y por qué yo?",
        options: [
          { t: "Porque el ordenador real dijo: «Herbert, de Ohio». Es el destino.", trust: GOOD },
          { t: "Porque los demás ya nos han bloqueado.", trust: BAD },
          { t: "Lo hemos elegido al azar, pero con cariño.", trust: MEH },
        ],
      },
      {
        say: "¿Y qué tengo que hacer?",
        options: [
          { t: "Firmar aquí con sangre. Es broma. ¿O no?", trust: BAD },
          { t: "Solo prestarle su cuenta para depositar 30 millones. Usted se queda el 20 %. Y una corona de recuerdo.", trust: GOOD },
          { t: "Enviarnos 500 dólares para los papeles.", trust: MEH },
        ],
      },
    ],
    react: {
      bien1: "¡Ay, si Martha viviera para ver esto!",
      bien2: "Eso suena muy oficial.",
      duda1: "I don't know… mi sobrino dice que no me fíe de los príncipes.",
      duda2: "Hmm… ¿y no hay una princesa?",
      mal: "Joven, soy viejo, no idiota.",
      trato: "Le doy mi cuenta, joven. Y si el príncipe quiere, que venga a cenar el domingo.",
      cuelga: "Me voy a ver la tele. Al menos ella no me pide nada.",
    },
    bank: { balance: 27650, extra: "+ la pensión de Martha, que nadie ha dado de baja" },
  },
  {
    id: "bob",
    customer: "Bob, el cazaestafadores",
    emoji: "🕵️",
    scam: "Soporte técnico de Microsofty (otra vez)",
    rounds: [
      {
        say: "¡Hola, hola! ¿Me llamáis por mi ordenador? Espera que lo enciendo… tarda 45 minutos.",
        options: [
          { t: "¿45 minutos? ¿No tiene otro?", trust: MEH },
          { t: "Sin problema, señor Bob. Mientras tanto le explico la oferta.", trust: GOOD },
          { t: "Bob, sé que me estás grabando para YouTube.", trust: BAD },
        ],
      },
      {
        say: "Ya está. Me sale una pantalla azul que pone «te estoy grabando». ¿Es normal?",
        options: [
          { t: "Bob, cuelgo, que te conozco.", trust: BAD },
          { t: "Totalmente normal, es el virus. Por eso le llamamos.", trust: GOOD },
          { t: "Eh… no toque nada.", trust: MEH },
        ],
      },
      {
        say: "Perfecto. ¿Te doy la tarjeta? Es el 1-2-3… espera, que me suena la tetera.",
        options: [
          { t: "Tranquilo, Bob, yo espero. Tengo una cuota que cumplir.", trust: GOOD },
          { t: "Rápido, que me echa el jefe.", trust: MEH },
          { t: "¡Dame la tarjeta o maldigo a toda tu familia!", trust: BAD },
        ],
      },
    ],
    react: {
      bien1: "Eres muy buen profesional. Te voy a recomendar… ¡a la policía! Es broma.",
      bien2: "¡Qué paciencia! Me encanta.",
      duda1: "I don't know… ¿cómo se escribe «Microsofty»? Es para la denuncia. ¡Digo, la reseña!",
      duda2: "Uy, se me ha cortado… ¿sigues ahí? Qué bien.",
      mal: "Saluda a la cámara, amigo. Tienes dos millones de visitas.",
      trato: "Ahí va: cero, cero, cero, cero… Caduca nunca. ¡Trato hecho! (El jefe no lo comprueba.)",
      cuelga: "Gracias por los cuarenta minutos. Suscríbete al canal.",
    },
    bank: { balance: 0, extra: "Mensaje del banco: «Hola, soy Bob. Saluda a la cámara 👋»" },
  },
  {
    id: "brenda",
    customer: "Brenda, influencer",
    emoji: "🤳",
    scam: "La Lotería Internacional de Influencers",
    rounds: [
      {
        say: "¿Quién es? Estoy en directo, tengo a 300 personas mirando.",
        options: [
          { t: "¿300? Mi abuela tiene más seguidores.", trust: BAD },
          { t: "Hola, la llamo por un premio.", trust: MEH },
          { t: "¡Brenda! Soy {alias}, de la Lotería Internacional de Influencers. ¡Ha ganado!", trust: GOOD },
        ],
      },
      {
        say: "¿Ganado? ¿Qué he ganado? ¡Chicos, he ganado algo!",
        options: [
          { t: "Un millón de dólares y la marca azul de verificada. Para siempre.", trust: GOOD },
          { t: "Un cupón del 5 % en velas aromáticas.", trust: BAD },
          { t: "Un premio. Bastante dinero, creo.", trust: MEH },
        ],
      },
      {
        say: "¡Me encanta! ¿Qué necesitas?",
        options: [
          { t: "Pagar 99 dólares de tasas.", trust: MEH },
          { t: "Sus datos bancarios para el ingreso. Léalos en directo, así sus fans son testigos.", trust: GOOD },
          { t: "Su contraseña de Instagram. Y la de todo lo demás.", trust: BAD },
        ],
      },
    ],
    react: {
      bien1: "¡OMG! ¡Chicos, dadle like!",
      bien2: "Esto es, literal, lo mejor que me ha pasado.",
      duda1: "I don't know… el chat dice que es una estafa.",
      duda2: "Hmm, ¿esto es una colaboración pagada?",
      mal: "Bloqueado y reportado. Chicos, es un hater.",
      trato: "¡Chat, apuntad conmigo! El número de cuenta es…",
      cuelga: "Me voy a hacer un directo llorando por esto.",
    },
    bank: { balance: 912.3, extra: "+ 3 millones de seguidores comprados" },
  },
];

/** Reacción del cliente según cuánto ha cambiado la confianza. */
export function reactionFor(delta: number): Reaction {
  const two = Math.random() < 0.5 ? "1" : "2";
  if (delta >= 20) return `bien${two}` as Reaction;
  if (delta > 0) return `duda${two}` as Reaction;
  return "mal";
}

/** Archivo de audio por convención: <id>_<clave>.mp3 (clave: r1_cliente, r1_op2_jugador, bien1…). */
export const audioFile = (callId: string, key: string) => `${callId}_${key}.mp3`;

/** Lo que dice el cliente si se acaba el tiempo sin responder. */
export const SILENCE_REPLY = { text: "…¿Hola? ¿Sigue usted ahí?", audio: "general_silencio.mp3", trust: -15 };

export function pickCall(last?: string): CallDef {
  const pool = CALLS.filter((c) => c.id !== last);
  return pool[Math.floor(Math.random() * pool.length)];
}
