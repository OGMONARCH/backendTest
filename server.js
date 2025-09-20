require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());
app.use(cookieParser());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

//  In-memory storage
const stateStore = new Map();
const users = new Map();

// Env Imports
const PORT = process.env.PORT || 3000;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '1h';

// Helpers
function createState() {
  const state = uuidv4();
  stateStore.set(state, { createdAt: Date.now() });
  setTimeout(() => stateStore.delete(state), 5 * 60 * 1000); // 5 mins expiry
  return state;
}

function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY }); // 1h
}

function verifyJwt(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Routes

// GitHub OAuth login
app.get('/auth/github/login', (req, res) => {
  const state = createState();
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope: 'read:user user:email',
    state
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// GitHub Callback
app.get('/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state || !stateStore.has(state)) {
    return res.status(400).send('Invalid state or code');
  }
  stateStore.delete(state);

  try {
    // Exchange Code for GitHub token
    const tokenResp = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_CALLBACK_URL,
        state
      },
      { headers: { Accept: 'application/json' } }
    );

    const ghToken = tokenResp.data.access_token;

    // Fetch User Profile
    const userResp = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${ghToken}` }
    });

    const userId = `github:${userResp.data.id}`;
    const user = {
      id: userId,
      login: userResp.data.login,
      name: userResp.data.name,
      avatar: userResp.data.avatar_url
    };
    users.set(userId, user);

    //Issue JWT
    const myToken = signJwt({ sub: userId, name: user.name });
    res.json({ jwt: myToken, user });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send('OAuth failed');
  }
});

// Protected endpoint: /me
app.get('/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const payload = token && verifyJwt(token);
  if (!payload) return res.status(401).json({ error: 'unauthorized' });
  const user = users.get(payload.sub);
  res.json({ user });
});

// WebSocket with JWT auth 
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  const payload = token && verifyJwt(token);
  if (!payload) return next(new Error('unauthorized'));
  socket.user = payload;
  next();
});

io.on('connection', (socket) => {
  console.log('user connected', socket.user);

  socket.on('join', ({ room }) => {
    socket.join(room);
    io.to(room).emit('notification', { type: 'join', user: socket.user });
  });

  socket.on('message', ({ room, text }) => {
    io.to(room).emit('message', { user: socket.user, text });
  });

  socket.on('disconnect', () => {
    console.log('user disconnected', socket.user);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
