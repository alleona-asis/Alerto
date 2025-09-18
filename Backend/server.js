const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
require('dotenv').config();

const { initSocket, getIo } = require('./socket');
const { checkExpiredPickups } = require('./utils/autoUnclaimed');

const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server using Express app
const server = http.createServer(app);

// Initialize Socket.IO using your socket.js module
const io = initSocket(server);

// -----------------------------
// Run auto-check for expired pickups
// -----------------------------
setInterval(checkExpiredPickups, 10 * 1000);

// Listen for new socket connections
io.on('connection', (socket) => {
  //console.log('New client connected:', socket.id);

  socket.on("joinRoom", ({ userId }) => {
    if (!userId) return;
    const room = `user_${userId}`;
    socket.join(room);
    console.log(`🏠 ${socket.id} joined ${room}`);
    console.log("rooms for socket:", Array.from(socket.rooms));
  });

  socket.on('disconnect', () => {
    //console.log('Client disconnected:', socket.id);
  });
});

// Register your existing routes
const authRoutes = require('./Routes/authRoutes');
const adminRoutes = require('./Routes/adminRoutes');
const lguRoutes = require('./Routes/lguRoutes');
const brgyRoutes = require('./Routes/brgyRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lgu', lguRoutes);
app.use('/api/brgy', brgyRoutes);

// Static file serving
app.use('/uploads/id', express.static(path.join(__dirname, 'uploads/id')));
app.use('/uploads/letter', express.static(path.join(__dirname, 'uploads/letter')));
app.use('/uploads/mobile', express.static(path.join(__dirname, 'uploads/mobile')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = 5000;

// Use server.listen instead of app.listen for socket.io to work
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

module.exports = { app, io };
