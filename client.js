const { io } = require("socket.io-client");

// Paste the JWT you copied from /auth/github/callback here
const token = "jwt_key";

const socket = io("http://localhost:3000", {
  auth: { token }
});

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);

  // Join Room
  socket.emit("join", { room: "general" });

  // Test message
  socket.emit("message", { room: "general", text: "Hello, manual test here!" });
});

// Listen for messages
socket.on("message", (msg) => {
  console.log("💬 Message received:", msg);
});

// Listen for notifications (join/leave)
socket.on("notification", (note) => {
  console.log("🔔 Notification:", note);
});

// Handle Connection errors
socket.on("connect_error", (err) => {
  console.error("❌ Connection error:", err.message);
});
