// server.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// Basit test endpoint’i
app.get("/", (req, res) => {
  res.send("knchat socket server çalışıyor");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Yeni client bağlandı:", socket.id);

  // İSTEDİĞİMİZ EVENT: "chatMessage"
  socket.on("chatMessage", (msg) => {
    console.log("Mesaj geldi:", msg);
    // Tüm bağlı client’lara gönder (gönderen dahil)
    io.emit("chatMessage", msg);
  });

  socket.on("disconnect", () => {
    console.log("Client ayrıldı:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`knchat socket server ${PORT} portunda çalışıyor`);
});
