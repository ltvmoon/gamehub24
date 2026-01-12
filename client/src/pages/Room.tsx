import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Crown,
  ArrowLeft,
  Gamepad,
  User,
  Share2,
  Copy,
  Check,
  X,
} from "lucide-react";
import { useRoomStore } from "../stores/roomStore";
import { useChatStore } from "../stores/chatStore";
import { useUserStore } from "../stores/userStore";
import { useAlertStore } from "../stores/alertStore";
import { getSocket } from "../services/socket";
import ChatPanel from "../components/ChatPanel";
import GameContainer from "../games/GameContainer";

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentRoom, setCurrentRoom, updatePlayers } = useRoomStore();
  const { clearMessages } = useChatStore();
  const { userId, username } = useUserStore();

  const { show: showAlert, confirm: showConfirm } = useAlertStore();
  const socket = getSocket();

  // Effect for joining room via direct URL
  useEffect(() => {
    if (!roomId) {
      navigate("/");
      return;
    }

    // Skip if already have room data for this room
    if (currentRoom?.id === roomId) {
      console.log("Already have room data, skipping join");
      return;
    }

    let isJoining = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const attemptJoin = () => {
      if (isJoining) return;
      isJoining = true;

      console.log("Attempting to join room:", roomId, "socket.id:", socket.id);

      // Set timeout to detect failed callback
      timeoutId = setTimeout(() => {
        console.log("Join timeout - callback never received");
        isJoining = false;
      }, 5000);

      socket.emit(
        "room:join",
        { roomId },
        (response: { success: boolean; room?: any; error?: string }) => {
          console.log("room:join response:", response);
          if (timeoutId) clearTimeout(timeoutId);

          if (response.success && response.room) {
            setCurrentRoom(response.room);
          } else {
            isJoining = false;
            showAlert(response.error || "Failed to join room", {
              type: "error",
            });
            navigate("/");
          }
        }
      );
    };

    const handleConnect = () => {
      console.log("Socket connected, will attempt join");
      // Small delay to ensure socket is fully ready
      setTimeout(attemptJoin, 100);
    };

    if (socket.connected) {
      attemptJoin();
    } else {
      console.log("Socket not connected, waiting...");
      socket.on("connect", handleConnect);
    }

    return () => {
      socket.off("connect", handleConnect);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [roomId, socket, navigate, setCurrentRoom]); // eslint-disable-next-line react-hooks/exhaustive-deps

  // Effect for room event listeners
  useEffect(() => {
    if (!roomId) return;

    socket.on("room:players", (players) => {
      updatePlayers(players);
    });

    socket.on("room:update", (room) => {
      setCurrentRoom(room);
    });

    socket.on("room:deleted", (data) => {
      showAlert(data.reason || "Room deleted by host", {
        type: "info",
        title: "Room Closed",
      });
      setCurrentRoom(null);
      clearMessages();
      navigate("/");
    });

    return () => {
      socket.off("room:players");
      socket.off("room:update");
      socket.off("room:deleted");
    };
  }, [roomId, socket, updatePlayers, setCurrentRoom, navigate, clearMessages]);

  const isHost = currentRoom?.ownerId === userId;
  const hostUser = currentRoom?.players.find(
    (p) => p.id === currentRoom.ownerId
  );

  const handleLeaveRoom = async () => {
    const confirmed = await showConfirm(
      isHost
        ? "Room will be deleted if you (host) leave"
        : "Are you sure want to leave this room",
      isHost ? "Close room?" : "Leave room?"
    );
    if (confirmed) {
      socket.emit("room:leave", { roomId });
      setCurrentRoom(null);
      clearMessages();
      navigate("/");
    }
  };

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showUserTooltip, setShowUserTooltip] = useState(false);
  const roomLink = `${window.location.origin}/#/room/${roomId}`;

  useEffect(() => {
    if (showUserTooltip) {
      const timeout = setTimeout(() => setShowUserTooltip(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [showUserTooltip]);

  const handleUserTouch = () => {
    setShowUserTooltip(true);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!currentRoom) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary">Loading room...</p>
        </div>
      </div>
    );
  }

  // Share Modal Component
  const ShareModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] animate-fadeIn">
      <div className="bg-background-secondary border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl mx-4 animate-scaleIn relative">
        <button
          onClick={() => setShowShareModal(false)}
          className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-lg transition-colors text-text-secondary"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="p-3 bg-white/5 rounded-full">
            <Share2 className="w-10 h-10 text-primary" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-display text-text-primary">
              Share Room
            </h3>
            <p className="text-text-secondary text-sm">
              Invite friends to join by sharing this link
            </p>
          </div>

          <div className="w-full space-y-3">
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
              <input
                type="text"
                value={roomLink}
                readOnly
                className="flex-1 bg-transparent text-text-primary text-sm outline-none"
              />
            </div>

            <button
              onClick={handleCopyLink}
              className={`w-full py-2.5 flex items-center justify-center gap-2 font-medium rounded-xl transition-all ${
                copied
                  ? "bg-green-600 text-white"
                  : "bg-primary hover:bg-primary-light text-white shadow-lg shadow-primary/20"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {showShareModal && <ShareModal />}
      <div className="min-h-screen bg-background-primary">
        {/* Room Header */}
        <header className="z-40 glass-card border-b border-white/10">
          <div className="max-w-7xl mx-auto px-3 md:px-4 py-3 md:py-4">
            <div className="flex items-center justify-between gap-2">
              {/* Left side: Back button + Room info */}
              <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
                <button
                  onClick={handleLeaveRoom}
                  className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                  aria-label="Leave room"
                >
                  <ArrowLeft className="w-5 h-5 text-text-secondary" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <h1 className="text-base md:text-xl font-display text-text-primary truncate">
                      {currentRoom.name}
                    </h1>
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="p-1 md:p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                      aria-label="Share room"
                      title="Share room link"
                    >
                      <Share2 className="w-4 h-4 text-text-secondary hover:text-primary" />
                    </button>
                  </div>
                  {/* Host info - hidden on mobile */}
                  {hostUser?.username != currentRoom.name && (
                    <div className="hidden md:flex items-center gap-2 text-sm">
                      <Crown className="w-4 h-4 text-text-muted" />
                      <span className="text-text-muted">
                        {hostUser?.username} {isHost ? "(You)" : ""}
                      </span>
                    </div>
                  )}
                  {/* Game type - visible on all screens */}
                  <div className="flex items-center gap-1.5 text-xs md:text-sm">
                    <Gamepad className="w-3.5 h-3.5 md:w-4 md:h-4 text-text-muted" />
                    <p className="text-text-muted capitalize">
                      {currentRoom.gameType}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right side: User info */}
              <div className="relative">
                <button
                  onClick={handleUserTouch}
                  onMouseEnter={handleUserTouch}
                  className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm flex-shrink-0 cursor-pointer hover:bg-white/10 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors"
                >
                  <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-text-muted" />
                  <span className="max-w-[80px] sm:max-w-none truncate">
                    {username}
                  </span>
                </button>
                {/* Tooltip */}
                {showUserTooltip && (
                  <div className="absolute right-0 top-full mt-1 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50 animate-fadeIn">
                    Your ID: <span className="font-semibold">{username}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-2 md:px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
            {/* Game Container */}
            <div className="glass-card rounded-2xl p-2 md:p-4">
              <GameContainer />
            </div>

            {/* Chat Panel */}
            <ChatPanel />
          </div>
        </main>
      </div>
    </>
  );
}
