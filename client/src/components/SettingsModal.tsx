import { useState, useEffect, useRef } from "react";
import {
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
  Save,
  Dices,
  X,
  Zap,
  Volume2,
  VolumeX,
  Languages,
  User,
  Activity,
  Music,
} from "lucide-react";
import { useSocketStore } from "../stores/socketStore";
import {
  generateRandomUsername,
  generateSuffix,
  cleanName,
  useUserStore,
} from "../stores/userStore";
import useLanguage, { Language } from "../stores/languageStore";
import { getServerUrl, setServerUrl } from "../services/socket";
import { useAlertStore } from "../stores/alertStore";
import { useSettingsStore } from "../stores/settingsStore";
import Portal from "./Portal";
import SoundManager from "../utils/SoundManager";

export default function SettingsModal() {
  const { isConnected } = useSocketStore();
  const { username, setUsername } = useUserStore();
  const { show: showAlert } = useAlertStore();
  const { ti, ts, language, setLanguage } = useLanguage();
  const { enableGlassEffects, setEnableGlassEffects, setShowSettingsModal } =
    useSettingsStore();

  const [url, setUrl] = useState(getServerUrl());
  const [newUsername, setNewUsername] = useState("");
  const [previewUsername, setPreviewUsername] = useState("");
  const [volume, setVolume] = useState(SoundManager.getVolume() * 100);
  const [isMuted, setIsMuted] = useState(SoundManager.getMuted());

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

  // Update preview when newUsername changes
  useEffect(() => {
    if (newUsername.trim()) {
      setPreviewUsername(`${cleanName(newUsername)}${generateSuffix()}`);
    } else {
      setPreviewUsername("");
    }
  }, [newUsername]);

  const handleChangeUsername = () => {
    const trimmed = newUsername.trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 20) {
      showAlert(
        ts({
          en: "Username must be 2-20 characters",
          vi: "Tên phải từ 2-20 ký tự",
        }),
        { type: "error" },
      );
      return;
    }

    const finalUsername = `${cleanName(trimmed)}${generateSuffix()}`;
    setUsername(finalUsername);
    setNewUsername("");
    showAlert(
      ts({
        en: "Username updated. Reconnecting...",
        vi: "Đã cập nhật tên. Đang kết nối lại...",
      }),
      { type: "success" },
    );
    waitReConnectRef.current = true;
    window.location.reload();
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    SoundManager.setMuted(newMuted);
    if (!newMuted) SoundManager.playNotify();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    SoundManager.setVolume(newVolume / 100);
  };

  const testSound = () => {
    SoundManager.playNotify();
  };

  const onClose = () => setShowSettingsModal(false);

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/80 glass-blur flex items-center justify-center z-50 animate-fadeIn">
        <div className="relative bg-background-secondary border border-white/10 rounded-2xl flex flex-col max-w-md w-full shadow-2xl mx-4 animate-scaleIn max-h-[90vh] overflow-hidden">
          {/* Static Header Section */}
          <div className="px-6 pt-6 pb-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-primary" />
              <h2 className="font-display text-2xl text-text-primary">
                {ti({ en: "Settings", vi: "Cài đặt" })}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/15 rounded-lg text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <div className="space-y-8">
              {/* 1. Identity Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-display">
                  <User className="w-4 h-4" />
                  <span className="text-sm uppercase tracking-wider">
                    {ti({ en: "Identity", vi: "Danh tính" })}
                  </span>
                </div>
                <div className="space-y-4 bg-white/5 p-4 rounded-xl border border-white/5">
                  <div>
                    <div className="text-xs text-text-muted mb-1">
                      {ti({ en: "Current ID", vi: "ID Hiện tại" })}
                    </div>
                    <div className="text-md font-mono text-text-primary bg-black/20 p-2 rounded truncate border border-white/5">
                      {username}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) =>
                          setNewUsername(
                            e.target.value
                              .normalize("NFD")
                              .replace(/[\u0300-\u036f]/g, ""),
                          )
                        }
                        placeholder={ts({
                          en: "New username",
                          vi: "Nhập tên mới",
                        })}
                        maxLength={20}
                        className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary min-w-0 transition-all font-medium"
                      />
                      <button
                        onClick={handleChangeUsername}
                        disabled={
                          !newUsername.trim() || newUsername.trim().length < 2
                        }
                        className="px-3 py-2 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-lg shadow-primary/20 cursor-pointer"
                        title={ts({ en: "Save Username", vi: "Lưu tên" })}
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setNewUsername(
                            generateRandomUsername(undefined, false),
                          )
                        }
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-text-primary rounded-lg transition-all border border-white/10 cursor-pointer"
                      >
                        <Dices className="w-4 h-4" />
                      </button>
                    </div>

                    {previewUsername && (
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 animate-fadeIn">
                        <p className="text-[10px] text-primary/70 uppercase font-bold tracking-tight">
                          {ti({ en: "Preview:", vi: "Xem trước:" })}
                        </p>
                        <p className="text-sm font-bold font-mono text-primary truncate">
                          {previewUsername}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* 2. Audio Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-display">
                  <Music className="w-4 h-4" />
                  <span className="text-sm uppercase tracking-wider">
                    {ti({ en: "Audio", vi: "Âm thanh" })}
                  </span>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary font-medium">
                      {ti({ en: "Sound Effects", vi: "Hiệu ứng âm thanh" })}
                    </span>
                    <button
                      onClick={handleMuteToggle}
                      className={`p-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                        !isMuted
                          ? "bg-primary/20 text-primary"
                          : "bg-red-500/20 text-red-500"
                      }`}
                    >
                      {!isMuted ? (
                        <Volume2 className="w-5 h-5" />
                      ) : (
                        <VolumeX className="w-5 h-5" />
                      )}
                      <span className="text-xs font-bold w-8">
                        {!isMuted ? "ON" : "OFF"}
                      </span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>{ti({ en: "Volume", vi: "Âm lượng" })}</span>
                      <span>{volume}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={handleVolumeChange}
                        onMouseUp={testSound}
                        onTouchEnd={testSound}
                        disabled={isMuted}
                        className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                      <button
                        onClick={testSound}
                        disabled={isMuted}
                        className="p-1.5 hover:bg-white/10 rounded-md text-primary disabled:text-text-muted transition-colors"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Interface Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-display">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm uppercase tracking-wider">
                    {ti({ en: "Interface", vi: "Giao diện" })}
                  </span>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs text-text-muted mb-2 tracking-wide uppercase font-bold flex items-center gap-1.5">
                      <Languages className="w-3 h-3" />{" "}
                      {ti({ en: "Language", vi: "Ngôn ngữ" })}
                    </div>
                    <div className="flex gap-2">
                      {[
                        { value: Language.en, label: "🇺🇸 English" },
                        { value: Language.vi, label: "🇻🇳 Tiếng Việt" },
                      ].map((lang) => (
                        <button
                          key={lang.value}
                          onClick={() => setLanguage(lang.value)}
                          className={`flex-1 px-3 py-2 rounded-lg border transition-all text-sm font-medium cursor-pointer ${
                            language === lang.value
                              ? "bg-primary/20 border-primary/50 text-primary shadow-lg shadow-primary/10"
                              : "bg-white/5 border-white/5 text-text-secondary hover:bg-white/10"
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-px bg-white/5" />

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm text-text-primary font-medium">
                        {ti({ en: "Hi-Quality UI", vi: "Chất lượng cao" })}
                      </span>
                      <span className="text-[10px] text-text-muted leading-tight">
                        {ti({
                          en: "Glass effects & animations",
                          vi: "Hiệu ứng kính & chuyển động",
                        })}
                      </span>
                    </div>
                    <button
                      onClick={() => setEnableGlassEffects(!enableGlassEffects)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        enableGlassEffects
                          ? "bg-primary/20 border-primary/50 text-primary"
                          : "bg-white/5 border-white/5 text-text-muted hover:bg-white/10"
                      }`}
                    >
                      <Zap
                        className={`w-4 h-4 ${enableGlassEffects ? "fill-current" : ""}`}
                      />
                      <span className="text-xs font-bold">
                        {enableGlassEffects ? "ON" : "OFF"}
                      </span>
                    </button>
                  </div>
                </div>
              </section>

              {/* 4. Connection Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-display">
                  <Wifi className="w-4 h-4" />
                  <span className="text-sm uppercase tracking-wider">
                    {ti({ en: "Connection", vi: "Kết nối" })}
                  </span>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
                      />
                      <span className="text-sm font-medium text-text-primary">
                        {isConnected
                          ? ti({ en: "Connected", vi: "Đã kết nối" })
                          : ti({ en: "Disconnected", vi: "Mất kết nối" })}
                      </span>
                    </div>
                    {!isConnected ? (
                      <WifiOff className="w-4 h-4 text-red-500" />
                    ) : (
                      <Wifi className="w-4 h-4 text-green-500" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-text-muted font-bold uppercase tracking-wide">
                      {ti({ en: "Server URL", vi: "URL Server" })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="http://localhost:3001"
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
                      />
                      <button
                        onClick={handleSaveUrl}
                        className="p-2 bg-primary hover:bg-primary-light text-white rounded-lg transition-all cursor-pointer border border-primary/20"
                        title={ts({ en: "Save URL", vi: "Lưu URL" })}
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const defaultUrl = "https://game.fbaio.xyz";
                          setUrl(defaultUrl);
                          waitReConnectRef.current = true;
                          setServerUrl(defaultUrl);
                          showAlert(
                            ts({
                              en: "Resetting to default...",
                              vi: "Đang reset mặc định...",
                            }),
                            { type: "loading" },
                          );
                        }}
                        className="p-2 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-500 rounded-lg transition-all border border-yellow-500/10 cursor-pointer"
                        title={ts({
                          en: "Reset to Default",
                          vi: "Reset về mặc định",
                        })}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
