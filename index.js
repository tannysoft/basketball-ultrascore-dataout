const { startUdpServer } = require('./lib/udpServer');
const { startHttpServer } = require('./lib/httpServer');

const UDP_PORT = process.env.UDP_PORT || 2800;
const UDP_HOST = process.env.UDP_HOST || '127.0.0.1';
const HTTP_PORT = process.env.HTTP_PORT || 3000;

console.log('Starting Basketball Ultra Score Data Out Service...');

// Start UDP Listener
startUdpServer(UDP_PORT, UDP_HOST);

// Start REST API
startHttpServer(HTTP_PORT);
