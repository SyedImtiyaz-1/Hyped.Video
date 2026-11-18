// Ask AI's own words around an answer ("Worked for 4s", its steps, Undo this) in the language the customer typed in:
// English, Hinglish (Hindi in Latin letters) or Hindi in Devanagari (Taibanaz, 17 Nov: the thoughts in English when they
// write English, in Hindi when they write Hindi). The answer itself comes from the model, which replies in kind.

export type ChatLang = "en" | "hinglish" | "hindi";

// Words that only Hinglish uses (English's "do", "me", "main", "par", "to" and the like left out, so English stays English).
const HINGLISH = new Set(
  "karo kar kr kro krdo kardo karde kardena krna karna kariye kijiye hai hain hy ko ka ki ke mein wala wali wale hatao hata hatado hatana lagao laga lagado lagana daalo dalo daal dal rakho rakh thoda thode thodi aur nahi nai nahin sab sabhi saare wapas vapas pehle pahle phir fir bada bade badi chhota chota chhote chote peela peele pila laal lal neela nila hara kala safed upar neeche niche yahan yaha wahan waha kya kaise kyun ye yeh woh bana banao banado accha acha achha kaat kato kaatdo bhi sirf jaisa jaise jaisi mujhe mera meri mere abhi chahiye dikhao lao bolo zyada jyada kam halka halki tez dheere shuru aakhir baaki baki"
    .split(" "),
);

export function chatLang(text: string): ChatLang {
  if (/[ऀ-ॿ]/.test(text)) return "hindi";
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  return words.some((w) => HINGLISH.has(w)) ? "hinglish" : "en";
}

type Words = {
  read: string;
  looked: string;
  at: (time: string) => string;
  captionWords: (n: number) => string;
  frames: (n: number) => string;
  noCaptions: string;
  workedOut: (n: number) => string;
  checked: string;
  made: string;
  nothing: string;
  working: string;
  making: string;
  writing: string;
  lookingIn: (where: string) => string;
  lookingFor: (file: string) => string;
  newest: string;
  found: (name: string) => string;
  inFolder: (where: string) => string;
  library: string;
  lookedIn: (where: string) => string;
  noneNamed: (file: string) => string;
  noVideo: string;
  opened: (where: string) => string;
  toChoose: string;
  kept: string;
  workedFor: (time: string) => string;
  workingFor: (time: string) => string;
  inProgress: string;
  undo: string;
  undone: string;
};

export const CHAT_WORDS: Record<ChatLang, Words> = {
  en: {
    read: "Read your request",
    looked: "Looked at the reel",
    at: (t) => `At ${t}`,
    captionWords: (n) => `${n} caption words`,
    frames: (n) => `${n} frames of the video`,
    noCaptions: "No captions yet",
    workedOut: (n) => `Worked out ${n} change${n === 1 ? "" : "s"}`,
    checked: "Checked them against your reel",
    made: "Made them in your reel",
    nothing: "Found nothing to change",
    working: "Working out the changes",
    making: "Making them in your reel",
    writing: "Writing the answer",
    lookingIn: (w) => `Looking in ${w}`,
    lookingFor: (f) => `For ${f}`,
    newest: "For your newest video",
    found: (n) => `Found ${n}`,
    inFolder: (w) => `In ${w}`,
    library: "Put it in the library",
    lookedIn: (w) => `Looked in ${w}`,
    noneNamed: (f) => `No video named ${f} there`,
    noVideo: "No video there",
    opened: (w) => `Opened ${w}`,
    toChoose: "For you to choose the video",
    kept: "Kept your edit for the clip",
    workedFor: (t) => `Worked for ${t}`,
    workingFor: (t) => `Working for ${t}`,
    inProgress: "In progress",
    undo: "Undo this",
    undone: "Undone",
  },
  hinglish: {
    read: "Aapki baat padhi",
    looked: "Reel dekhi",
    at: (t) => `${t} par`,
    captionWords: (n) => `${n} caption shabd`,
    frames: (n) => `Video ke ${n} frame`,
    noCaptions: "Abhi captions nahi hain",
    workedOut: (n) => `${n} badlav tay kiye`,
    checked: "Reel se mila ke jaanche",
    made: "Reel me laga diye",
    nothing: "Badalne ko kuch nahi mila",
    working: "Badlav tay kar raha hai",
    making: "Reel me laga raha hai",
    writing: "Jawab likh raha hai",
    lookingIn: (w) => `${w} me dekh raha hai`,
    lookingFor: (f) => `${f} ke liye`,
    newest: "Aapki sabse nayi video ke liye",
    found: (n) => `${n} mil gayi`,
    inFolder: (w) => `${w} me`,
    library: "Library me rakh di",
    lookedIn: (w) => `${w} me dekha`,
    noneNamed: (f) => `Wahan ${f} naam ki video nahi hai`,
    noVideo: "Wahan koi video nahi hai",
    opened: (w) => `${w} khola`,
    toChoose: "Aap video chun lein",
    kept: "Clip ke liye aapka edit rakh liya",
    workedFor: (t) => `${t} kaam kiya`,
    workingFor: (t) => `${t} se kaam chal raha hai`,
    inProgress: "Chal raha hai",
    undo: "Ise wapas karo",
    undone: "Wapas ho gaya",
  },
  hindi: {
    read: "आपकी बात पढ़ी",
    looked: "रील देखी",
    at: (t) => `${t} पर`,
    captionWords: (n) => `${n} कैप्शन शब्द`,
    frames: (n) => `वीडियो के ${n} फ़्रेम`,
    noCaptions: "अभी कैप्शन नहीं हैं",
    workedOut: (n) => `${n} बदलाव तय किए`,
    checked: "रील से मिलाकर जाँचे",
    made: "रील में लगा दिए",
    nothing: "बदलने को कुछ नहीं मिला",
    working: "बदलाव तय कर रहा है",
    making: "रील में लगा रहा है",
    writing: "जवाब लिख रहा है",
    lookingIn: (w) => `${w} में देख रहा है`,
    lookingFor: (f) => `${f} के लिए`,
    newest: "आपकी सबसे नई वीडियो के लिए",
    found: (n) => `${n} मिल गई`,
    inFolder: (w) => `${w} में`,
    library: "लाइब्रेरी में रख दी",
    lookedIn: (w) => `${w} में देखा`,
    noneNamed: (f) => `वहाँ ${f} नाम की वीडियो नहीं है`,
    noVideo: "वहाँ कोई वीडियो नहीं है",
    opened: (w) => `${w} खोला`,
    toChoose: "आप वीडियो चुन लें",
    kept: "क्लिप के लिए आपका एडिट रख लिया",
    workedFor: (t) => `${t} काम किया`,
    workingFor: (t) => `${t} से काम चल रहा है`,
    inProgress: "चल रहा है",
    undo: "इसे वापस करो",
    undone: "वापस हो गया",
  },
};
