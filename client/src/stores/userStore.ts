import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserStore {
  userId: string;
  username: string;
  hasHydrated: boolean;
  generateNewId: () => void;
  setUsername: (username: string) => void;
}

const ADJECTIVES = [
  // Cũ
  "swift",
  "brave",
  "calm",
  "cool",
  "quick",
  "bold",
  "wise",
  "keen",
  "wild",
  "free",
  "pure",
  "deep",
  "warm",
  "soft",
  "fair",
  "true",
  "glad",
  "kind",
  "neat",
  "rich",
  "safe",
  "slim",
  "tall",
  "fast",
  // Mới: Trạng thái & Tính chất
  "bright",
  "dark",
  "sharp",
  "smooth",
  "grand",
  "proud",
  "vivid",
  "silent",
  "lucky",
  "heavy",
  "light",
  "fresh",
  "mighty",
  "gentle",
  "fancy",
  "tough",
  "loyal",
  "quiet",
  "smart",
  "super",
  "eager",
  "jolly",
  "crisp",
  "sturdy",
  "noble",
  "brisk",
  "dandy",
  "fancy",
  "flat",
  "glossy",
  "good",
  "grand",
  "great",
  "handy",
  "happy",
  "hardy",
  "huge",
  "lean",
  "long",
  "lost",
  // Mới: Màu sắc & Cảm giác
  "red",
  "blue",
  "green",
  "gold",
  "silver",
  "pink",
  "gray",
  "white",
  "black",
  "azure",
  "amber",
  "blind",
  "busy",
  "cheap",
  "chief",
  "clean",
  "close",
  "crazy",
  "curly",
  "cute",
  "daft",
  "dear",
  "dirty",
  "dry",
  "easy",
  "extra",
  "fair",
  "fine",
  "firm",
  "flat",
  "full",
  "funny",
  "good",
  "grey",
  "grim",
  "half",
  "hard",
  "high",
  "holy",
  "hot",
];

const NOUNS = [
  // Cũ
  "tiger",
  "wave",
  "star",
  "wind",
  "hawk",
  "wolf",
  "bear",
  "lake",
  "moon",
  "fire",
  "snow",
  "leaf",
  "rain",
  "rock",
  "rose",
  "tree",
  "bird",
  "fish",
  "frog",
  "deer",
  "dove",
  "fox",
  "owl",
  "seal",
  // Mới: Động vật & Sinh vật
  "eagle",
  "lion",
  "lynx",
  "orca",
  "panda",
  "crane",
  "swan",
  "falcon",
  "whale",
  "shark",
  "horse",
  "mouse",
  "snake",
  "goat",
  "lamb",
  "duck",
  "goose",
  "crab",
  "ant",
  "bee",
  "wasp",
  "moth",
  "slug",
  "snail",
  "stork",
  "crow",
  "raven",
  "robin",
  "finch",
  "cricket",
  // Mới: Thiên nhiên & Địa lý
  "ocean",
  "mount",
  "river",
  "cloud",
  "desert",
  "forest",
  "valley",
  "peak",
  "cliff",
  "dune",
  "field",
  "glade",
  "grove",
  "island",
  "marsh",
  "meadow",
  "pond",
  "reef",
  "shore",
  "spring",
  "stone",
  "brook",
  "creek",
  "bench",
  "bridge",
  "gate",
  "path",
  "road",
  "stone",
  "wall",
  // Mới: Vũ trụ & Khác
  "sun",
  "mars",
  "sky",
  "comet",
  "nova",
  "dust",
  "gem",
  "iron",
  "gold",
  "silk",
  "steel",
  "zinc",
  "bolt",
  "beam",
  "ray",
  "zone",
  "space",
  "orbit",
  "path",
  "way",
];

function toUpperCaseFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Generate random 3-digit suffix (001-999)
export const generateSuffix = (): string => {
  return String(Math.floor(1 + Math.random() * 999)).padStart(3, "0");
};

export const cleanName = (name: string) =>
  name.trim().replace(/\d+$/, "").replace(/\s+/g, "");

// Generate username with suffix - accepts optional custom name
export const generateUsernameWithSuffix = (customName?: string): string => {
  if (customName) {
    return `${cleanName(customName)}${generateSuffix()}`;
  }

  // Fallback to random adjective-noun combination
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${toUpperCaseFirstLetter(adj)}${toUpperCaseFirstLetter(noun)}${generateSuffix()}`;
};

// Generate short, readable, memorable IDs like "swift-tiger-42" (deprecated, use generateUsernameWithSuffix)
export const generateRandomUsername = (): string => {
  return generateUsernameWithSuffix();
};

export const STORAGE_KEY = "gamehub_username";

export const useUserStore = create<UserStore>()(
  persist(
    (set) => {
      return {
        userId: "",
        username: "",
        hasHydrated: false,

        generateNewId: () => {
          const u = generateRandomUsername();
          // Zustand persist will auto-save to localStorage
          return set({
            userId: "user_" + u,
            username: u,
          });
        },
        setUsername: (username: string) => {
          // Zustand persist will auto-save to localStorage
          return set({
            userId: "user_" + username,
            username: username,
          });
        },
      };
    },
    {
      name: STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        // This runs after hydration is complete
        if (state) {
          state.hasHydrated = true;
        }
      },
    },
  ),
);
