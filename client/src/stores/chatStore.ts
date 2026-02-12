import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
  type: "user" | "system";
  temp?: boolean;
  reports?: string[];
  isDeleted?: boolean;
}

interface ChatStore {
  onlineCount: number;
  setOnlineCount: (count: number) => void;
  messages: ChatMessage[];
  isGlobalChatOpen: boolean;
  setGlobalChatOpen: (isOpen: boolean) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  setMessages: (messages: ChatMessage[]) => void;
  hiddenUsers: string[];
  hideUser: (userId: string) => void;
  unhideUser: (userId: string) => void;
  unhideAllUsers: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      onlineCount: 0,
      setOnlineCount: (count) => set({ onlineCount: count }),
      isGlobalChatOpen: false,
      setGlobalChatOpen: (isOpen) => set({ isGlobalChatOpen: isOpen }),

      messages: [],
      addMessage: (message) =>
        set((state) => {
          // Prevent duplicates
          if (state.messages.some((m) => m.id === message.id)) {
            return state;
          }
          return { messages: [...state.messages, message] };
        }),
      updateMessage: (id, updates) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, ...updates } : m,
          ),
        })),
      clearMessages: () => set({ messages: [] }),
      setMessages: (messages) => set({ messages }),

      hiddenUsers: [],
      hideUser: (userId) =>
        set((state) => ({
          hiddenUsers: [...new Set([...state.hiddenUsers, userId])],
        })),
      unhideUser: (userId) =>
        set((state) => ({
          hiddenUsers: state.hiddenUsers.filter((id) => id !== userId),
        })),
      unhideAllUsers: () => set({ hiddenUsers: [] }),
    }),
    {
      name: "gamehub-chat-v1",
      partialize: (state) => ({
        hiddenUsers: state.hiddenUsers,
        isGlobalChatOpen: state.isGlobalChatOpen,
      }),
    },
  ),
);
