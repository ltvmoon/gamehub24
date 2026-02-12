"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.moderationStore = exports.ModerationStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const MODERATION_FILE = "data/moderation.json";
class ModerationStore {
    constructor() {
        this.data = { reports: {}, deleted: {} };
        this.load();
    }
    load() {
        try {
            if (fs_1.default.existsSync(MODERATION_FILE)) {
                const content = fs_1.default.readFileSync(MODERATION_FILE, "utf-8");
                this.data = JSON.parse(content);
            }
            else {
                const dir = path_1.default.dirname(MODERATION_FILE);
                if (!fs_1.default.existsSync(dir))
                    fs_1.default.mkdirSync(dir, { recursive: true });
                this.save();
            }
        }
        catch (e) {
            console.error("[ModerationStore] Error loading moderation data:", e);
        }
    }
    save() {
        try {
            fs_1.default.writeFileSync(MODERATION_FILE, JSON.stringify(this.data, null, 2));
        }
        catch (e) {
            console.error("[ModerationStore] Error saving moderation data:", e);
        }
    }
    reportMessage(messageId, userId) {
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
    unreportMessage(messageId, userId) {
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
    markDeleted(messageId, isDeleted) {
        if (isDeleted) {
            this.data.deleted[messageId] = true;
        }
        else {
            delete this.data.deleted[messageId];
        }
        this.save();
    }
    clearReports(messageId) {
        if (this.data.reports[messageId]) {
            delete this.data.reports[messageId];
            this.save();
            return true;
        }
        return false;
    }
    getModeration(messageId) {
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
exports.ModerationStore = ModerationStore;
exports.moderationStore = new ModerationStore();
