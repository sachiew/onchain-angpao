/**
 * Greeting themes. Index = the `theme: u8` stored onchain, so never reorder; append only.
 * All art and palettes are original (no third-party brand assets).
 */

export type Lang = "en" | "bm" | "zh";

export type Motif =
  | "coins"
  | "ketupat"
  | "diya"
  | "star"
  | "confetti"
  | "rings"
  | "cap"
  | "plain";

export type Theme = {
  id: number;
  key: string;
  name: string;
  emoji: string;
  motif: Motif;
  /** Envelope colours */
  palette: { from: string; to: string; accent: string; ink: string; seal: string };
  greetings: Record<Lang, string>;
};

export const THEMES: Theme[] = [
  {
    id: 0,
    key: "cny",
    name: "Chinese New Year",
    emoji: "🧧",
    motif: "coins",
    palette: { from: "#c8102e", to: "#8a0b1f", accent: "#f6c445", ink: "#fff7e0", seal: "#f6c445" },
    greetings: {
      en: "Gong Xi Fa Cai! Wishing you a prosperous year 🍊",
      bm: "Gong Xi Fa Cai! Semoga murah rezeki 🍊",
      zh: "恭喜发财，万事如意！🍊",
    },
  },
  {
    id: 1,
    key: "raya",
    name: "Hari Raya",
    emoji: "🌙",
    motif: "ketupat",
    palette: { from: "#0f7b4b", to: "#07462b", accent: "#e9c46a", ink: "#fdf8e8", seal: "#e9c46a" },
    greetings: {
      en: "Selamat Hari Raya! Forgive me, body and soul 🌙",
      bm: "Selamat Hari Raya, Maaf Zahir dan Batin 🌙",
      zh: "开斋节快乐！🌙",
    },
  },
  {
    id: 2,
    key: "deepavali",
    name: "Deepavali",
    emoji: "🪔",
    motif: "diya",
    palette: { from: "#7b2cbf", to: "#3c096c", accent: "#ff9e00", ink: "#fff3e0", seal: "#ff9e00" },
    greetings: {
      en: "Happy Deepavali! May light win over darkness 🪔",
      bm: "Selamat Hari Deepavali 🪔",
      zh: "屠妖节快乐！🪔",
    },
  },
  {
    id: 3,
    key: "christmas",
    name: "Christmas",
    emoji: "🎄",
    motif: "star",
    palette: { from: "#1b4332", to: "#081c15", accent: "#e63946", ink: "#f1faee", seal: "#e63946" },
    greetings: {
      en: "Merry Christmas & a happy new year! 🎄",
      bm: "Selamat Hari Krismas! 🎄",
      zh: "圣诞快乐！🎄",
    },
  },
  {
    id: 4,
    key: "birthday",
    name: "Birthday",
    emoji: "🎂",
    motif: "confetti",
    palette: { from: "#ff6b9d", to: "#c9184a", accent: "#ffd60a", ink: "#fff0f5", seal: "#ffd60a" },
    greetings: {
      en: "Happy birthday! Treat yourself 🎂",
      bm: "Selamat hari jadi! 🎂",
      zh: "生日快乐！🎂",
    },
  },
  {
    id: 5,
    key: "wedding",
    name: "Wedding",
    emoji: "💍",
    motif: "rings",
    palette: { from: "#b5838d", to: "#6d597a", accent: "#ffe5d9", ink: "#fff8f5", seal: "#ffe5d9" },
    greetings: {
      en: "Congratulations to the happy couple! 💍",
      bm: "Selamat pengantin baru! 💍",
      zh: "百年好合，永结同心！💍",
    },
  },
  {
    id: 6,
    key: "graduation",
    name: "Graduation",
    emoji: "🎓",
    motif: "cap",
    palette: { from: "#1d3557", to: "#0b1a2e", accent: "#a8dadc", ink: "#f1faee", seal: "#a8dadc" },
    greetings: {
      en: "Congrats, graduate! The world is yours 🎓",
      bm: "Tahniah atas graduasi anda! 🎓",
      zh: "毕业快乐，前程似锦！🎓",
    },
  },
  {
    id: 7,
    key: "custom",
    name: "Custom",
    emoji: "✨",
    motif: "plain",
    palette: { from: "#f77f00", to: "#d62828", accent: "#fcbf49", ink: "#fffaf0", seal: "#fcbf49" },
    greetings: {
      en: "A little something for you ✨",
      bm: "Sedikit hadiah untuk anda ✨",
      zh: "一点心意 ✨",
    },
  },
];

export function getTheme(id: number): Theme {
  return THEMES[id] ?? THEMES[THEMES.length - 1];
}

export const LANGS: { key: Lang; label: string }[] = [
  { key: "en", label: "EN" },
  { key: "bm", label: "BM" },
  { key: "zh", label: "中文" },
];

/** UTF-8 byte length (the onchain limit is 140 bytes, and CJK chars are 3 bytes each). */
export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}
