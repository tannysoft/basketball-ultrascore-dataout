const { startUdpServer } = require('./lib/udpServer');
const { startHttpServer } = require('./lib/httpServer');

const UDP_PORT = process.env.UDP_PORT || 2800;
const HTTP_PORT = process.env.HTTP_PORT || 3000;

console.log('Starting Basketball Ultra Score Data Out Service...');

// Start UDP Listener
startUdpServer(UDP_PORT);

// Start REST API
startHttpServer(HTTP_PORT);
