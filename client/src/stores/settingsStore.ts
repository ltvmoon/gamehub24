import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  showSettingsModal: boolean;
  setShowSettingsModal: (show: boolean) => void;
  enableGlassEffects: boolean;
  setEnableGlassEffects: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      showSettingsModal: false,
      setShowSettingsModal: (show) => set({ showSettingsModal: show }),
      enableGlassEffects: false,
      setEnableGlassEffects: (enabled) => set({ enableGlassEffects: enabled }),
    }),
    {
      name: "gamehub_settings",
      partialize: (state) => ({
        enableGlassEffects: state.enableGlassEffects,
      }),
    },
  ),
);
