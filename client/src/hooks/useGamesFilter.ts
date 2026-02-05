import { useMemo } from "react";
import { getAllGames } from "../games/registry";
import { useGameFavorites } from "./useGameFavorites";
import { normalizeString } from "../utils/stringUtils";
import type { GameCategory } from "../constants";

export function useGamesFilter(
  searchQuery: string,
  selectedCategory: GameCategory | "favorites" | null,
) {
  const { favorites } = useGameFavorites();

  const gamesToShow = useMemo(() => {
    const normalizedQuery = normalizeString(searchQuery);
    return getAllGames().filter((game) => {
      // Category filter
      const categoryCondition = normalizedQuery
        ? true
        : selectedCategory === "favorites"
          ? favorites.includes(game.id)
          : selectedCategory
            ? game.categories.includes(selectedCategory)
            : true;

      if (!categoryCondition) return false;

      // Search filter
      if (!normalizedQuery) return true;

      const normalizedName = normalizeString(game.name.vi + game.name.en);
      const normalizedDesc = normalizeString(
        game.description.vi + game.description.en,
      );

      return (
        normalizedName.includes(normalizedQuery) ||
        normalizedDesc.includes(normalizedQuery)
      );
    });
  }, [selectedCategory, favorites, searchQuery]);

  return gamesToShow;
}
