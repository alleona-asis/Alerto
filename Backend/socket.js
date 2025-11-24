const { Server } = require('socket.io');

let ioInstance = null;

function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: '*',
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
