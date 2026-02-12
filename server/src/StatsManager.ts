import fs from "fs";
import path from "path";

interface GameStats {
  plays: Record<string, number>;
  dataTransfer: Record<string, number>;
  daily: Record<
    string,
    {
      plays: Record<string, number>;
      dataTransfer: Record<string, number>;
    }
  >;
}

export class StatsManager {
  private readonly STATS_FILE = path.resolve("data", "stats.json");
  private gameStats: GameStats = {
    plays: {},
    dataTransfer: {},
    daily: {},
  };

  private stateChanged: boolean = false;

  constructor() {
    this.loadStats();
    setInterval(() => {
      if (this.stateChanged) {
        this.saveStats();
        this.stateChanged = false;
      }
    }, 30000); // Check every 30 seconds
  }

  private loadStats() {
    try {
      const dir = path.dirname(this.STATS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.STATS_FILE)) {
        const data = fs.readFileSync(this.STATS_FILE, "utf-8");
        this.gameStats = JSON.parse(data);
        if (!this.gameStats.daily) {
          this.gameStats.daily = {};
        }
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  private saveStats() {
    try {
      fs.writeFileSync(
        this.STATS_FILE,
        JSON.stringify(this.gameStats, null, 2),
      );
    } catch (error) {
      console.error("Error saving stats:", error);
    }
  }

  private getTodayKey() {
    const today = new Date();
    return today.toISOString().split("T")[0]; // YYYY-MM-DD
  }

  private ensureDailyKey(dateKey: string) {
    if (!this.gameStats.daily[dateKey]) {
      this.gameStats.daily[dateKey] = {
        plays: {},
        dataTransfer: {},
      };
    }
  }

  public trackPlay(gameType: string) {
    if (!gameType) return;
    this.gameStats.plays[gameType] = (this.gameStats.plays[gameType] || 0) + 1;

    const today = this.getTodayKey();
    this.ensureDailyKey(today);
    this.gameStats.daily[today].plays[gameType] =
      (this.gameStats.daily[today].plays[gameType] || 0) + 1;

    this.stateChanged = true;
  }

  public trackDataTransfer(gameType: string, size: number) {
    if (!gameType) return;
    this.gameStats.dataTransfer[gameType] =
      (this.gameStats.dataTransfer[gameType] || 0) + size;

    const today = this.getTodayKey();
    this.ensureDailyKey(today);
    this.gameStats.daily[today].dataTransfer[gameType] =
      (this.gameStats.daily[today].dataTransfer[gameType] || 0) + size;

    this.stateChanged = true;
  }

  public getStats() {
    return this.gameStats;
  }
}

export const statsManager = new StatsManager();
