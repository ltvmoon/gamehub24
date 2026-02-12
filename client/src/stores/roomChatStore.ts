import { create } from "zustand";
import { type ChatMessage } from "./globalChatStore";

interface RoomChatStore {
  messages: ChatMessage[];
  unreadCount: number;
  lastReadTime: number;
  visibleViews: number;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  incrementUnread: () => void;
  clearUnread: () => void;
  setChatVisible: (visible: boolean) => void;
}

export const useRoomChatStore = create<RoomChatStore>((set) => ({
  messages: [],
  unreadCount: 0,
  lastReadTime: Date.now(),
  visibleViews: 0,
  addMessage: (message) =>
    set((state) => {
      // Prevent duplicates
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }

      const isViewing = state.visibleViews > 0;
      return {
        messages: [...state.messages, message],
        unreadCount: isViewing ? state.unreadCount : state.unreadCount + 1,
      };
    }),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [], unreadCount: 0 }),
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0, lastReadTime: Date.now() }),
  setChatVisible: (visible) =>
    set((state) => {
      const newVisibleViews = Math.max(
        0,
        state.visibleViews + (visible ? 1 : -1),
      );
      return {
        visibleViews: newVisibleViews,
        unreadCount: newVisibleViews > 0 ? 0 : state.unreadCount,
      };
    }),
}));
