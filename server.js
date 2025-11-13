// server.js

import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// --- Dosya yolu ayarları (users.json için) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, "users.json");

// --- Kullanıcıları dosyadan oku / yaz ---
function loadUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.log("users.json okunamadı, boş liste ile başlıyoruz.");
    return [];
  }
}

function saveUsers(list) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {
    console.error("users.json yazılırken hata:", e);
  }
}

// Uygulama açılırken users.json'u yükle
let users = loadUsers();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("knchat socket server çalışıyor");
});

// --- AUTH: Üye ol ---
app.post("/auth/signup", (req, res) => {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Eksik bilgi gönderildi." });
  }

  const trimmedName = String(username).trim();
  const trimmedEmail = String(email).trim();

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(trimmedEmail)) {
    return res.status(400).json({ error: "Geçerli e-posta gir." });
  }

  if (trimmedName.length < 3) {
    return res
      .status(400)
      .json({ error: "Kullanıcı adı en az 3 karakter olmalı." });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Şifre en az 6 karakter olmalı." });
  }

  if (users.find((u) => u.username === trimmedName)) {
    return res.status(409).json({ error: "Bu kullanıcı adı zaten kayıtlı." });
  }
  if (users.find((u) => u.email === trimmedEmail)) {
    return res.status(409).json({ error: "Bu e-posta zaten kayıtlı." });
  }

  const newUser = {
    id: Date.now(),
    username: trimmedName,
    email: trimmedEmail,
    password, // gerçek projede şifre HASH'lenir
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  return res.json({
    username: newUser.username,
    email: newUser.email,
  });
});

// --- AUTH: Giriş yap ---
app.post("/auth/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Kullanıcı adı ve şifre zorunlu." });
  }

  const trimmedName = String(username).trim();
  const found = users.find(
    (u) => u.username === trimmedName && u.password === password
  );

  if (!found) {
    return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı." });
  }

  return res.json({
    username: found.username,
    email: found.email,
  });
});

// --- Socket.IO ayarları ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// socket.id -> username
const onlineUsers = new Map();

function broadcastOnlineUsers() {
  const list = Array.from(onlineUsers.values()).map((name) => ({
    username: name,
  }));
  io.emit("onlineUsers", list);
}

io.on("connection", (socket) => {
  console.log("Yeni bağlantı:", socket.id);

  socket.on("registerUser", ({ username }) => {
    if (!username) return;
    onlineUsers.set(socket.id, username);
    broadcastOnlineUsers();
  });

  socket.on("chatMessage", (msg) => {
    io.emit("chatMessage", msg);
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.id);
    broadcastOnlineUsers();
    console.log("Bağlantı koptu:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`knchat socket server ${PORT} portunda çalışıyor`);
});
