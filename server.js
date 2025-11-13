import React, { useState, useMemo, useEffect, useRef } from "react";

// KNCHAT — Üyelik + gerçek zamanlı mesaj + gerçek zamanlı online kullanıcı listesi
// Bu dosyayı Vite + React + Tailwind kurulu projede src/KankaChat.jsx olarak kullan.
// App.jsx içinde: <KankaChat socket={socket} /> şeklinde kullanıyorsun.

// --- Demo veriler (sunucu/kanal yapısı) ---
const SAMPLE_SERVERS = [
  { id: "genel", name: "Genel" },
  { id: "oyun", name: "Oyun" },
];

const SAMPLE_CHANNELS = {
  genel: [
    { id: "genel-1", name: "#genel" },
    { id: "genel-2", name: "#duyurular" },
  ],
  oyun: [
    { id: "oyun-1", name: "#oyun-sohbet" },
    { id: "oyun-2", name: "#party-arat" },
  ],
};

const STATUS_COLORS = {
  online: "bg-emerald-500",
  idle: "bg-amber-400",
  dnd: "bg-rose-500",
};

const EMOJI_LIST = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😉",
  "😍",
  "😎",
  "😭",
  "😡",
  "👍",
  "👎",
  "🔥",
  "💀",
  "❤️",
  "💙",
  "💚",
  "🎮",
  "🎧",
  "📎",
];

// --- Storage yardımcıları ---
const STORAGE_KEYS = {
  authUser: "knchat_auth_user",
  messages: "knchat_messages_v1",
  drafts: "knchat_drafts_v1",
  attachments: "knchat_attachments_v1",
  ui: "knchat_ui_v1",
};

function safeLoad(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function safeSave(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessiz geç
  }
}

// --- Yardımcı fonksiyonlar ---
function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + " KB";
  const mb = kb / 1024;
  return mb.toFixed(1) + " MB";
}

function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

// E-posta kuralı
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// --- Küçük UI parçaları ---
function ServerAvatar({ server, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-800 text-[10px] font-semibold text-slate-100 shadow transition-all hover:rounded-2xl hover:bg-indigo-500/80 ${
        active ? "rounded-2xl ring-2 ring-indigo-400" : ""
      }`}
      title={server.name}
    >
      <span className="truncate px-1 uppercase tracking-tight">
        {server.name}
      </span>
    </button>
  );
}

function ChannelButton({ channel, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition hover:bg-slate-700/60 hover:text-slate-50 ${
        active ? "bg-slate-700 text-slate-50" : "text-slate-300"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className="text-slate-500 group-hover:text-slate-300">#</span>
        <span className="truncate">{channel.name.replace("#", "")}</span>
      </span>
    </button>
  );
}

function MessageBubble({ msg }) {
  return (
    <div className="flex flex-col gap-1 px-3 py-1 hover:bg-slate-800/60">
      <div className="flex gap-3">
        <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-center text-sm font-bold text-white">
          {msg.author?.[0]?.toUpperCase()}
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="font-semibold text-slate-100">{msg.author}</span>
            <span className="text-xs text-slate-500">{msg.time}</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-200">
            {msg.text}
          </p>
        </div>
      </div>
      {msg.attachments && msg.attachments.length > 0 && (
        <div className="ml-12 mt-1 flex flex-wrap gap-1">
          {msg.attachments.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-1 rounded-full bg-slate-800/90 px-2 py-0.5 text-[11px] text-slate-100"
            >
              <span>📎</span>
              <span className="max-w-[140px] truncate">{file.name}</span>
              {file.size != null && (
                <span className="text-slate-400">
                  ({formatFileSize(file.size)})
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserBadge({ user }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-slate-800/70 px-3 py-2 text-sm text-slate-100">
      <div className="flex items-center gap-2">
        <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold">
          {user.name?.[0]?.toUpperCase()}
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${
              STATUS_COLORS[user.status || "online"] || STATUS_COLORS.online
            }`}
          />
        </div>
        <span className="max-w-[120px] truncate">{user.name}</span>
      </div>
      <span className="text-[11px] uppercase tracking-wide text-slate-400">
        {user.status || "online"}
      </span>
    </div>
  );
}

function VoiceCard({
  inVoice,
  muted,
  seconds,
  onToggleVoice,
  onToggleMute,
  error,
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-200">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-100">Sesli Oda</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            inVoice
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-slate-800 text-slate-200"
          }`}
        >
          {inVoice ? `Bağlı • ${formatDuration(seconds)}` : "Bağlan"}
        </span>
      </div>
      {error && <p className="mt-1 text-[11px] text-rose-400">{error}</p>}
      <div className="mt-2 flex gap-2 text-[11px] text-slate-300">
        <button
          className={`flex-1 rounded-md px-2 py-1 ${
            inVoice
              ? "bg-rose-600 text-white hover:bg-rose-500"
              : "bg-slate-800 text-slate-100 hover:bg-slate-700"
          }`}
          onClick={onToggleVoice}
        >
          {inVoice ? "Sesten Ayrıl" : "Sese Katıl"}
        </button>
        <button
          className="flex-1 rounded-md bg-slate-800 px-2 py-1 hover:bg-slate-700 disabled:opacity-40"
          onClick={onToggleMute}
          disabled={!inVoice}
        >
          {muted ? "Mikrofon Aç" : "Mikrofon Kapat"}
        </button>
      </div>
    </div>
  );
}

function ChannelHeader({ serverName, channelName }) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-4 backdrop-blur">
      <div className="flex items-center gap-2 text-sm text-slate-100">
        <span className="text-slate-500">#</span>
        <span className="font-semibold">{channelName.replace("#", "")}</span>
        <span className="ml-2 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300">
          {serverName}
        </span>
      </div>
    </div>
  );
}

function InputBar({
  value,
  onChange,
  onSend,
  disabled,
  attachments,
  onAttachFiles,
  onClearAttachments,
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() || (attachments && attachments.length > 0)) onSend();
    }
  };

  const handleEmojiClick = (emoji) => {
    if (disabled) return;
    onChange((value || "") + emoji);
  };

  const handleFileButton = () => {
    if (disabled) return;
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onAttachFiles(e.target.files);
      e.target.value = "";
    }
  };

  return (
    <div className="border-t border-slate-800/80 bg-slate-900/95 px-3 py-3">
      <div className="relative flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            title="Emoji"
            disabled={disabled}
            onClick={() => setShowEmoji((s) => !s)}
          >
            😊
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            title="Dosya ekle"
            disabled={disabled}
            onClick={handleFileButton}
          >
            📎
          </button>
          <input
            type="file"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <div className="flex-1 rounded-2xl bg-slate-900/90 ring-1 ring-slate-700/70 focus-within:ring-indigo-500">
            <textarea
              rows={1}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? "Kanal seçilmedi" : "Mesaj yaz"}
              className="max-h-32 min-h-[40px] w-full resize-none rounded-2xl bg-transparent px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed"
              disabled={disabled}
            />
          </div>
          <button
            type="button"
            onClick={onSend}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700"
            disabled={
              (!value.trim() && (!attachments || attachments.length === 0)) ||
              disabled
            }
          >
            ➤
          </button>
        </div>

        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-slate-900/90 px-3 py-2 text-[11px] text-slate-100">
            <span className="mr-1 text-slate-400">Ekler:</span>
            {attachments.map((file) => (
              <span
                key={file.id}
                className="flex items-center gap-1 rounded-full bg-slate-800/90 px-2 py-0.5"
              >
                <span>📎</span>
                <span className="max-w-[120px] truncate">{file.name}</span>
                {file.size != null && (
                  <span className="text-slate-400">
                    {formatFileSize(file.size)}
                  </span>
                )}
              </span>
            ))}
            <button
              type="button"
              onClick={onClearAttachments}
              className="ml-auto text-[10px] text-slate-400 hover:text-slate-200"
            >
              Temizle
            </button>
          </div>
        )}

        {showEmoji && !disabled && (
          <div className="absolute -top-40 left-0 z-20 w-64 rounded-2xl border border-slate-700 bg-slate-900/95 p-2 text-base shadow-lg">
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
              <span>Emoji</span>
              <button
                type="button"
                className="rounded px-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={() => setShowEmoji(false)}
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-8 gap-1 text-lg">
              {EMOJI_LIST.map((emo) => (
                <button
                  key={emo}
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-800"
                  onClick={() => handleEmojiClick(emo)}
                >
                  {emo}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Auth ekranı (Giriş / Üye Ol + mail kod onayı + şifre tekrar + backend ZORUNLU) ---
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("signup"); // "login" | "signup"

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const [verificationCode, setVerificationCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  const nameRule = /^[a-zA-Z0-9._]+$/;

  const API_BASE = "https://knchat-server.onrender.com";

  const handleSendCode = (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("E-posta boş olamaz.");
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError("Geçerli bir e-posta adresi gir.");
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setVerificationCode(code);
    setCodeSent(true);
    setInfo(`Doğrulama kodu DEMO: ${code} (gerçekte e-posta ile gelir)`);
    console.log("DEM0 doğrulama kodu:", code);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    const trimmedName = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Kullanıcı adı boş olamaz.");
      return;
    }
    if (trimmedName.length < 3) {
      setError("Kullanıcı adı en az 3 karakter olmalı.");
      return;
    }
    if (!nameRule.test(trimmedName)) {
      setError(
        "Kullanıcı adı sadece harf, rakam, nokta ve alt çizgi içerebilir."
      );
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }

    const isSignup = mode === "signup";

    if (isSignup) {
      if (!trimmedEmail) {
        setError("E-posta boş olamaz.");
        return;
      }
      if (!isValidEmail(trimmedEmail)) {
        setError("Geçerli bir e-posta adresi gir.");
        return;
      }
      if (password2.trim() === "") {
        setError("Şifre tekrarını da doldur.");
        return;
      }
      if (password !== password2) {
        setError("Şifreler birbiriyle uyuşmuyor.");
        return;
      }
      if (!codeSent) {
        setError("Önce e-posta için doğrulama kodu al.");
        return;
      }
      if (!inputCode.trim()) {
        setError("Doğrulama kodunu gir.");
        return;
      }
      if (inputCode.trim() !== verificationCode) {
        setError("Doğrulama kodu hatalı.");
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: trimmedName,
            email: trimmedEmail,
            password,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Kayıt olurken hata oluştu.");
          return;
        }

        onAuth({
          username: data.username,
          email: data.email,
          mode: "signup",
        });
      } catch (err) {
        console.error("Signup hata:", err);
        setError("Sunucuya bağlanılamadı. Kayıt yapılamadı.");
      } finally {
        setLoading(false);
      }

      return;
    }

    // LOGIN modu
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedName,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Giriş yapılırken hata oluştu.");
        return;
      }

      onAuth({
        username: data.username,
        email: data.email,
        mode: "login",
      });
    } catch (err) {
      console.error("Login hata:", err);
      setError("Sunucuya bağlanılamadı. Giriş yapılamadı.");
    } finally {
      setLoading(false);
    }
  };

  const isSignup = mode === "signup";

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)] text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950/95 p-6 shadow-2xl">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-xl font-extrabold">
            kn
          </div>
          <h1 className="text-lg font-semibold">knchat</h1>
          <p className="mt-1 text-xs text-slate-400">
            {isSignup
              ? "Önce hesabını oluştur, sonra sohbet ekranı açılacak."
              : "Hesabın varsa giriş yap, yoksa Üye Ol sekmesine geç."}
          </p>
        </div>

        <div className="mb-3 flex rounded-xl bg-slate-900 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setInfo("");
            }}
            className={`flex-1 rounded-lg py-1.5 ${
              mode === "login" ? "bg-indigo-600 text-white" : "text-slate-300"
            }`}
          >
            Giriş Yap
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              setInfo("");
            }}
            className={`flex-1 rounded-lg py-1.5 ${
              mode === "signup" ? "bg-indigo-600 text-white" : "text-slate-300"
            }`}
          >
            Üye Ol
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          {/* Kullanıcı adı */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Kullanıcı adı
            </label>
            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="örn. knuser"
            />
          </div>

          {/* SIGNUP için: E-posta + Kod */}
          {isSignup && (
            <>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">
                  E-posta
                </label>
                <div className="flex gap-2">
                  <input
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="ornek@site.com"
                  />
                  <button
                    onClick={handleSendCode}
                    type="button"
                    className="whitespace-nowrap rounded-md bg-slate-800 px-3 text-xs font-semibold text-slate-100 hover:bg-slate-700"
                  >
                    Kod gönder
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">
                  Doğrulama kodu
                </label>
                <input
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value);
                    setError("");
                  }}
                  className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Mailine gelen 6 haneli kod"
                />
              </div>
            </>
          )}

          {/* Şifre + tekrar */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Şifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="En az 6 karakter"
            />
          </div>

          {isSignup && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">
                Şifre (tekrar)
              </label>
              <input
                type="password"
                value={password2}
                onChange={(e) => {
                  setPassword2(e.target.value);
                  setError("");
                }}
                className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Şifre ile aynı olmalı"
              />
            </div>
          )}

          {error && <p className="text-xs text-rose-400">{error}</p>}
          {info && <p className="text-xs text-emerald-400">{info}</p>}
          {loading && (
            <p className="text-[11px] text-slate-400">İşlem yapılıyor...</p>
          )}

          <button
            type="submit"
            className="mt-1 flex w-full items-center justify-center rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            disabled={loading}
          >
            {isSignup ? "Ücretsiz Üye Ol" : "Giriş Yap"}
          </button>

          <p className="pt-1 text-[11px] text-slate-500">
            Doğrulama kodu şu an DEMO modunda bu sayfa üzerinden gösteriliyor.
            Gerçek projede bu kodu backend ile e-posta üzerinden göndereceksin.
          </p>
        </form>
      </div>
    </div>
  );
}

// --- Ana Uygulama (socket + mesaj + online kullanıcı + sesli oda) ---
export default function KankaChat({ socket }) {
  // Kullanıcı bilgisi
  const [authUser, setAuthUser] = useState(() => {
    const data = safeLoad(STORAGE_KEYS.authUser, null);
    if (!data || !data.username) return null;
    return data;
  }); // { username, email, mode }

  // UI state (aktif sunucu / kanal)
  const uiInitial = safeLoad(STORAGE_KEYS.ui, {
    activeServerId: "genel",
    activeChannelId: "genel-1",
  });

  const [activeServerId, setActiveServerId] = useState(
    uiInitial.activeServerId || "genel"
  );
  const [activeChannelId, setActiveChannelId] = useState(
    uiInitial.activeChannelId || "genel-1"
  );

  // Mesajlar, taslaklar, ekler
  const [messages, setMessages] = useState(() =>
    safeLoad(STORAGE_KEYS.messages, {})
  ); // { channelId: Message[] }
  const [drafts, setDrafts] = useState(() => safeLoad(STORAGE_KEYS.drafts, {}));
  const [attachmentsByChannel, setAttachmentsByChannel] = useState(() =>
    safeLoad(STORAGE_KEYS.attachments, {})
  );

  const [voiceState, setVoiceState] = useState({
    inVoice: false,
    muted: false,
    seconds: 0,
  });
  const [voiceError, setVoiceError] = useState("");

  const [onlineUsers, setOnlineUsers] = useState([]);

  const messagesEndRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioRef = useRef(null);

  // Sunucudan gelen mesajları dinle
  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (msg) => {
      if (!msg || !msg.channelId) return;

      setMessages((prev) => {
        const list = prev[msg.channelId] ?? [];
        return {
          ...prev,
          [msg.channelId]: [...list, msg],
        };
      });
    };

    socket.on("chatMessage", handleIncomingMessage);

    return () => {
      socket.off("chatMessage", handleIncomingMessage);
    };
  }, [socket]);

  // Sunucudan online kullanıcı listesini dinle
  useEffect(() => {
    if (!socket) return;

    const handleOnlineUsers = (list) => {
      const mapped =
        Array.isArray(list) &&
        list.map((u) => ({
          name: u.username || u.name || "Bilinmeyen",
          status: "online",
        }));
      setOnlineUsers(mapped || []);
    };

    socket.on("onlineUsers", handleOnlineUsers);

    return () => {
      socket.off("onlineUsers", handleOnlineUsers);
    };
  }, [socket]);

  // Kullanıcı giriş yaptıktan sonra sunucuya kendini tanıt
  useEffect(() => {
    if (!socket || !authUser) return;
    socket.emit("registerUser", {
      username: authUser.username,
    });
  }, [socket, authUser]);

  // authUser'ı localStorage'a yaz
  useEffect(() => {
    if (!authUser) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEYS.authUser);
      }
      return;
    }
    safeSave(STORAGE_KEYS.authUser, authUser);
  }, [authUser]);

  // UI state'i kaydet
  useEffect(() => {
    safeSave(STORAGE_KEYS.ui, { activeServerId, activeChannelId });
  }, [activeServerId, activeChannelId]);

  // Mesajlar, taslaklar, ekler için otomatik kayıt
  useEffect(() => {
    safeSave(STORAGE_KEYS.messages, messages);
  }, [messages]);

  useEffect(() => {
    safeSave(STORAGE_KEYS.drafts, drafts);
  }, [drafts]);

  useEffect(() => {
    safeSave(STORAGE_KEYS.attachments, attachmentsByChannel);
  }, [attachmentsByChannel]);

  const activeServer = useMemo(
    () => SAMPLE_SERVERS.find((s) => s.id === activeServerId) ?? SAMPLE_SERVERS[0],
    [activeServerId]
  );

  const channels = useMemo(
    () => SAMPLE_CHANNELS[activeServer.id] ?? [],
    [activeServer.id]
  );

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? channels[0] ?? null,
    [channels, activeChannelId]
  );

  const channelMessages = activeChannel ? messages[activeChannel.id] ?? [] : [];
  const currentDraft = activeChannel ? drafts[activeChannel.id] ?? "" : "";
  const currentAttachments = activeChannel
    ? attachmentsByChannel[activeChannel.id] ?? []
    : [];

  // yeni mesaja otomatik scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [channelMessages.length, activeChannel?.id]);

  // sesli sohbet süresi
  useEffect(() => {
    if (!voiceState.inVoice) return;
    const id = setInterval(() => {
      setVoiceState((prev) => ({ ...prev, seconds: prev.seconds + 1 }));
    }, 1000);
    return () => clearInterval(id);
  }, [voiceState.inVoice]);

  // component unmount'ta stream'i temizle
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, []);

  const handleChangeServer = (id) => {
    setActiveServerId(id);
    const firstChannel = SAMPLE_CHANNELS[id]?.[0];
    if (firstChannel) {
      setActiveChannelId(firstChannel.id);
    } else {
      setActiveChannelId(null);
    }
  };

  const handleSend = () => {
    if (!activeChannel || !authUser) return;
    const text = currentDraft.trim();
    if (!text && currentAttachments.length === 0) return;

    const now = new Date();
    const time = now.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const newMsg = {
      id: Date.now(),
      channelId: activeChannel.id,
      author: authUser.username,
      time,
      text: text || (currentAttachments.length ? "📎 Dosya gönderildi" : ""),
      attachments: currentAttachments,
      createdAt: now.toISOString(),
    };

    if (socket) {
      socket.emit("chatMessage", newMsg);
    } else {
      setMessages((prev) => ({
        ...prev,
        [activeChannel.id]: [...(prev[activeChannel.id] ?? []), newMsg],
      }));
    }

    setDrafts((prev) => ({
      ...prev,
      [activeChannel.id]: "",
    }));

    setAttachmentsByChannel((prev) => ({
      ...prev,
      [activeChannel.id]: [],
    }));
  };

  const handleDraftChange = (val) => {
    if (!activeChannel) return;
    setDrafts((prev) => ({
      ...prev,
      [activeChannel.id]: val,
    }));
  };

  const handleAttachFiles = (fileList) => {
    if (!activeChannel) return;
    const files = Array.from(fileList).map((f, idx) => ({
      id: `${Date.now()}-${idx}-${f.name}`,
      name: f.name,
      size: f.size,
    }));
    setAttachmentsByChannel((prev) => ({
      ...prev,
      [activeChannel.id]: [...(prev[activeChannel.id] ?? []), ...files],
    }));
  };

  const handleClearAttachments = () => {
    if (!activeChannel) return;
    setAttachmentsByChannel((prev) => ({
      ...prev,
      [activeChannel.id]: [],
    }));
  };

  const handleToggleVoice = async () => {
    if (voiceState.inVoice) {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
      setVoiceState({ inVoice: false, muted: false, seconds: 0 });
      setVoiceError("");
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setVoiceError("Tarayıcı mikrofon API'sini desteklemiyor.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      if (audioRef.current) {
        audioRef.current.srcObject = stream;
      }

      setVoiceState({ inVoice: true, muted: false, seconds: 0 });
      setVoiceError("");
    } catch (err) {
      console.error("Mikrofon hatası:", err);
      setVoiceError("Mikrofon izni verilmedi veya mikrofon bulunamadı.");
    }
  };

  const handleToggleMute = () => {
    setVoiceState((prev) => {
      if (!prev.inVoice) return prev;

      const newMuted = !prev.muted;

      if (localStreamRef.current) {
        localStreamRef.current
          .getAudioTracks()
          .forEach((t) => (t.enabled = !newMuted));
      }

      return { ...prev, muted: newMuted };
    });
  };

  const handleLogout = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setVoiceState({ inVoice: false, muted: false, seconds: 0 });
    setVoiceError("");
    setAuthUser(null);
    setOnlineUsers([]);
  };

  if (!authUser) {
    return <AuthScreen onAuth={setAuthUser} />;
  }

  if (!activeChannel) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-300">Herhangi bir kanal bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100">
      {/* Sol: Sunucu listesi */}
      <aside className="flex w-20 flex-col items-center gap-3 border-r border-slate-800 bg-slate-950/95 px-3 py-3">
        <div className="mb-1 w-full rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 px-2 py-2 text-center text-xs font-bold tracking-tight text-white shadow-lg">
          kn
          <span className="font-extrabold">chat</span>
          <div className="mt-0.5 text-[9px] font-normal text-slate-100/80">
            v1.0 realtime
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto">
          {SAMPLE_SERVERS.map((server) => (
            <ServerAvatar
              key={server.id}
              server={server}
              active={server.id === activeServer.id}
              onClick={() => handleChangeServer(server.id)}
            />
          ))}
        </div>
        <button
          className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-[16px] text-slate-200 hover:bg-slate-700"
          title="İleride sunucu oluşturma için placeholder"
        >
          +
        </button>
      </aside>

      {/* Orta: Kanal listesi + sohbet */}
      <section className="flex min-w-0 flex-1">
        {/* Kanal listesi */}
        <div className="flex w-64 flex-col border-r border-slate-800 bg-slate-900/95">
          <div className="flex h-12 items-center justify-between border-b border-slate-800 px-3 text-sm font-semibold text-slate-100">
            <span>{activeServer.name}</span>
            <span className="text-xs text-slate-500">Sunucu</span>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2 text-xs text-slate-400">
            <div className="mb-1 flex items-center justify-between px-2 text-[11px] uppercase tracking-wide">
              <span>Metin Kanalları</span>
            </div>
            {channels.map((ch) => (
              <ChannelButton
                key={ch.id}
                channel={ch}
                active={ch.id === activeChannel.id}
                onClick={() => setActiveChannelId(ch.id)}
              />
            ))}
          </div>
          <div className="border-t border-slate-800 p-2 text-xs">
            <div className="flex items-center justify-between rounded-md bg-slate-800/80 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-center text-[11px] font-bold">
                  {authUser.username[0]?.toUpperCase()}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[11px] font-semibold">
                    {authUser.username}
                  </span>
                  <span className="text-[10px] text-emerald-400">online</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-rose-600 hover:text-white"
              >
                Çıkış
              </button>
            </div>
          </div>
        </div>

        {/* Sohbet alanı */}
        <div className="flex min-w-0 flex-1 flex-col bg-slate-900/95">
          <ChannelHeader
            serverName={activeServer.name}
            channelName={activeChannel.name}
          />

          <div className="flex-1 space-y-2 overflow-y-auto bg-[radial-gradient(circle_at_top,_#1d283a,_#020617)] px-1 py-2">
            {channelMessages.length === 0 && (
              <div className="mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/80 p-5 text-center text-sm text-slate-300">
                <p className="font-semibold text-slate-100">
                  Bu kanalda henüz mesaj yok.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Aşağıdan ilk mesajı sen yaz.
                </p>
              </div>
            )}
            {channelMessages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          <InputBar
            value={currentDraft}
            onChange={handleDraftChange}
            onSend={handleSend}
            disabled={!activeChannel}
            attachments={currentAttachments}
            onAttachFiles={handleAttachFiles}
            onClearAttachments={handleClearAttachments}
          />
        </div>

        {/* Sağ: Gerçek zamanlı kullanıcı & sesli oda paneli */}
        <aside className="hidden w-72 flex-col border-l border-slate-800 bg-slate-950/95 p-3 text-xs text-slate-300 lg:flex">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
            <span>Çevrimiçi</span>
            <span>{onlineUsers?.length || 0}</span>
          </div>
          <div className="mt-1 space-y-2">
            {onlineUsers && onlineUsers.length > 0 ? (
              onlineUsers.map((u, idx) => <UserBadge key={idx} user={u} />)
            ) : (
              <p className="text-[11px] text-slate-500">
                Şu an online kullanıcı listesi boş görünüyor.
              </p>
            )}
          </div>

          <VoiceCard
            inVoice={voiceState.inVoice}
            muted={voiceState.muted}
            seconds={voiceState.seconds}
            onToggleVoice={handleToggleVoice}
            onToggleMute={handleToggleMute}
            error={voiceError}
          />

          <audio ref={audioRef} autoPlay />
        </aside>
      </section>
    </div>
  );
}
