import { type Weapon, WeaponType } from "./types";

// World Dimensions (Large Map)
export const WORLD_WIDTH = 15000;
export const WORLD_HEIGHT = 1000;

// Physics Constants
export const GRAVITY = 0.2;
export const MAX_POWER = 25;
export const MOVEMENT_SPEED = 2;
export const FUEL_CONSUMPTION = 1;
export const MAX_FUEL = 300;

// Tank Constants
export const INITIAL_HEALTH = 100;
export const TANK_WIDTH = 30;
export const TANK_HEIGHT = 20;

// Weapon Definitions
export const WEAPONS: Record<WeaponType, Weapon> = {
  [WeaponType.BASIC]: {
    type: WeaponType.BASIC,
    name: "Bazooka",
    damage: 25,
    radius: 40,
    color: "#38bdf8", // Neon Sky Blue
    count: 1,
    terrainDamageMultiplier: 1,
  },
  [WeaponType.SCATTER]: {
    type: WeaponType.SCATTER,
    name: "Shotgun",
    damage: 10,
    radius: 20,
    color: "#facc15", // Neon Yellow
    count: 3,
    spread: 10,
    terrainDamageMultiplier: 0.5,
  },
  [WeaponType.BARRAGE]: {
    type: WeaponType.BARRAGE,
    name: "Barrage",
    damage: 15,
    radius: 30,
    color: "#fb923c", // Orange
    count: 5,
    spread: 5,
    terrainDamageMultiplier: 0.8,
  },
  [WeaponType.DRILL]: {
    type: WeaponType.DRILL,
    name: "Digger",
    damage: 15,
    radius: 25, // Radius determines tunnel width
    color: "#a3e635", // Neon Lime
    count: 1,
    terrainDamageMultiplier: 1, // Handled via carveTunnel
  },
  [WeaponType.NUKE]: {
    type: WeaponType.NUKE,
    name: "Nuke",
    damage: 60,
    radius: 120,
    color: "#d946ef", // Neon Fuchsia
    count: 1,
    terrainDamageMultiplier: 1.5,
  },
  [WeaponType.HEAL]: {
    type: WeaponType.HEAL,
    name: "Medic",
    damage: 40, // Healing amount
    radius: 60,
    color: "#4ade80", // Green
    count: 1,
    terrainDamageMultiplier: 0,
  },
  [WeaponType.AIRSTRIKE]: {
    type: WeaponType.AIRSTRIKE,
    name: "Airstrike",
    damage: 0,
    radius: 10,
    color: "#ef4444",
    count: 1,
    terrainDamageMultiplier: 0,
  },
  [WeaponType.AIRSTRIKE_BOMB]: {
    // Internal
    type: WeaponType.AIRSTRIKE_BOMB,
    name: "Rain",
    damage: 20,
    radius: 30,
    color: "#ef4444",
    count: 1,
    terrainDamageMultiplier: 1,
  },
  [WeaponType.BUILDER]: {
    type: WeaponType.BUILDER,
    name: "Builder",
    damage: 0,
    radius: 50,
    color: "#60a5fa",
    count: 1,
    terrainDamageMultiplier: 0,
  },
  [WeaponType.TELEPORT]: {
    type: WeaponType.TELEPORT,
    name: "Teleport",
    damage: 0,
    radius: 20,
    color: "#c084fc",
    count: 1,
    terrainDamageMultiplier: 0,
  },
  [WeaponType.LANDMINE]: {
    type: WeaponType.LANDMINE,
    name: "Mine",
    damage: 50,
    radius: 15, // Size of the mine visually
    color: "#ef4444",
    count: 1,
    terrainDamageMultiplier: 0,
  },
  [WeaponType.LANDMINE_ARMED]: {
    // Internal
    type: WeaponType.LANDMINE_ARMED,
    name: "Mine (Armed)",
    damage: 80, // High damage on contact
    radius: 60, // Explosion radius
    color: "#ff0000",
    count: 1,
    terrainDamageMultiplier: 1,
  },
};

// Get user-selectable weapons (exclude internal types)
export const SELECTABLE_WEAPONS = Object.values(WEAPONS).filter(
  (w) =>
    w.type !== WeaponType.AIRSTRIKE_BOMB &&
    w.type !== WeaponType.LANDMINE_ARMED,
);

// Tank Colors
export const TANK_COLORS = {
  player1: "#3b82f6", // Blue
  player2: "#ef4444", // Red
};
