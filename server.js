import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

// Test için basit GET isteği
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

// Bağlanma
io.on("connection", (socket) => {
console.log("Yeni kullanıcı bağlandı:", socket.id);

// Mesaj geldiğinde herkese yay
socket.on("chatMessage", (data) => {
io.emit("chatMessage", data);
});

// Ayrılma
socket.on("disconnect", () => {
console.log("Kullanıcı ayrıldı:", socket.id);
});
});

// Render’ın verdiği PORT'u kullanıyoruz
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
console.log(knchat socket server ${PORT} portunda çalışıyor);
});
