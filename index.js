const express = require("express");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("WhatsApp Call Blocker is running ✅");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  // 📵 Automatically reject incoming WhatsApp calls
  sock.ev.on("call", async (calls) => {
    for (const call of calls) {
      if (call.status === "offer") {
        try {
          await sock.rejectCall(call.id, call.from);
          console.log(`📵 Call rejected from: ${call.from}`);
        } catch (error) {
          console.log("❌ Call reject error:", error.message);
        }
      }
    }
  });

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ WhatsApp connected!");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("❌ Connection closed");

      if (shouldReconnect) {
        console.log("🔄 Reconnecting...");
        startBot();
      } else {
        console.log("⚠️ WhatsApp logged out.");
      }
    }
  });
}

startBot();
