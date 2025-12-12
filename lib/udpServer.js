const dgram = require('dgram');
const parser = require('./parser');

function startUdpServer(port = 2800) {
    const server = dgram.createSocket('udp4');

    server.on('error', (err) => {
        console.error(`UDP Server error:\n${err.stack}`);
        server.close();
    });

    server.on('message', (msg, rinfo) => {
        // console.log(`UDP got: ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
        try {
            parser.parseMessage(msg);
        } catch (e) {
            console.error('Error parsing UDP message:', e);
        }
    });

    server.on('listening', () => {
        const address = server.address();
        console.log(`UDP Server listening on ${address.address}:${address.port}`);
    });

    server.bind(port);
    return server;
}

module.exports = { startUdpServer };
