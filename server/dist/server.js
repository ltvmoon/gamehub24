"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const RoomManager_1 = require("./RoomManager");
const StatsManager_1 = require("./StatsManager");
const ChatPersistence_1 = require("./ChatPersistence");
const ModerationStore_1 = require("./ModerationStore");
const AdminRoutes_1 = require("./AdminRoutes");
const utils_1 = require("./utils");
dotenv_1.default.config();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const START_TIME = Date.now();
// Initialize Express
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: CLIENT_URL, credentials: true }));
app.use(express_1.default.json());
// Create HTTP server
const httpServer = (0, http_1.createServer)(app);
// Initialize Socket.IO
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: CLIENT_URL,
        methods: ["GET", "POST"],
        credentials: true,
    },
    transports: ["websocket", "polling", "webtransport"],
    pingInterval: 20000,
    pingTimeout: 180000,
    allowEIO3: true,
});
// Initialize managers
const roomManager = new RoomManager_1.RoomManager();
roomManager.loadState();
const chatHistory = new Map();
// Load last 20 messages from persistence for GLOBAL chat
const globalChatHistory = ChatPersistence_1.chatPersistence.getRecentMessages("global", 20);
const spamMap = new Map();
const SPAM_WINDOW_MS = 5000;
const MAX_MESSAGES_PER_WINDOW = 5;
// Generate a deterministic roomId for DM persistence using usernames
function getDmRoomId(userA, userB) {
    return "dm:" + [userA, userB].sort().join("_");
}
// Online users tracking for DM feature - Keyed by USERNAME
const onlineUsers = new Map();
function getOnlineUserList() {
    return Array.from(onlineUsers.entries()).map(([username, { userId }]) => ({
        userId,
        username,
    }));
}
function trackDataStats(roomId, size) {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.gameType)
        return;
    StatsManager_1.statsManager.trackDataTransfer(room.gameType, size);
}
// Cleanup spam map every 10 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [userId, userSpam] of spamMap.entries()) {
        // If user hasn't chatted in 1 minute, remove from map
        if (now - userSpam.lastMessageTime > 60000) {
            spamMap.delete(userId);
        }
    }
}, 10 * 60 * 1000);
// =============================================
// Room auto-cleanup: delete rooms with no connected sockets after 5 minutes
// =============================================
const ROOM_CLEANUP_INTERVAL_MS = 60 * 1000; // Check every 1 minute
const ROOM_EMPTY_TIMEOUT_MS = 5 * 60 * 1000; // Delete after 5 minutes empty
const emptyRoomTimestamps = new Map(); // roomId -> timestamp when first detected empty
setInterval(async () => {
    try {
        const allRooms = roomManager.getAllRooms();
        for (const room of allRooms) {
            // Check how many sockets are actually in this Socket.IO room
            const sockets = await io.in(room.id).fetchSockets();
            const connectedCount = sockets.length;
            if (connectedCount === 0) {
                // Room has no connected sockets
                if (!emptyRoomTimestamps.has(room.id)) {
                    // First time detecting empty, record timestamp
                    emptyRoomTimestamps.set(room.id, Date.now());
                    (0, utils_1.log)(`⏳ Room "${room.name}" (${room.id}) has no connected sockets, will auto-delete in 5 minutes`);
                }
                else {
                    // Check if it's been empty long enough
                    const emptyAt = emptyRoomTimestamps.get(room.id);
                    if (Date.now() - emptyAt >= ROOM_EMPTY_TIMEOUT_MS) {
                        // Delete the room
                        (0, utils_1.log)(`🗑️  Auto-deleting empty room "${room.name}" (${room.id}) — no connected sockets for 5 minutes`);
                        // Clean up all players/spectators from the room via RoomManager
                        for (const player of [...room.players, ...room.spectators]) {
                            roomManager.leaveRoom(player.id);
                        }
                        // If room still exists (e.g. leaveRoom didn't delete it), force delete
                        if (roomManager.getRoom(room.id)) {
                            // Force remove via leaveRoom of the owner
                            roomManager.leaveRoom(room.ownerId);
                        }
                        // Clean up chat history
                        chatHistory.delete(room.id);
                        emptyRoomTimestamps.delete(room.id);
                        // Broadcast updated room list
                        io.emit("room:list:update", roomManager.getPublicRooms());
                    }
                }
            }
            else {
                // Room has connected sockets, remove from empty tracking
                if (emptyRoomTimestamps.has(room.id)) {
                    (0, utils_1.log)(`✅ Room "${room.name}" (${room.id}) has active connections again, cancelling auto-delete`);
                    emptyRoomTimestamps.delete(room.id);
                }
            }
        }
    }
    catch (error) {
        console.error("Error during room auto-cleanup:", error);
    }
}, ROOM_CLEANUP_INTERVAL_MS);
// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// Admin Routes setup
(0, AdminRoutes_1.setupAdminRoutes)(app, roomManager, StatsManager_1.statsManager, ChatPersistence_1.chatPersistence, io, START_TIME, utils_1.formatUpTime);
// Socket.IO connection handler
io.on("connection", (socket) => {
    const { userId, username } = socket.handshake.auth;
    (0, utils_1.log)(`🟢 User connected: ${username} (${userId}) [${socket.id}]`);
    // Track online user (by username)
    onlineUsers.set(username, { userId, socketId: socket.id });
    io.emit("dm:user_joined", { userId, username });
    // Update socket ID if user reconnects
    roomManager.updatePlayerSocketId(userId, socket.id);
    // Check if user is in a room and rejoin if necessary
    const currentRoom = roomManager.getRoomByUserId(userId);
    if (currentRoom) {
        socket.join(currentRoom.id);
        (0, utils_1.log)(`🔄 User ${username} rejoined room ${currentRoom.id} (socket updated)`);
        // System message for rejoin
        const systemMessage = {
            id: (0, utils_1.uuidShort)(),
            roomId: currentRoom.id,
            userId: "system",
            username: "System",
            message: `${username} rejoined the game`,
            timestamp: Date.now(),
            type: "system",
            gameType: currentRoom.gameType,
        };
        io.to(currentRoom.id).emit("chat:message", systemMessage);
    }
    // heartbeat
    socket.on("heartbeat", () => { });
    // Get online users count
    socket.on("stats:online", (callback) => {
        try {
            callback?.({ online: io.engine.clientsCount });
        }
        catch (error) {
            console.error("Error getting online count:", error);
            callback?.({ online: 0 });
        }
    });
    // ROOM EVENTS
    // Create room
    socket.on("room:create", (data, callback) => {
        try {
            const room = roomManager.createRoom(data, userId, username, socket.id);
            socket.join(room.id);
            (0, utils_1.log)(`📦 Room created: ${room.name} (${room.id}) (game: ${data.gameType}) by ${username}`);
            if (data.gameType) {
                StatsManager_1.statsManager.trackPlay(data.gameType);
            }
            callback?.({ success: true, room });
            // Broadcast updated room list to all clients
            if (room.isPublic) {
                io.emit("room:list:update", roomManager.getPublicRooms());
            }
        }
        catch (error) {
            console.error("Error creating room:", error);
            callback?.({
                success: false,
                error: "Failed to create room: " + error.message,
            });
        }
    });
    // Join room
    socket.on("room:join", (data, callback) => {
        try {
            let result = roomManager.joinRoom(data.roomId, userId, username, socket.id, data.password);
            // If room not found, auto create
            if (!result.success &&
                result.error === "Room not found" &&
                // only allow auto join if user own this room
                data.roomId === username) {
                const savedSettings = roomManager.getRoomSettings(data.roomId);
                const room = roomManager.createRoom({
                    name: savedSettings?.name || data.roomId,
                    gameType: savedSettings?.gameType || "", // Use saved or default
                    isPublic: false,
                    maxPlayers: 10,
                }, userId, username, socket.id, data.roomId);
                result = { success: true, room };
                (0, utils_1.log)(`📦 Room auto-created: ${room.name} (${room.id}) by ${username} (using ${savedSettings ? "saved" : "default"} settings)`);
            }
            if (result.success && result.room) {
                socket.join(result.room.id);
                (0, utils_1.log)(`👤 ${username} joined room: ${result.room.name}`);
                // Send room data to joiner
                callback?.({ success: true, room: result.room });
                // Broadcast updated lists to room
                // io.to(data.roomId).emit("room:players", result.room.players);
                // io.to(data.roomId).emit("room:spectators", result.room.spectators);
                io.to(data.roomId).emit("room:update", result.room);
                // Send system message
                const systemMessage = {
                    id: (0, utils_1.uuidShort)(),
                    roomId: data.roomId,
                    userId: "system",
                    username: "System",
                    message: `${username} joined the room`,
                    timestamp: Date.now(),
                    type: "system",
                    gameType: result.room.gameType,
                };
                io.to(data.roomId).emit("chat:message", systemMessage);
                // Broadcast updated room list
                if (result.room.isPublic) {
                    io.emit("room:list:update", roomManager.getPublicRooms());
                }
            }
            else {
                callback?.({ success: false, error: result.error });
            }
        }
        catch (error) {
            console.error("Error joining room:", error);
            callback?.({
                success: false,
                error: "Failed to join room: " + error.message,
            });
        }
    });
    // Leave room
    socket.on("room:leave", (data) => {
        try {
            const result = roomManager.leaveRoom(userId);
            if (result.roomId) {
                socket.leave(result.roomId);
                (0, utils_1.log)(`👋 ${username} left room: ${result.roomId}`);
                if (result.room) {
                    // Room still exists, broadcast updated lists
                    // io.to(result.roomId).emit("room:players", result.room.players);
                    // io.to(result.roomId).emit("room:spectators", result.room.spectators);
                    io.to(result.roomId).emit("room:update", result.room);
                    // Send system message
                    const systemMessage = {
                        id: (0, utils_1.uuidShort)(),
                        roomId: result.roomId,
                        userId: "system",
                        username: "System",
                        message: `${username} left the room`,
                        timestamp: Date.now(),
                        type: "system",
                        gameType: result.room.gameType,
                    };
                    io.to(result.roomId).emit("chat:message", systemMessage);
                }
                else {
                    // Room was deleted, notify all
                    (0, utils_1.log)(`🗑️  Room deleted: ${result.roomId}`);
                    // Remove chat history
                    chatHistory.delete(result.roomId);
                    if (result.wasHost) {
                        io.to(result.roomId).emit("room:deleted", {
                            reason: "Host left the room",
                        });
                    }
                }
                // Broadcast updated room list
                if (result.room?.isPublic) {
                    io.emit("room:list:update", roomManager.getPublicRooms());
                }
            }
        }
        catch (error) {
            console.error("Error leaving room:", error);
        }
    });
    // Get room list
    socket.on("room:list", (callback) => {
        try {
            const rooms = roomManager.getPublicRooms();
            callback?.(rooms);
        }
        catch (error) {
            console.error("Error getting room list:", error);
            callback?.([]);
        }
    });
    // Update room (host only - e.g., change game type)
    socket.on("room:update", (data) => {
        try {
            const room = roomManager.getRoom(data.roomId);
            if (!room)
                return;
            // Only host can update room
            if (room.ownerId !== userId)
                return;
            // Update game type if provided
            if (data.gameType) {
                if (room.gameType !== data.gameType) {
                    StatsManager_1.statsManager.trackPlay(data.gameType);
                }
                room.gameType = data.gameType;
                (0, utils_1.log)(`🔄 Room ${room.name} game changed to: ${data.gameType}`);
                // Save updated settings
                roomManager.saveRoomSettings(data.roomId, {
                    gameType: room.gameType,
                    name: room.name,
                });
            }
            // Broadcast updated room to all players in the room
            io.to(data.roomId).emit("room:update", room);
            // Update public room list
            if (room.isPublic) {
                io.emit("room:list:update", roomManager.getPublicRooms());
            }
        }
        catch (error) {
            console.error("Error updating room:", error);
        }
    });
    // Host adds spectator to players
    socket.on("room:addPlayer", (data, callback) => {
        try {
            const room = roomManager.getRoom(data.roomId);
            if (!room)
                return callback?.({ success: false, error: "Room not found" });
            if (room.ownerId !== userId) {
                return callback?.({
                    success: false,
                    error: "Only host can add players",
                });
            }
            const result = roomManager.moveSpectatorToPlayer(data.roomId, data.userId);
            if (result.success && result.room) {
                // io.to(data.roomId).emit("room:players", result.room.players);
                // io.to(data.roomId).emit("room:spectators", result.room.spectators);
                io.to(data.roomId).emit("room:update", result.room);
                callback?.({ success: true });
                // Send system message
                const player = result.room.players.find((p) => p.id === data.userId);
                const systemMessage = {
                    id: (0, utils_1.uuidShort)(),
                    roomId: data.roomId,
                    userId: "system",
                    username: "System",
                    message: `${player?.username} joined the game`,
                    timestamp: Date.now(),
                    type: "system",
                };
                io.to(data.roomId).emit("chat:message", systemMessage);
            }
            else {
                callback?.({ success: false, error: result.error });
            }
        }
        catch (error) {
            console.error("Error adding player:", error);
            callback?.({ success: false, error: "Internal error" });
        }
    });
    // Host removes player to spectators
    socket.on("room:removePlayer", (data, callback) => {
        try {
            const room = roomManager.getRoom(data.roomId);
            if (!room)
                return callback?.({ success: false, error: "Room not found" });
            if (room.ownerId !== userId) {
                return callback?.({
                    success: false,
                    error: "Only host can remove players",
                });
            }
            const result = roomManager.movePlayerToSpectator(data.roomId, data.userId);
            if (result.success && result.room) {
                // io.to(data.roomId).emit("room:players", result.room.players);
                // io.to(data.roomId).emit("room:spectators", result.room.spectators);
                io.to(data.roomId).emit("room:update", result.room);
                callback?.({ success: true });
                // Send system message
                const spectator = result.room.spectators.find((p) => p.id === data.userId);
                const systemMessage = {
                    id: (0, utils_1.uuidShort)(),
                    roomId: data.roomId,
                    userId: "system",
                    username: "System",
                    message: `${spectator?.username} moved to spectators`,
                    timestamp: Date.now(),
                    type: "system",
                };
                io.to(data.roomId).emit("chat:message", systemMessage);
            }
            else {
                callback?.({ success: false, error: result.error });
            }
        }
        catch (error) {
            console.error("Error removing player:", error);
            callback?.({ success: false, error: "Internal error" });
        }
    });
    // Host kicks user
    socket.on("room:kick", (data, callback) => {
        try {
            const room = roomManager.getRoom(data.roomId);
            if (!room)
                return callback?.({ success: false, error: "Room not found" });
            if (room.ownerId !== userId) {
                return callback?.({
                    success: false,
                    error: "Only host can kick users",
                });
            }
            const kickedUserSocketId = room.players.find((p) => p.id === data.userId)?.socketId ||
                room.spectators.find((p) => p.id === data.userId)?.socketId;
            const result = roomManager.kickUser(data.roomId, data.userId);
            if (result.success && result.room) {
                // io.to(data.roomId).emit("room:players", result.room.players);
                // io.to(data.roomId).emit("room:spectators", result.room.spectators);
                io.to(data.roomId).emit("room:update", result.room);
                // Force kicked user to leave room
                if (kickedUserSocketId) {
                    const kickedSocket = io.sockets.sockets.get(kickedUserSocketId);
                    if (kickedSocket) {
                        kickedSocket.leave(data.roomId);
                        kickedSocket.emit("room:kicked", {
                            reason: "You were kicked by the host",
                        });
                    }
                }
                callback?.({ success: true });
                // Send system message
                const systemMessage = {
                    id: (0, utils_1.uuidShort)(),
                    roomId: data.roomId,
                    userId: "system",
                    username: "System",
                    message: `A user was kicked from the room`,
                    timestamp: Date.now(),
                    type: "system",
                };
                io.to(data.roomId).emit("chat:message", systemMessage);
            }
            else {
                callback?.({ success: false, error: result.error });
            }
        }
        catch (error) {
            console.error("Error kicking user:", error);
            callback?.({ success: false, error: "Internal error" });
        }
    });
    // GAME EVENTS (Pure relay)
    // Relay game actions
    socket.on("game:action", (data) => {
        const { json, size } = (0, utils_1.calculateSize)(data);
        (0, utils_1.log)(`game:action ${userId} -> ${data.roomId} (${(size / 1024).toFixed(2)} KB) ${json}\n\n`);
        trackDataStats(data.roomId, size);
        socket.to(data.roomId).emit("game:action", data);
    });
    // Relay game state
    socket.on("game:state", (data) => {
        const { json, size } = (0, utils_1.calculateSize)(data);
        (0, utils_1.log)(`game:state ${userId} -> ${data.roomId} (${(size / 1024).toFixed(2)} KB) ${json}\n\n`);
        trackDataStats(data.roomId, size);
        socket.to(data.roomId).emit("game:state", data);
    });
    // Relay game state patch
    socket.on("game:state:patch", (data) => {
        const { json, size } = (0, utils_1.calculateSize)(data);
        (0, utils_1.log)(`game:state:patch ${userId} -> ${data.roomId} (${(size / 1024).toFixed(2)} KB) ${json}\n\n`);
        trackDataStats(data.roomId, size);
        socket.to(data.roomId).emit("game:state:patch", data);
    });
    // Request sync (Relay to host, with requester socketId)
    socket.on("game:request_sync", (data) => {
        (0, utils_1.log)(`game:request_sync ${userId} -> ${data.roomId}`);
        // Determine host? The host is in the room.
        // Actually we can just broadcast to the room, the host will pick it up.
        // But we need to attach the requester's socket ID so the host knows who to reply to.
        socket.to(data.roomId).emit("game:request_sync", {
            roomId: data.roomId,
            targetUser: username,
            requesterSocketId: socket.id,
        });
    });
    // Direct state sync (Host -> Specific User)
    socket.on("game:state:direct", (data) => {
        const { json, size } = (0, utils_1.calculateSize)(data);
        (0, utils_1.log)(`game:state:direct ${data.roomId} -> ${data.targetUser || data.targetSocketId} (${(size / 1024).toFixed(2)} KB) ${json}\n\n`);
        trackDataStats(data.roomId, size);
        io.to(data.targetSocketId).emit("game:state", {
            roomId: data.roomId,
            state: data.state,
            version: data.version,
        });
    });
    // CHAT EVENTS
    // Send chat message
    socket.on("chat:message", (data) => {
        try {
            const room = roomManager.getRoom(data.roomId);
            const message = {
                ...data,
                id: (0, utils_1.uuidShort)(),
                timestamp: Date.now(),
                gameType: room?.gameType,
            };
            // Store in history
            if (!data.temp) {
                if (!chatHistory.has(data.roomId)) {
                    chatHistory.set(data.roomId, []);
                }
                const history = chatHistory.get(data.roomId);
                history.push(message);
                // Keep last 50 messages
                if (history.length > 50) {
                    history.shift();
                }
                // Persist room chat
                ChatPersistence_1.chatPersistence.saveMessage(message);
            }
            // Broadcast to room
            io.to(data.roomId).emit("chat:message", message);
        }
        catch (error) {
            console.error("Error sending chat message:", error);
        }
    });
    // Get chat history
    socket.on("chat:history", (data, callback) => {
        try {
            const history = chatHistory.get(data.roomId) || [];
            callback?.(history);
        }
        catch (error) {
            console.error("Error getting chat history:", error);
            callback?.([]);
        }
    });
    // Delete chat history - host only
    socket.on("chat:history:delete", (data) => {
        try {
            if (roomManager.getRoom(data.roomId)?.ownerId !== userId)
                return;
            chatHistory.delete(data.roomId);
            io.to(data.roomId).emit("chat:history:delete");
        }
        catch (error) {
            console.error("Error deleting chat history:", error);
        }
    });
    // GLOBAL CHAT EVENTS
    socket.on("global:chat", (data) => {
        try {
            const now = Date.now();
            const userSpam = spamMap.get(userId) || {
                count: 0,
                lastMessageTime: 0,
            };
            // Reset count if window passed
            if (now - userSpam.lastMessageTime > SPAM_WINDOW_MS) {
                userSpam.count = 0;
            }
            // Check limit
            if (userSpam.count >= MAX_MESSAGES_PER_WINDOW) {
                socket.emit("global:chat:error", {
                    message: "You are chatting too fast. Please slow down.",
                });
                return;
            }
            // Update spam tracker
            userSpam.count++;
            userSpam.lastMessageTime = now;
            spamMap.set(userId, userSpam);
            const message = {
                ...data,
                id: (0, utils_1.uuidShort)(),
                roomId: "global",
                timestamp: now,
                gameType: "global",
            };
            // Store in history
            globalChatHistory.push(message);
            if (globalChatHistory.length > 20) {
                globalChatHistory.shift();
            }
            // Persist to file
            ChatPersistence_1.chatPersistence.saveMessage(message);
            // Broadcast to all
            io.emit("global:chat", message);
        }
        catch (error) {
            console.error("Error sending global chat message:", error);
        }
    });
    socket.on("global:chat:report", (data) => {
        try {
            const { messageId } = data;
            if (!messageId)
                return;
            const updated = ModerationStore_1.moderationStore.reportMessage(messageId, userId);
            if (updated) {
                (0, utils_1.log)(`🚩 Message reported: ${messageId} by ${username}`);
                // Notify admins or broadcast moderation update if needed
                io.emit("global:chat:moderation", {
                    id: messageId,
                    ...ModerationStore_1.moderationStore.getModeration(messageId),
                });
            }
        }
        catch (error) {
            console.error("Error reporting message:", error);
        }
    });
    socket.on("global:chat:unreport", ({ messageId }) => {
        try {
            if (!messageId || !userId)
                return;
            const success = ModerationStore_1.moderationStore.unreportMessage(messageId, userId);
            if (success) {
                io.emit("global:chat:moderation", {
                    id: messageId,
                    ...ModerationStore_1.moderationStore.getModeration(messageId),
                });
            }
        }
        catch (error) {
            console.error("Error unreporting message:", error);
        }
    });
    socket.on("global:chat:history", (callback) => {
        const history = ChatPersistence_1.chatPersistence.getRecentMessages("global", 20);
        callback?.(history);
    });
    // DM EVENTS
    // Request online users list
    socket.on("dm:online_users", (callback) => {
        callback?.(getOnlineUserList());
    });
    // Send DM to specific user (by username)
    socket.on("dm:send", (data, callback) => {
        try {
            // Spam prevention (same as global chat)
            const now = Date.now();
            const userSpam = spamMap.get(userId) || {
                count: 0,
                lastMessageTime: 0,
            };
            if (now - userSpam.lastMessageTime > SPAM_WINDOW_MS) {
                userSpam.count = 0;
            }
            if (userSpam.count >= MAX_MESSAGES_PER_WINDOW) {
                return callback?.({
                    success: false,
                    error: "You are sending messages too fast. Please slow down.",
                });
            }
            userSpam.count++;
            userSpam.lastMessageTime = now;
            spamMap.set(userId, userSpam);
            const targetUser = onlineUsers.get(data.to);
            const dmMessage = {
                id: (0, utils_1.uuidShort)(),
                from: username,
                to: data.to,
                message: data.message.trim().slice(0, 500),
                timestamp: Date.now(),
            };
            // Persist DM to file
            const dmRoomId = getDmRoomId(username, data.to);
            ChatPersistence_1.chatPersistence.saveMessage({
                id: dmMessage.id,
                roomId: dmRoomId,
                userId: userId, // Keep original userId for record/auth if needed, but message structure uses usernames
                username: username,
                message: dmMessage.message,
                timestamp: dmMessage.timestamp,
                type: "user",
                gameType: "dm",
            });
            // Send to target user if online
            if (targetUser) {
                io.to(targetUser.socketId).emit("dm:receive", dmMessage);
            }
            // Echo back to sender for confirmation
            callback?.({ success: true, message: dmMessage });
        }
        catch (error) {
            console.error("Error sending DM:", error);
            callback?.({ success: false, error: "Failed to send message" });
        }
    });
    // Typing indicator
    socket.on("dm:typing", (data) => {
        const targetUser = onlineUsers.get(data.to);
        if (targetUser) {
            io.to(targetUser.socketId).emit("dm:typing", {
                from: username,
                isTyping: data.isTyping,
            });
        }
    });
    // DISCONNECT
    socket.on("disconnect", (reason) => {
        (0, utils_1.log)(`🔴 User disconnected: ${username} (${userId}) [${socket.id}]. Reason: ${reason}`);
        // Remove from online users and broadcast
        onlineUsers.delete(username);
        io.emit("dm:user_left", username);
        // Handle room cleanup
        const result = roomManager.leaveRoom(userId);
        if (result.roomId) {
            if (result.room) {
                io.to(result.roomId).emit("room:players", result.room.players);
                const systemMessage = {
                    id: (0, utils_1.uuidShort)(),
                    roomId: result.roomId,
                    userId: "system",
                    username: "System",
                    message: `${username} disconnected`,
                    timestamp: Date.now(),
                    type: "system",
                    gameType: result.room.gameType,
                };
                io.to(result.roomId).emit("chat:message", systemMessage);
            }
            else {
                // Room was deleted because host left/disconnected
                (0, utils_1.log)(`🗑️  Room deleted (host disconnected): ${result.roomId}`);
                // Delete chat for room
                chatHistory.delete(result.roomId);
                if (result.wasHost) {
                    io.to(result.roomId).emit("room:deleted", {
                        reason: "Host disconnected",
                    });
                }
            }
            // Broadcast updated room list
            if (result.room?.isPublic) {
                io.emit("room:list:update", roomManager.getPublicRooms());
            }
        }
    });
});
// Start server
httpServer.listen(PORT, () => {
    (0, utils_1.log)(`
  ╔═══════════════════════════════════════╗
  ║   🎮 Game Hub Server Running 🎮      ║
  ╠═══════════════════════════════════════╣
  ║  Port: ${PORT}                          ║
  ║  Environment: ${process.env.NODE_ENV || "development"}        ║
  ║  Client URL: ${CLIENT_URL}   ║
  ╚═══════════════════════════════════════╝
  `);
});
