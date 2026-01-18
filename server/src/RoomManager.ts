import type { Room, CreateRoomData } from "./types";

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRoomMap: Map<string, string> = new Map(); // userId -> roomId
  private roomSettings: Map<string, { gameType: string; name: string }> =
    new Map();

  getRoomSettings(roomId: string) {
    return this.roomSettings.get(roomId);
  }

  saveRoomSettings(
    roomId: string,
    settings: { gameType: string; name: string },
  ) {
    this.roomSettings.set(roomId, settings);
  }

  createRoom(
    data: CreateRoomData,
    userId: string,
    username: string,
    socketId: string,
    customRoomId?: string,
  ): Room {
    const roomId = customRoomId || username;

    // check if room already exists
    if (this.rooms.has(roomId)) {
      throw new Error(
        "Room name " + roomId + " already exists. Please choose another name.",
      );
    }

    const room: Room = {
      id: roomId,
      name: data.name,
      ownerId: userId,
      gameType: data.gameType,
      isPublic: data.isPublic,
      password: data.password,
      players: [
        {
          id: userId,
          username,
          isHost: true,
          socketId,
        },
      ],
      spectators: [],
      maxPlayers: data.maxPlayers,
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    this.playerRoomMap.set(userId, roomId);
    this.saveRoomSettings(roomId, {
      gameType: room.gameType,
      name: room.name,
    });

    console.log(
      `[RoomManager] Created room ${roomId} for user ${userId} (${username})`,
    );

    return room;
  }

  joinRoom(
    roomId: string,
    userId: string,
    username: string,
    socketId: string,
    password?: string,
  ): { success: boolean; room?: Room; error?: string } {
    const room = this.rooms.get(roomId);

    if (!room) {
      return { success: false, error: "Room not found" };
    }

    // Check password for private rooms
    if (!room.isPublic && room.password !== password) {
      return { success: false, error: "Incorrect password" };
    }

    // Check if player already in room (as player or spectator)
    if (
      room.players.some((p) => p.id === userId) ||
      room.spectators.some((p) => p.id === userId)
    ) {
      return { success: true, room };
    }

    // New logic: All joiners become spectators first (unless rejoining handled above)
    // We remove the "room is full" check for spectators, or maybe set a distinct limit?
    // For now, let's allow unlimited spectators or a high number.

    // Add player to spectators
    room.spectators.push({
      id: userId,
      username,
      isHost: false,
      socketId,
    });

    this.playerRoomMap.set(userId, roomId);

    console.log(
      `[RoomManager] User ${userId} (${username}) joined room ${roomId}`,
    );

    return { success: true, room };
  }

  leaveRoom(userId: string): {
    roomId?: string;
    room?: Room;
    wasHost: boolean;
  } {
    const roomId = this.playerRoomMap.get(userId);

    if (!roomId) {
      return { wasHost: false };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { wasHost: false };
    }

    const wasHost = room.ownerId === userId;

    // Remove player from room (check both lists)
    room.players = room.players.filter((p) => p.id !== userId);
    room.spectators = room.spectators.filter((p) => p.id !== userId);
    this.playerRoomMap.delete(userId);

    // If room is empty or host left, delete room
    if (room.players.length === 0 || wasHost) {
      this.rooms.delete(roomId);
      // Remove all players from this room
      room.players.forEach((p) => this.playerRoomMap.delete(p.id));
      room.spectators.forEach((p) => this.playerRoomMap.delete(p.id));
      // Remove all chats from room
      console.log(
        `[RoomManager] Deleted room ${roomId} (Host Left: ${wasHost}, Empty: ${
          room.players.length === 0
        })`,
      );
      return { roomId, wasHost };
    }

    // If host left but room not empty, assign new host
    // if (wasHost && room.players.length > 0) {
    //   room.players[0].isHost = true;
    //   room.ownerId = room.players[0].id;
    //   console.log(
    //     `[RoomManager] Reassigned host for room ${roomId} to ${room.players[0].username}`,
    //   );
    // }

    return { roomId, room, wasHost };
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getPublicRooms(): Room[] {
    return Array.from(this.rooms.values()).filter((room) => room.isPublic);
  }

  getRoomByUserId(userId: string): Room | undefined {
    const roomId = this.playerRoomMap.get(userId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  updatePlayerSocketId(userId: string, socketId: string): void {
    const roomId = this.playerRoomMap.get(userId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.find((p) => p.id === userId);
    if (player) {
      player.socketId = socketId;
    } else {
      const spectator = room.spectators.find((p) => p.id === userId);
      if (spectator) {
        spectator.socketId = socketId;
      }
    }
  }

  moveSpectatorToPlayer(
    roomId: string,
    userId: string,
  ): { success: boolean; room?: Room; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: "Room not found" };

    const spectatorIndex = room.spectators.findIndex((p) => p.id === userId);
    if (spectatorIndex === -1)
      return { success: false, error: "User is not a spectator" };

    if (room.players.length >= room.maxPlayers)
      return { success: false, error: "Room player slots are full" };

    const player = room.spectators[spectatorIndex];
    room.spectators.splice(spectatorIndex, 1);
    room.players.push(player);

    return { success: true, room };
  }

  movePlayerToSpectator(
    roomId: string,
    userId: string,
  ): { success: boolean; room?: Room; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: "Room not found" };

    const playerIndex = room.players.findIndex((p) => p.id === userId);
    if (playerIndex === -1)
      return { success: false, error: "User is not a player" };

    // Prevent removing the host (unless we handle host reassignment here, but simpler to block)
    if (room.players[playerIndex].id === room.ownerId) {
      return { success: false, error: "Cannot move host to spectators" };
    }

    const player = room.players[playerIndex];
    room.players.splice(playerIndex, 1);
    room.spectators.push(player);

    return { success: true, room };
  }

  kickUser(
    roomId: string,
    userId: string,
  ): { success: boolean; room?: Room; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: "Room not found" };

    // Cannot kick host
    if (userId === room.ownerId) {
      return { success: false, error: "Cannot kick host" };
    }

    // Check players
    const playerIndex = room.players.findIndex((p) => p.id === userId);
    if (playerIndex !== -1) {
      room.players.splice(playerIndex, 1);
      this.playerRoomMap.delete(userId);
      return { success: true, room };
    }

    // Check spectators
    const spectatorIndex = room.spectators.findIndex((p) => p.id === userId);
    if (spectatorIndex !== -1) {
      room.spectators.splice(spectatorIndex, 1);
      this.playerRoomMap.delete(userId);
      return { success: true, room };
    }

    return { success: false, error: "User not found in room" };
  }
}
