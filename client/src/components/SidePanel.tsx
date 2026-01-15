import { useState } from "react";
import { MessageSquare, Users } from "lucide-react";
import ChatPanel from "./ChatPanel";
import UserList from "./UserList";
import useLanguage from "../stores/languageStore";

export default function SidePanel() {
  const [activeTab, setActiveTab] = useState<"chat" | "users">("chat");
  const { ti } = useLanguage();

  return (
    <div className="flex flex-col h-full w-full bg-transparent">
      {/* Tabs Header */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
            activeTab === "chat"
              ? "text-primary"
              : "text-text-secondary hover:text-text-primary hover:bg-white/5"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          {ti({ en: "Chat", vi: "Chat" })}
          {activeTab === "chat" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
            activeTab === "users"
              ? "text-primary"
              : "text-text-secondary hover:text-text-primary hover:bg-white/5"
          }`}
        >
          <Users className="w-4 h-4" />
          {ti({ en: "Players", vi: "Người chơi" })}
          {activeTab === "users" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            activeTab === "chat"
              ? "opacity-100 z-10"
              : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <ChatPanel />
        </div>
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            activeTab === "users"
              ? "opacity-100 z-10"
              : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <UserList />
        </div>
      </div>
    </div>
  );
}
