const dgram = require('dgram');

const client = dgram.createSocket('udp4');
const PORT = 2800;
const HOST = '127.0.0.1';

// Helpers to build packets
function buildGeneralDataPacket() {
    // Size: 2(Head) + 2(ID) + 1(Sys) + 2(Len) + 18(Payload) = 25 bytes
    const buf = Buffer.alloc(25);

    // Header
    buf.writeUInt8(0xFF, 0);
    buf.writeUInt8(0xFE, 1);

    // ID 0x0101
    buf.writeUInt8(0x01, 2);
    buf.writeUInt8(0x01, 3);

    // SysID
    buf.writeUInt8(0x01, 4);

    // Length 18 (0x12)
    buf.writeUInt16LE(18, 5);

    // Payload (18 bytes)
    let offset = 7;

    // Cycle periods 0-15
    const period = Math.floor((Date.now() / 5000) % 16);
    buf.writeUInt8(period, offset++); // Period

    buf.writeUInt8(0x11, offset++); // Timer Status (Running)

    // Match Timer
    // Case 1: 09:56.7 -> Min 9, Sec 56, Tenth 7
    // Case 2: 00:59.5 -> Min 0, Sec 59, Tenth 5
    // We can alternate based on timestamp or random

    if (Date.now() % 4000 < 2000) {
        // > 1 Min
        buf.writeUInt8(9, offset++);
        buf.writeUInt8(56, offset++);
        buf.writeUInt8(7, offset++);
    } else {
        // < 1 Min
        buf.writeUInt8(0, offset++);
        buf.writeUInt8(59, offset++);
        buf.writeUInt8(5, offset++);
    }

    // Shot Clock
    // Case 1: 20.7 -> Should be "21" (20 + 0.7 = 20.7 rounded is 21)
    // Case 2: 4.3 -> Should be "4.3"

    if (Date.now() % 4000 < 2000) {
        // > 5 Sec
        buf.writeUInt8(20, offset++);
        buf.writeUInt8(7, offset++); // 20.7 -> 21
    } else {
        // < 5 Sec
        buf.writeUInt8(4, offset++);
        buf.writeUInt8(3, offset++); // 4.3 -> 4.3
    }

    buf.writeUInt8(0, offset++); // Timeout
    buf.writeUInt8(0, offset++); // Rsv
    buf.writeUInt8(0, offset++); // Rsv

    buf.writeUInt8(88, offset++); // Team A Score
    buf.writeUInt8(79, offset++); // Team B Score

    buf.writeUInt8(2, offset++); // Team A Foul
    buf.writeUInt8(3, offset++); // Team B Foul

    buf.writeUInt8(1, offset++); // Team A Timeout
    buf.writeUInt8(0, offset++); // Team B Timeout

    buf.writeUInt8(1, offset++); // Team A Poss
    buf.writeUInt8(0, offset++); // Team B Poss

    return buf;
}

function buildCourtDataPacket() {
    // Player on Court
    // ID 0x06 0x01 (Team A)
    // Length 80 (0x50)
    // Payload: 5 * 4 = 20 entries of 4 bytes? No.
    // 20 players * 4 bytes = 80 bytes.

    const len = 80;
    const buf = Buffer.alloc(7 + len);

    buf.writeUInt8(0xFF, 0);
    buf.writeUInt8(0xFE, 1);
    buf.writeUInt8(0x06, 2);
    buf.writeUInt8(0x01, 3);
    buf.writeUInt8(0x01, 4);
    buf.writeUInt16LE(len, 5);

    let offset = 7;
    // Player "7" on court
    buf.writeUInt8(0x37, offset++); // '7'
    buf.writeUInt8(0x00, offset++);
    buf.writeUInt8(0x00, offset++);
    buf.writeUInt8(0x01, offset++); // On Court

    return buf;
}

function sendPacket(buf) {
    client.send(buf, PORT, HOST, (err) => {
        if (err) console.error(err);
        else console.log('Sent packet size:', buf.length);
    });
}

setInterval(() => {
    sendPacket(buildGeneralDataPacket());
    sendPacket(buildCourtDataPacket());
}, 2000);

console.log('Simulating UDP broadcasts to port 2800...');
