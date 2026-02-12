"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatPersistence = exports.ChatPersistence = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
const ModerationStore_1 = require("./ModerationStore");
const DATA_DIR = "data/chats";
class ChatPersistence {
    constructor() {
        this.buffer = [];
        // Ensure base data dir exists
        const dirPath = path_1.default.resolve(DATA_DIR);
        if (!fs_1.default.existsSync(dirPath)) {
            fs_1.default.mkdirSync(dirPath, { recursive: true });
        }
        // Flush buffer every 5 seconds
        setInterval(() => {
            this.flush();
        }, 5000);
    }
    getRefDate(timestamp) {
        const date = timestamp ? new Date(timestamp) : new Date();
        return date.toISOString().split("T")[0]; // YYYY-MM-DD
    }
    getFilePath(roomId, dateStr) {
        // Sanitize roomId
        const safeRoomId = roomId.replace(/[^a-zA-Z0-9\-_]/g, "_");
        const fileName = (safeRoomId || "unknown") + ".jsonl";
        return path_1.default.resolve(DATA_DIR, dateStr, fileName);
    }
    ensureDateDir(dateStr) {
        const dirPath = path_1.default.resolve(DATA_DIR, dateStr);
        if (!fs_1.default.existsSync(dirPath)) {
            fs_1.default.mkdirSync(dirPath, { recursive: true });
        }
    }
    saveMessage(message) {
        this.buffer.push(message);
    }
    flush() {
        if (this.buffer.length === 0)
            return;
        const messagesToSave = [...this.buffer];
        this.buffer = [];
        // Group messages by file path to minimize file opens
        const messagesByFile = new Map();
        for (const message of messagesToSave) {
            try {
                const dateStr = this.getRefDate(message.timestamp);
                this.ensureDateDir(dateStr);
                const filePath = this.getFilePath(message.roomId, dateStr);
                if (!messagesByFile.has(filePath)) {
                    messagesByFile.set(filePath, []);
                }
                const line = JSON.stringify(message) + "\n";
                messagesByFile.get(filePath).push(line);
            }
            catch (error) {
                console.error(`[ChatPersistence] Error preparing message for room ${message.roomId}:`, error);
            }
        }
        // Write to files
        for (const [filePath, lines] of messagesByFile.entries()) {
            try {
                fs_1.default.appendFileSync(filePath, lines.join(""), "utf-8");
                (0, utils_1.log)(`[ChatPersistence] Wrote ${lines.length} messages to ${filePath}`);
            }
            catch (error) {
                console.error(`[ChatPersistence] Error writing to file ${filePath}:`, error);
            }
        }
    }
    getRecentMessages(roomId, limit = 20, includeDeleted = false) {
        try {
            const allMessages = [];
            // Get all date directories, sorted newest first
            if (!fs_1.default.existsSync(path_1.default.resolve(DATA_DIR))) {
                return [];
            }
            const dateDirs = fs_1.default
                .readdirSync(path_1.default.resolve(DATA_DIR))
                .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name)) // Simple YYYY-MM-DD check
                .sort()
                .reverse();
            for (const dateStr of dateDirs) {
                if (allMessages.length >= limit)
                    break;
                const filePath = this.getFilePath(roomId, dateStr);
                if (fs_1.default.existsSync(filePath)) {
                    const fileContent = fs_1.default.readFileSync(filePath, "utf-8");
                    const lines = fileContent.split("\n").filter((line) => line.trim());
                    // Parse messages from this file
                    const msgsInFile = lines
                        .map((line) => {
                        try {
                            return JSON.parse(line);
                        }
                        catch {
                            return null;
                        }
                    })
                        .filter((msg) => msg !== null)
                        .map((msg) => ({
                        ...msg,
                        ...ModerationStore_1.moderationStore.getModeration(msg.id),
                    }))
                        .filter((msg) => includeDeleted || !msg.isDeleted); // Filter out deleted messages unless requested
                    // We need the NEWEST messages.
                    // Reverse messages from file so [0] is newest in that file
                    msgsInFile.reverse();
                    for (const msg of msgsInFile) {
                        if (allMessages.length < limit) {
                            allMessages.push(msg);
                        }
                        else {
                            break;
                        }
                    }
                }
            }
            // result is [Newest -> Oldest]
            // The caller expects chronological order (Oldest -> Newest)
            return allMessages.reverse();
        }
        catch (error) {
            console.error(`[ChatPersistence] Error loading messages for room ${roomId}:`, error);
            return [];
        }
    }
    getDashboardStats() {
        try {
            const stats = {
                totalMessages: 0,
                messagesByDate: {},
                messagesByRoom: {},
                messagesByUser: {},
                rooms: {},
                lastSynced: new Date().toISOString(),
            };
            if (!fs_1.default.existsSync(path_1.default.resolve(DATA_DIR))) {
                return stats;
            }
            const dateDirs = fs_1.default
                .readdirSync(path_1.default.resolve(DATA_DIR))
                .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
                .sort()
                .reverse();
            for (const dateStr of dateDirs) {
                const datePath = path_1.default.resolve(DATA_DIR, dateStr);
                const files = fs_1.default
                    .readdirSync(datePath)
                    .filter((f) => f.endsWith(".jsonl"));
                for (const file of files) {
                    const filePath = path_1.default.join(datePath, file);
                    const roomId = file.replace(".jsonl", "");
                    const content = fs_1.default.readFileSync(filePath, "utf-8");
                    const lines = content.split("\n").filter((l) => l.trim());
                    if (lines.length === 0)
                        continue;
                    stats.totalMessages += lines.length;
                    stats.messagesByDate[dateStr] =
                        (stats.messagesByDate[dateStr] || 0) + lines.length;
                    stats.messagesByRoom[roomId] =
                        (stats.messagesByRoom[roomId] || 0) + lines.length;
                    // Process the last message for the room summary (only if not already set by a newer date)
                    if (!stats.rooms[roomId]) {
                        try {
                            const lastLine = lines[lines.length - 1];
                            const lastMsg = JSON.parse(lastLine);
                            stats.rooms[roomId] = {
                                lastMessage: lastMsg,
                                count: stats.messagesByRoom[roomId],
                            };
                        }
                        catch (e) {
                            // skip
                        }
                    }
                    else {
                        // Update total count if we found more in an older folder
                        stats.rooms[roomId].count = stats.messagesByRoom[roomId];
                    }
                    // Update user frequency (sampled/partial if needed, but here simple)
                    for (const line of lines) {
                        try {
                            const msg = JSON.parse(line);
                            if (msg.username) {
                                stats.messagesByUser[msg.username] =
                                    (stats.messagesByUser[msg.username] || 0) + 1;
                            }
                        }
                        catch (e) {
                            /* skip */
                        }
                    }
                }
            }
            return stats;
        }
        catch (error) {
            console.error("[ChatPersistence] Error generating dashboard stats:", error);
            return {
                totalMessages: 0,
                messagesByDate: {},
                messagesByRoom: {},
                messagesByUser: {},
                rooms: {},
                lastSynced: new Date().toISOString(),
            };
        }
    }
    getLogDates() {
        try {
            const dirPath = path_1.default.resolve(DATA_DIR);
            if (!fs_1.default.existsSync(dirPath))
                return [];
            return fs_1.default
                .readdirSync(dirPath)
                .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
                .sort()
                .reverse();
        }
        catch (error) {
            console.error("[ChatPersistence] Error getting log dates:", error);
            return [];
        }
    }
    getLogRooms(dateStr) {
        try {
            const dirPath = path_1.default.resolve(DATA_DIR, dateStr);
            if (!fs_1.default.existsSync(dirPath))
                return [];
            return fs_1.default
                .readdirSync(dirPath)
                .filter((f) => f.endsWith(".jsonl"))
                .map((f) => {
                const roomId = f.replace(".jsonl", "");
                const filePath = path_1.default.join(dirPath, f);
                // Simple line count for .jsonl
                const content = fs_1.default.readFileSync(filePath, "utf-8");
                const count = content.split("\n").filter((l) => l.trim()).length;
                return { id: roomId, count };
            });
        }
        catch (error) {
            console.error("[ChatPersistence] Error getting log rooms:", error);
            return [];
        }
    }
    getLogMessages(dateStr, roomId, includeDeleted = false) {
        try {
            const filePath = this.getFilePath(roomId, dateStr);
            if (!fs_1.default.existsSync(filePath))
                return [];
            const fileContent = fs_1.default.readFileSync(filePath, "utf-8");
            return fileContent
                .split("\n")
                .filter((line) => line.trim())
                .map((line) => {
                try {
                    return JSON.parse(line);
                }
                catch {
                    return null;
                }
            })
                .filter((msg) => msg !== null)
                .map((msg) => ({
                ...msg,
                ...ModerationStore_1.moderationStore.getModeration(msg.id),
            }))
                .filter((msg) => includeDeleted || !msg.isDeleted);
        }
        catch (error) {
            console.error("[ChatPersistence] Error getting log messages:", error);
            return [];
        }
    }
}
exports.ChatPersistence = ChatPersistence;
exports.chatPersistence = new ChatPersistence();
