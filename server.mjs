// server.js
// KnChat Auth Backend (tek dosya, PORT 4000)

import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000; // 🔥 4000
const DATA_FILE = path.join(process.cwd(), "users.json");

app.use(cors());
app.use(express.json());

// ------------------ Kullanıcı veri yönetimi ------------------

function loadUsers() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), "utf-8");
}

// Bellekteki kopya
let USERS = loadUsers();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ------------------ Mail (Gmail SMTP) ------------------

const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ------------------ Basit ping ------------------

app.get("/", (req, res) => {
  res.send("KnChat auth backend çalışıyor ✅");
});

// ------------------ ÜYE OL ------------------

app.post("/api/auth/register", async (req, res) => {
  console.log("→ POST /api/auth/register", req.body);
  try {
    const { email, password, username } = req.body || {};

    if (!email || !password || !username) {
      return res.status(400).json({ ok: false, msg: "Eksik bilgi" });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    // her istekte dosyadan taze çek
    USERS = loadUsers();

    let existing = USERS.find(
      (u) => String(u.email || "").toLowerCase().trim() === cleanEmail
    );

    if (existing && existing.verified) {
      return res
        .status(400)
        .json({ ok: false, msg: "Bu e-posta ile zaten hesap var" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verifyCode = generateCode();

    if (existing) {
      existing.username = username;
      existing.passwordHash = passwordHash;
      existing.verified = false;
      existing.verifyCode = verifyCode;
    } else {
      existing = {
        id: Date.now(),
        email: cleanEmail,
        username,
        passwordHash,
        verified: false,
        verifyCode,
        createdAt: new Date().toISOString(),
      };
      USERS.push(existing);
    }

    saveUsers(USERS);

    await mailer.sendMail({
      from: process.env.MAIL_USER,
      to: cleanEmail,
      subject: "KnChat Hesap Doğrulama Kodu",
      text: `KnChat doğrulama kodun: ${verifyCode}`,
    });

    res.json({ ok: true, msg: "Doğrulama kodu mail olarak gönderildi" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ ok: false, msg: "Kayıt sırasında hata oluştu" });
  }
});

// ------------------ DOĞRULAMA ------------------

app.post("/api/auth/verify", (req, res) => {
  console.log("→ POST /api/auth/verify", req.body);

  try {
    let { email, code } = req.body || {};

    const cleanEmail = String(email || "").toLowerCase().trim();
    const cleanCode = String(code || "").trim();

    if (!cleanEmail || !cleanCode) {
      return res.status(400).json({ ok: false, msg: "Eksik bilgi" });
    }

    // en güncel users
    USERS = loadUsers();

    const user = USERS.find(
      (u) =>
        String(u.email || "").toLowerCase().trim() === cleanEmail
    );

    if (!user) {
      return res
        .status(404)
        .json({ ok: false, msg: "Kullanıcı bulunamadı" });
    }

    const storedCode = String(user.verifyCode || "").trim();

    // DEBUG: terminalde gör
    console.log("Doğrulama karşılaştırma:", {
      emailDB: user.email,
      emailGelen: cleanEmail,
      kodDB: storedCode,
      kodGelen: cleanCode,
    });

    if (!storedCode || storedCode !== cleanCode) {
      return res
        .status(400)
        .json({ ok: false, msg: "Doğrulama kodu hatalı" });
    }

    user.verified = true;
    user.verifyCode = null;
    saveUsers(USERS);

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET || "dev-secret-knchat",
      { expiresIn: "7d" }
    );

    return res.json({
      ok: true,
      msg: "Hesap doğrulandı",
      token,
      user: { email: user.email, username: user.username },
    });
  } catch (err) {
    console.error("Verify error:", err);
    return res
      .status(500)
      .json({ ok: false, msg: "Doğrulama sırasında hata oluştu" });
  }
});

// ------------------ GİRİŞ ------------------

app.post("/api/auth/login", async (req, res) => {
  console.log("→ POST /api/auth/login", req.body);
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ ok: false, msg: "Eksik bilgi" });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    // taze users
    USERS = loadUsers();

    const user = USERS.find(
      (u) =>
        String(u.email || "").toLowerCase().trim() === cleanEmail
    );

    if (!user) {
      return res.status(404).json({ ok: false, msg: "Kullanıcı bulunamadı" });
    }

    if (!user.verified) {
      return res.status(403).json({
        ok: false,
        msg: "Önce mail adresini doğrulaman gerekiyor",
      });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);

    if (!passwordOk) {
      return res.status(400).json({ ok: false, msg: "Şifre hatalı" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET || "dev-secret-knchat",
      { expiresIn: "7d" }
    );

    res.json({
      ok: true,
      msg: "Giriş başarılı",
      token,
      user: { email: user.email, username: user.username },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ ok: false, msg: "Giriş sırasında hata oluştu" });
  }
});

// ------------------ SUNUCU ------------------

app.listen(PORT, () => {
  console.log("KnChat auth backend port", PORT, "üzerinde çalışıyor");
});
