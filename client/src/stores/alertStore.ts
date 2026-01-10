import { create } from "zustand";

interface AlertState {
  isOpen: boolean;
  message: string;
  type: "error" | "info" | "success" | "warning";
  title?: string;
  onConfirm?: () => void;
  show: (
    message: string,
    options?: {
      type?: "error" | "info" | "success" | "warning";
      title?: string;
      onConfirm?: () => void;
    }
  ) => void;
  hide: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  isOpen: false,
  message: "",
  type: "info",
  title: undefined,
  onConfirm: undefined,
  show: (message, options) =>
    set({
      isOpen: true,
      message,
      type: options?.type || "info",
      title: options?.title,
      onConfirm: options?.onConfirm,
    }),
  hide: () => set({ isOpen: false, message: "", onConfirm: undefined }),
}));
