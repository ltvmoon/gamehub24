import fs from "fs";
import path from "path";

const MODERATION_FILE = "data/moderation.json";

interface ModerationData {
  reports: Record<string, string[]>; // messageId -> userIds
  deleted: Record<string, boolean>; // messageId -> boolean
}

export class ModerationStore {
  private data: ModerationData = { reports: {}, deleted: {} };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(MODERATION_FILE)) {
        const content = fs.readFileSync(MODERATION_FILE, "utf-8");
        this.data = JSON.parse(content);
      } else {
        const dir = path.dirname(MODERATION_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        this.save();
      }
    } catch (e) {
      console.error("[ModerationStore] Error loading moderation data:", e);
    }
  }

  private save() {
    try {
      fs.writeFileSync(MODERATION_FILE, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error("[ModerationStore] Error saving moderation data:", e);
    }
  }

  reportMessage(messageId: string, userId: string) {
    if (!this.data.reports[messageId]) {
      this.data.reports[messageId] = [];
    }
    if (!this.data.reports[messageId].includes(userId)) {
      this.data.reports[messageId].push(userId);
      this.save();
      return true;
    }
    return false;
  }

  unreportMessage(messageId: string, userId: string) {
    if (this.data.reports[messageId]) {
      const index = this.data.reports[messageId].indexOf(userId);
      if (index !== -1) {
        this.data.reports[messageId].splice(index, 1);
        if (this.data.reports[messageId].length === 0) {
          delete this.data.reports[messageId];
        }
        this.save();
        return true;
      }
    }
    return false;
  }

  markDeleted(messageId: string, isDeleted: boolean) {
    if (isDeleted) {
      this.data.deleted[messageId] = true;
    } else {
      delete this.data.deleted[messageId];
    }
    this.save();
  }

  clearReports(messageId: string) {
    if (this.data.reports[messageId]) {
      delete this.data.reports[messageId];
      this.save();
      return true;
    }
    return false;
  }

  getModeration(messageId: string) {
    return {
      reports: this.data.reports[messageId] || [],
      isDeleted: this.data.deleted[messageId] || false,
    };
  }

  getAllReports() {
    return this.data.reports;
  }

  getAllDeleted() {
    return this.data.deleted;
  }
}

export const moderationStore = new ModerationStore();
