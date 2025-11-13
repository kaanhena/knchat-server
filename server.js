const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

// CORS ayarı
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Basit sağlık testi
app.get("/", (req, res) => {
  res.send("knchat socket server çalışıyor");
});

// Bağlanan kullanıcıları dinle
io.on("connection", (socket) => {
  console.log("Yeni kullanıcı bağlandı:", socket.id);

  // Mesaj geldiğinde herkese yayınlama
  socket.on("chatMessage", (data) => {
    const message = {
      id: Date.now(),
      text: data.text || "",
      user: data.user || "Anonim",
      createdAt: new Date().toISOString(),
    };

    io.emit("chatMessage", message); // herkese gönder
  });

  socket.on("disconnect", () => {
    console.log("Kullanıcı ayrıldı:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`knchat socket server ${PORT} portunda çalışıyor`);
});
