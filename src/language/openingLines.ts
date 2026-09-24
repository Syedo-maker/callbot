import type { Gender, LanguageCode } from "../types.ts";

/**
 * Pre-written opening lines, so the first words of every call are fixed and approved rather
 * than generated. DRAFT translations — native-speaker review is Phase 2 item 14.
 * Placeholders: {agent} {university} {student}. Female/male forms differ where the verb
 * agrees with the speaker's gender (Urdu, Punjabi, Sindhi, Hindi).
 */
interface Lines {
  intro: Record<"female" | "male", string>;
  disclosure: string;
  notice: string;
  question: string;
}

const same = (s: string) => ({ female: s, male: s });

export const OPENING_LINES: Partial<Record<LanguageCode, Lines>> = {
  en: {
    intro: same("Assalam-o-Alaikum, this is {agent} from the admissions office at {university}."),
    disclosure: "I'm an automated assistant calling from the admissions office.",
    notice: "This call is recorded for quality purposes.",
    question: "Am I speaking with {student}?",
  },
  ur: {
    intro: {
      female: "السلام علیکم، میں {university} کے ایڈمیشن آفس سے {agent} بات کر رہی ہوں۔",
      male: "السلام علیکم، میں {university} کے ایڈمیشن آفس سے {agent} بات کر رہا ہوں۔",
    },
    disclosure: "میں ایڈمیشن آفس کی جانب سے ایک خودکار اسسٹنٹ ہوں۔",
    notice: "یہ کال معیار کے لیے ریکارڈ کی جا رہی ہے۔",
    question: "کیا میری بات {student} سے ہو رہی ہے؟",
  },
  pa: {
    intro: {
      female: "السلام علیکم، میں {university} دے ایڈمیشن دفتر توں {agent} گل کر رہی آں۔",
      male: "السلام علیکم، میں {university} دے ایڈمیشن دفتر توں {agent} گل کر رہیا آں۔",
    },
    disclosure: "میں ایڈمیشن دفتر ولوں اک خودکار اسسٹنٹ آں۔",
    notice: "ایہہ کال معیار واسطے ریکارڈ کیتی جا رہی اے۔",
    question: "کی میری گل {student} نال ہو رہی اے؟",
  },
  sd: {
    intro: {
      female: "السلام عليڪم، مان {university} جي داخلا آفيس مان {agent} ڳالهائي رهي آهيان.",
      male: "السلام عليڪم، مان {university} جي داخلا آفيس مان {agent} ڳالهائي رهيو آهيان.",
    },
    disclosure: "مان داخلا آفيس پاران هڪ خودڪار اسسٽنٽ آهيان.",
    notice: "هيءَ ڪال معيار لاءِ رڪارڊ ڪئي پئي وڃي.",
    question: "ڇا منهنجي ڳالهه {student} سان ٿي رهي آهي؟",
  },
  ps: {
    intro: same("السلام علیکم، زه {agent} یم، د {university} د داخلې له دفتر څخه."),
    disclosure: "زه د داخلې دفتر له خوا یو اتومات مرستیال یم.",
    notice: "دا کال د کیفیت لپاره ثبتېږي.",
    question: "ایا زه له {student} سره خبرې کوم؟",
  },
  ar: {
    intro: same("السلام عليكم، أنا {agent} من مكتب القبول في {university}."),
    disclosure: "أنا مساعد آلي أتصل من مكتب القبول.",
    notice: "يتم تسجيل هذه المكالمة لأغراض الجودة.",
    question: "هل أتحدث مع {student}؟",
  },
  hi: {
    intro: {
      female: "नमस्ते, मैं {university} के एडमिशन ऑफ़िस से {agent} बात कर रही हूँ।",
      male: "नमस्ते, मैं {university} के एडमिशन ऑफ़िस से {agent} बात कर रहा हूँ।",
    },
    disclosure: "मैं एडमिशन ऑफ़िस की ओर से एक स्वचालित सहायक हूँ।",
    notice: "यह कॉल गुणवत्ता के लिए रिकॉर्ड की जा रही है।",
    question: "क्या मेरी बात {student} से हो रही है?",
  },
};

export const hasOpeningLine = (lang: LanguageCode) => lang in OPENING_LINES;

export function openingLine(opts: {
  language: LanguageCode;
  personaGender: Exclude<Gender, "unknown">;
  agentName: string;
  university: string;
  student: string;
  upfrontDisclosure: boolean;
}): string {
  const l = OPENING_LINES[opts.language];
  if (!l) throw new Error(`No opening line for language "${opts.language}"`);
  const parts = [l.intro[opts.personaGender], ...(opts.upfrontDisclosure ? [l.disclosure] : []), l.notice, l.question];
  return parts
    .join(" ")
    .replaceAll("{agent}", opts.agentName)
    .replaceAll("{university}", opts.university)
    .replaceAll("{student}", opts.student);
}
