const routes = require('./router');
const cors = require('cors');
const express = require('express');

class Server {
  start() {
    this.app = express();
    this.port = process.env.PORT || 3000;

    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(routes.getRouter());

    this.app.listen(this.port, () => {
      console.log(`Server running on port ${ this.port }`);
    });
  }
}

module.exports = new Server();
