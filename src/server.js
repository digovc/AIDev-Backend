const http = require('http');
const routes = require('./router');
const cors = require('cors');
const express = require('express');
const socketServer = require('./socket.io');

class Server {
  start() {
    this.app = express();
    this.port = process.env.PORT || 3000;

    // Criar servidor HTTP
    this.server = http.createServer(this.app);

    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(routes.getRouter());

    // Inicializar Socket.IO com o servidor HTTP
    socketServer.initialize(this.server);

    // Usar o servidor HTTP para escutar na porta
    this.server.listen(this.port, () => {
      console.log(`Server running on port ${this.port}`);
      console.log('Socket.IO server initialized');
    });
  }
}

module.exports = new Server();
