import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "gamehub24_recent_games";
const MAX_RECENT_GAMES = 4;

export const useRecentlyPlayed = () => {
  const [recentGameIds, setRecentGameIds] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) {
          setRecentGameIds(ids);
        }
      } catch (e) {
        console.error("Failed to parse recent games from localStorage", e);
      }
    }
  }, []);

  const addRecentGame = useCallback((gameId: string) => {
    setRecentGameIds((prev) => {
      // Filter out if already exists, then prepend
      const filtered = prev.filter((id) => id !== gameId);
      const updated = [gameId, ...filtered].slice(0, MAX_RECENT_GAMES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { recentGameIds, addRecentGame };
};
