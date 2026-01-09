import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

interface UserStore {
  userId: string;
  username: string;
  generateNewId: () => void;
  setUsername: (username: string) => void;
}

const generateUserId = () => `user_${uuidv4()}`;

const generateRandomUsername = () => {
  const adjectives = [
    "Swift",
    "Brave",
    "Clever",
    "Mighty",
    "Cosmic",
    "Epic",
    "Neon",
    "Shadow",
  ];
  const nouns = [
    "Player",
    "Gamer",
    "Hero",
    "Knight",
    "Ninja",
    "Wizard",
    "Dragon",
    "Phoenix",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
};

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      userId: generateUserId(),
      username: generateRandomUsername(),
      generateNewId: () =>
        set({
          userId: generateUserId(),
          username: generateRandomUsername(),
        }),
      setUsername: (username: string) => set({ username }),
    }),
    {
      name: "gamehub_user",
    }
  )
);
