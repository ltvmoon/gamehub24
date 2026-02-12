"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAdminRoutes = setupAdminRoutes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ModerationStore_1 = require("./ModerationStore");
const utils_1 = require("./utils");
let DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "admin123";
// Brute-force protection for admin login
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
// Helper to get client IP
const getClientIp = (req) => {
    return (req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        "unknown");
};
// Admin authentication middleware
const adminAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${DASHBOARD_PASSWORD}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
};
function setupAdminRoutes(app, roomManager, statsManager, chatPersistence, io, startTime, formatUpTime) {
    // Admin Login
    app.post("/api/admin/login", (req, res) => {
        const ip = getClientIp(req);
        const { password } = req.body;
        const attempt = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
        // Check if blocked
        if (attempt.blockedUntil && Date.now() < attempt.blockedUntil) {
            const remaining = Math.ceil((attempt.blockedUntil - Date.now()) / 60000);
            return res.status(429).json({
                error: `Too many attempts. Blocked for ${remaining} more minutes.`,
            });
        }
        if (password === DASHBOARD_PASSWORD) {
            // Reset attempts on success
            loginAttempts.delete(ip);
            return res.json({ success: true, token: DASHBOARD_PASSWORD });
        }
        else {
            // Increment attempts on failure
            const now = Date.now();
            if (now - attempt.lastAttempt > ATTEMPT_WINDOW_MS) {
                attempt.count = 1;
            }
            else {
                attempt.count++;
            }
            attempt.lastAttempt = now;
            if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
                attempt.blockedUntil = now + BLOCK_DURATION_MS;
                loginAttempts.set(ip, attempt);
                return res
                    .status(429)
                    .json({ error: "Too many attempts. Blocked for 1 hour." });
            }
            loginAttempts.set(ip, attempt);
            res.status(401).json({ error: "Invalid password" });
        }
    });
    // Protect all /api/admin/* routes
    app.use("/api/admin", adminAuthMiddleware);
    // Admin Dashboard stats
    app.get("/api/admin/dashboard-stats", (req, res) => {
        try {
            const rooms = roomManager.getAllRooms();
            const serverStats = statsManager.getStats();
            const chatStats = chatPersistence.getDashboardStats();
            const result = {
                server: {
                    online: io.engine.clientsCount,
                    uptime: formatUpTime(Date.now() - startTime),
                    startTime: new Date(startTime).toISOString(),
                    memory: process.memoryUsage(),
                },
                rooms: rooms.map((r) => ({
                    id: r.id,
                    name: r.name,
                    gameType: r.gameType,
                    playerCount: r.players.length,
                    spectatorCount: r.spectators.length,
                    isPublic: r.isPublic,
                    password: r.password,
                    createdAt: new Date(r.createdAt).toISOString(),
                    ownerId: r.ownerId,
                })),
                stats: serverStats,
                chats: chatStats,
            };
            res.json(result);
        }
        catch (error) {
            console.error("Error generating dashboard stats:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
    // Admin Log Archive: Dates
    app.get("/api/admin/logs/dates", (req, res) => {
        try {
            const dates = chatPersistence.getLogDates();
            res.json(dates);
        }
        catch (error) {
            res.status(500).json({ error: "Internal server error" });
        }
    });
    // Admin Log Archive: Rooms for a date
    app.get("/api/admin/logs/rooms", (req, res) => {
        try {
            const { date } = req.query;
            if (!date || typeof date !== "string") {
                return res.status(400).json({ error: "Date parameter is required" });
            }
            const rooms = chatPersistence.getLogRooms(date);
            res.json(rooms);
        }
        catch (error) {
            res.status(500).json({ error: "Internal server error" });
        }
    });
    // Admin Log Archive: Messages for a room on a date
    app.get("/api/admin/logs/messages", (req, res) => {
        try {
            const { date, room } = req.query;
            if (!date ||
                !room ||
                typeof date !== "string" ||
                typeof room !== "string") {
                return res
                    .status(400)
                    .json({ error: "Date and room parameters are required" });
            }
            const messages = chatPersistence.getLogMessages(date, room, true);
            res.json(messages);
        }
        catch (error) {
            res.status(500).json({ error: "Internal server error" });
        }
    });
    // Admin Log Archive: Recent messages for a room (lazy loading)
    app.get("/api/admin/logs/recent-messages", (req, res) => {
        try {
            const { roomId, limit } = req.query;
            if (!roomId || typeof roomId !== "string") {
                return res.status(400).json({ error: "roomId parameter is required" });
            }
            const messages = chatPersistence.getRecentMessages(roomId, limit ? parseInt(limit) : 50, true);
            res.json(messages);
        }
        catch (error) {
            res.status(500).json({ error: "Internal server error" });
        }
    });
    // Admin Security: Change Password
    app.post("/api/admin/change-password", (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) {
                return res
                    .status(400)
                    .json({ error: "Current and new password are required" });
            }
            if (currentPassword !== DASHBOARD_PASSWORD) {
                return res.status(401).json({ error: "Incorrect current password" });
            }
            if (newPassword.length < 6) {
                return res
                    .status(400)
                    .json({ error: "New password must be at least 6 characters long" });
            }
            // Update in-memory password
            DASHBOARD_PASSWORD = newPassword;
            // Persist to .env
            const envPath = path_1.default.resolve(".env");
            let envContent = "";
            if (fs_1.default.existsSync(envPath)) {
                envContent = fs_1.default.readFileSync(envPath, "utf-8");
                const lines = envContent.split("\n");
                let found = false;
                const newLines = lines.map((line) => {
                    if (line.startsWith("DASHBOARD_PASSWORD=")) {
                        found = true;
                        return `DASHBOARD_PASSWORD=${newPassword}`;
                    }
                    return line;
                });
                if (!found) {
                    newLines.push(`DASHBOARD_PASSWORD=${newPassword}`);
                }
                envContent = newLines.join("\n");
            }
            else {
                envContent = `DASHBOARD_PASSWORD=${newPassword}\n`;
            }
            fs_1.default.writeFileSync(envPath, envContent);
            (0, utils_1.log)(`🔐 Dashboard password updated and persisted to .env`);
            res.json({ success: true, message: "Password updated successfully" });
        }
        catch (error) {
            console.error("Error changing dashboard password:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
    // Moderation: Get Reports
    app.get("/api/admin/moderation/reports", (req, res) => {
        try {
            const reports = ModerationStore_1.moderationStore.getAllReports();
            const deleted = ModerationStore_1.moderationStore.getAllDeleted();
            const reportedMessages = [];
            const monitoredIds = new Set([
                ...Object.keys(reports),
                ...Object.keys(deleted),
            ]);
            const dates = chatPersistence.getLogDates().slice(0, 7); // Last 7 days
            for (const date of dates) {
                const rooms = ["global"];
                for (const roomId of rooms) {
                    const msgs = chatPersistence.getLogMessages(date, roomId, true); // Include deleted
                    for (const msg of msgs) {
                        if (monitoredIds.has(msg.id)) {
                            reportedMessages.push({
                                ...msg,
                                ...ModerationStore_1.moderationStore.getModeration(msg.id),
                            });
                        }
                    }
                }
            }
            res.json(reportedMessages);
        }
        catch (error) {
            console.error("Error fetching moderation reports:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
    // Moderation: Take Action
    app.post("/api/admin/moderation/action", (req, res) => {
        try {
            const { messageId, action } = req.body;
            if (!messageId || !action) {
                return res.status(400).json({ error: "messageId and action required" });
            }
            if (action === "delete") {
                ModerationStore_1.moderationStore.markDeleted(messageId, true);
                (0, utils_1.log)(`🚫 Admin deleted message: ${messageId}`);
            }
            else if (action === "clear") {
                ModerationStore_1.moderationStore.clearReports(messageId);
                (0, utils_1.log)(`✅ Admin cleared reports for message: ${messageId}`);
            }
            else if (action === "restore") {
                ModerationStore_1.moderationStore.markDeleted(messageId, false);
                (0, utils_1.log)(`♻️ Admin restored message: ${messageId}`);
            }
            // Broadcast update to all clients
            io.emit("global:chat:moderation", {
                id: messageId,
                ...ModerationStore_1.moderationStore.getModeration(messageId),
            });
            res.json({ success: true });
        }
        catch (error) {
            console.error("Error taking moderation action:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
}
