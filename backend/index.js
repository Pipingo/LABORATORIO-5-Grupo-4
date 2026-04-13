const express = require("express");
const { Expo } = require("expo-server-sdk");

const app = express();
const expo = new Expo();

// CORS abierto — acepta cualquier origen y método
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "*");
  res.header("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Middleware para parsear JSON
app.use(express.json());

// Almacén en memoria de tokens por usuario
const tokens = {};

// Endpoint para registrar el push token de un usuario
app.post("/register-token", (req, res) => {
  const { userId, token } = req.body;

  // Validar que sea un token de Expo válido
  if (!Expo.isExpoPushToken(token)) {
    return res.status(400).json({ error: "Token inválido" });
  }

  // Guardar la relación userId → token
  tokens[userId] = token;
  console.log(`Token guardado — userId: ${userId}, token: ${token}`);

  res.json({ ok: true });
});

// Endpoint para enviar una notificación push a un usuario
app.post("/send-notification", async (req, res) => {
  const { userId, title, body } = req.body;

  // Buscar el token del usuario
  const token = tokens[userId];
  if (!token) {
    return res.status(404).json({ error: "Usuario sin token registrado" });
  }

  // Construir el mensaje de notificación
  const messages = [
    {
      to: token,
      sound: "default",
      title,
      body,
      data: { userId, screen: "Home" },
    },
  ];

  // Enviar usando el SDK de Expo
  const chunks = expo.chunkPushNotifications(messages);
  try {
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log("Respuesta de Expo:", ticketChunk);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Error al enviar notificación:", error);
    res.status(500).json({ error: "Error al enviar notificación" });
  }
});

// Endpoint GET para obtener todos los tokens registrados (Opción 4)
app.get("/tokens", (req, res) => {
  res.json(tokens);
});

// Endpoint POST para enviar notificación a todos los usuarios (Opción 5)
app.post("/send-to-all", async (req, res) => {
  const { title, body } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: "Título y cuerpo son requeridos" });
  }

  // Construir mensajes para todos los tokens
  const messages = Object.entries(tokens).map(([userId, token]) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: { userId, screen: "Home" },
  }));

  if (messages.length === 0) {
    return res.status(400).json({ error: "No hay usuarios registrados" });
  }

  // Enviar usando chunks
  const chunks = expo.chunkPushNotifications(messages);
  try {
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log("Respuesta de Expo (broadcast):", ticketChunk);
    }
    res.json({ ok: true, sent: messages.length });
  } catch (error) {
    console.error("Error al enviar notificación broadcast:", error);
    res.status(500).json({ error: "Error al enviar notificación" });
  }
});

// Iniciar el servidor en el puerto 3000
app.listen(3000, () => {
  console.log("Servidor escuchando en http://localhost:3000");
});
