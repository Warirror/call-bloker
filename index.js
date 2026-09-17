const express = require("express");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("WhatsApp Call Blocker is running ✅");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
  });
}

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("./auth_info");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  // 📵 Reject incoming calls
  sock.ev.on("call", async (calls) => {
    for (const call of calls) {
      if (call.status === "offer") {
        try {
          await sock.rejectCall(call.id, call.from);
          console.log(`📵 Call rejected: ${call.from}`);
        } catch (err) {
          console.log("❌ Reject error:", err.message);
        }
      }
    }
  });

  // 🔐 Pairing code
  if (!sock.authState?.creds?.registered) {
    const phoneNumber = await ask(
      "📱 Enter WhatsApp number with country code (example: 919876543210): "
    );

    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log("\n================================");
      console.log("🔐 YOUR PAIRING CODE:");
      console.log(code);
      console.log("================================\n");
      console.log(
        "WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number"
      );
    } catch (err) {
      console.log("❌ Pairing error:", err.message);
    }
  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ WhatsApp connected!");
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting...");
        startBot();
      } else {
        console.log("⚠️ WhatsApp logged out.");
      }
    }
  });
}

startBot();
