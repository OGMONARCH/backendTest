const { io } = require("socket.io-client");

// Replace with JWTs from different GitHub logins
const tokens = [
  "hey-there-secret-key-here",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJnaXRodWI6MTQ5MjMwMjI2IiwibmFtZSI6IkVtbWFudWVsICBPbW9ydXlpIiwiaWF0IjoxNzU4MzY5MzY3LCJleHAiOjE3NTgzNzI5Njd9.cpKIjNzMkxl64ZDuCEOfBrooLJCfK_qTb7i9eHJ0xyo",
  "super-duper-secret-key"
];

tokens.forEach((token, idx) => {
  const socket = io("http://localhost:3000", { auth: { token } });

  socket.on("connect", () => {
    console.log(`✅ User${idx+1} connected:`, socket.id);
    socket.emit("join", { room: "general" });
    socket.emit("message", { room: "general", text: `Hello from User${idx+1}` });
  });

  socket.on("message", (msg) => {
    console.log(`💬 [User${idx+1}] received message:`, msg);
  });

  socket.on("notification", (note) => {
    console.log(`🔔 [User${idx+1}] notification:`, note);
  });

  socket.on("connect_error", (err) => {
    console.error(`❌ [User${idx+1}] error:`, err.message);
  });
});
