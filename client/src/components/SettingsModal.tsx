import { useState, useEffect, useRef } from "react";
import { Settings, RefreshCw, Wifi, WifiOff, Save } from "lucide-react";
import { useSocketStore } from "../stores/socketStore";
import { useUserStore } from "../stores/userStore";
import useLanguage, { Language } from "../stores/languageStore";
import { getServerUrl, setServerUrl } from "../services/socket";
import { useAlertStore } from "../stores/alertStore";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { isConnected } = useSocketStore();
  const { generateNewId, userId, username } = useUserStore();
  const { show: showAlert, confirm: confirmAction } = useAlertStore();
  const { ti, ts, language, setLanguage } = useLanguage();

  const [url, setUrl] = useState(getServerUrl());
  const [isRegenerating, setIsRegenerating] = useState(false);

  const waitReConnectRef = useRef(false);

  useEffect(() => {
    if (waitReConnectRef.current && isConnected) {
      waitReConnectRef.current = false;
      showAlert(
        ts({ en: "Reconnected to server", vi: "Đã kết nối lại server" }),
        { type: "success" },
      );
    }
  }, [isConnected]);

  const handleSaveUrl = () => {
    try {
      if (!url.startsWith("http")) {
        showAlert(
          ts({
            en: "URL must start with http:// or https://",
            vi: "URL phải bắt đầu bằng http:// hoặc https://",
          }),
          { type: "error" },
        );
        return;
      }
      waitReConnectRef.current = true;
      setServerUrl(url);
      showAlert(
        ts({
          en: "Server URL updated. Reconnecting...",
          vi: "Đã cập nhật URL server. Đang kết nối lại...",
        }),
        { type: "loading" },
      );
    } catch (e) {
      showAlert(ts({ en: "Invalid URL", vi: "URL không hợp lệ" }), {
        type: "error",
      });
    }
  };

  const handleRegenerateIdentity = async () => {
    if (
      await confirmAction(
        ts({
          en: "Are you sure? This will generate a new random ID and username. The page will reload.",
          vi: "Bạn có chắc không? Điều này sẽ tạo ID và tên người dùng mới. Trang sẽ tải lại.",
        }),
        ts({ en: "Regenerate Identity", vi: "Tạo danh tính mới" }),
      )
    ) {
      setIsRegenerating(true);
      generateNewId();
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-background-secondary border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl mx-4 animate-scaleIn max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
          <Settings className="w-6 h-6 text-primary" />
          <h2 className="font-display text-2xl text-text-primary">
            {ti({ en: "Settings", vi: "Cài đặt" })}
          </h2>
        </div>

        <div className="space-y-6">
          {/* Language Switcher */}
          <div className="space-y-2">
            {/* <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {ti({ en: "Language", vi: "Ngôn ngữ" })}
            </label> */}
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage(Language.en)}
                className={`flex-1 px-4 py-2.5 rounded-lg border transition-all ${
                  language === Language.en
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10"
                }`}
              >
                🇺🇸 English
              </button>
              <button
                onClick={() => setLanguage(Language.vi)}
                className={`flex-1 px-4 py-2.5 rounded-lg border transition-all ${
                  language === Language.vi
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10"
                }`}
              >
                🇻🇳 Tiếng Việt
              </button>
            </div>
          </div>

          {/* Server URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              {ti({ en: "Server URL", vi: "URL Server" })}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:3001"
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary min-w-0"
              />
              <button
                onClick={handleSaveUrl}
                className="px-3 py-2 bg-primary hover:bg-primary-light text-white rounded-lg transition-colors"
                title={ts({ en: "Save URL", vi: "Lưu URL" })}
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setUrl("https://game.fbaio.xyz");
                  waitReConnectRef.current = true;
                  setServerUrl("https://game.fbaio.xyz");
                  showAlert(
                    ts({
                      en: "Reset to default server. Reconnecting...",
                      vi: "Đã reset về server mặc định. Đang kết nối lại...",
                    }),
                    {
                      type: "loading",
                    },
                  );
                }}
                className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors"
                title={ts({ en: "Reset to Default", vi: "Reset về mặc định" })}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Connection Status */}
          <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary">
              {ti({ en: "Status", vi: "Trạng thái" })}
            </span>
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isConnected
                  ? "bg-green-500/20 text-green-500 border border-green-500/30"
                  : "bg-red-500/20 text-red-500 border border-red-500/30"
              }`}
            >
              {isConnected ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              {isConnected
                ? ti({ en: "Connected", vi: "Đã kết nối" })
                : ti({ en: "Disconnected", vi: "Mất kết nối" })}
            </div>
          </div>

          <div className="h-px bg-white/10 my-4" />

          {/* Identity */}
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-text-secondary mb-1">
                {ti({ en: "Your Identity", vi: "Danh tính của bạn" })}
              </div>
              <div className="text-xs text-text-muted break-all font-mono bg-black/20 p-2 rounded">
                ID: {userId}
              </div>
              <div className="text-xs text-text-muted mt-1 font-mono bg-black/20 p-2 rounded">
                {ti({ en: "Username", vi: "Tên người dùng" })}: {username}
              </div>
            </div>

            <button
              onClick={handleRegenerateIdentity}
              disabled={isRegenerating}
              className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl transition-all flex items-center justify-center gap-2 font-medium"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`}
              />
              {ti({ en: "Generate New Identity", vi: "Tạo danh tính mới" })}
            </button>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            {ti({ en: "Close", vi: "Đóng" })}
          </button>
        </div>
      </div>
    </div>
  );
}
