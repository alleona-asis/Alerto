const { Server } = require('socket.io');

let ioInstance = null;

function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: '*', // Change to your frontend origin in production
      methods: ['GET', 'POST'],
    },
  });
  return ioInstance;
}

function getIo() {
  if (!ioInstance) {
    throw new Error('Socket.io not initialized!');
  }
  return ioInstance;
}

module.exports = { initSocket, getIo };
