/**
 * Parser for Ultra Score Data Out Protocol
 */

const store = require('./store');

// Protocol Constants
const HEAD = 0xFFFE; // Note: Doc says 0xFF 0xFE. Little Endian readUInt16LE will read FE FF. 
// Let's stick to byte-by-byte check or Buffer compare for Head to be safe.
// Doc: Head 2 BYTES 0xFF 0xFE.
// If stream is [FF, FE], readUInt16LE is 0xFEFF. readUInt16BE is 0xFFFE.

/**
 * Parses a UDP message buffer
 * @param {Buffer} msg 
 */
function parseMessage(msg) {
    if (msg.length < 5) return; // Minimum header size

    // Check Header [0xFF, 0xFE]
    if (msg[0] !== 0xFF || msg[1] !== 0xFE) {
        // console.warn('Invalid Header', msg.subarray(0, 2));
        return;
    }

    // ID is at offset 2, 2 bytes. 
    // Docs say "0x01 0x01". Let's assume this means Byte 2 = 0x01, Byte 3 = 0x01.
    // We can read bytes directly to distinguish.
    const idHigh = msg[2];
    const idLow = msg[3];

    // Combine for easier switch (Big Endian logic for ID check as it's byte sequence?)
    // Let's just use the byte values.

    const systemId = msg[4]; // Byte 4
    const length = msg.readUInt16LE(5); // Bytes 5-6

    // Verify length (optional, but good practice). 
    // Length in doc excludes Head(2), ID(2), SysID(1), Length(2) = 7 bytes?
    // Doc says for General Data: "Length 2 BYTES 0x12 0x00 (Length=18)".
    // Content items for General Data sum up to: 1+1+1+3+2+1+1+1+1+1+1+1+1 = 16 bytes?
    // Let's re-sum General Data items:
    // Period (1) + Match Timer Status (1) + Match Timer (3) + Shot Clock (2) + Timeout (1) + Reserved (1) + Reserved (1) 
    // + Team A Score (1) + Team B Score (1) + Team A Foul (1) + Team B Foul (1) 
    // + Team A Timeout (1) + Team B Timeout (1) + Team A Poss (1) + Team B Poss (1)
    // Sum: 1+1+3+2+1+1+1+1+1+1+1+1+1+1+1 = 18 bytes. Matches.

    // So Length field is payload size.
    // Payload starts at offset 7.

    const payload = msg.subarray(7, 7 + length);

    // General Data: ID 0x01 0x01
    if (idHigh === 0x01 && idLow === 0x01) {
        parseGeneralData(payload);
    }
    // Player Individual Data: ID 0x02 0x01 (Team A), 0x03 0x01 (Team B)
    else if (idHigh === 0x02 && idLow === 0x01) {
        parsePlayerData(payload, 'teamA');
    }
    else if (idHigh === 0x03 && idLow === 0x01) {
        parsePlayerData(payload, 'teamB');
    }
    // Penalty: ID 0x04 0x01 (Team A), 0x05 0x01 (Team B)
    else if (idHigh === 0x04 && idLow === 0x01) {
        parsePenaltyData(payload, 'teamA');
    }
    else if (idHigh === 0x05 && idLow === 0x01) {
        parsePenaltyData(payload, 'teamB');
    }
    // Player on Court: ID 0x06 0x01 (Team A), 0x07 0x01 (Team B)
    else if (idHigh === 0x06 && idLow === 0x01) {
        parseCourtData(payload, 'teamA');
    }
    else if (idHigh === 0x07 && idLow === 0x01) {
        parseCourtData(payload, 'teamB');
    }
}

function parseGeneralData(buf) {
    if (buf.length < 18) return;

    const period = buf[0];
    const timerStatus = buf[1];

    // Match Timer: 3 Bytes. Minute, Second, 1/10 Second
    // Doc: Minute part + second part + 1/10 second part.
    const mtMin = buf[2];
    const mtSec = buf[3];
    const mtTenth = buf[4];
    const matchTimer = formatTimer(mtMin, mtSec, mtTenth);

    // Shot Clock: 2 Bytes. Second part + 1/10 second part
    const scSec = buf[5];
    const scTenth = buf[6];
    const shotClock = formatShotClock(scSec, scTenth);

    // Timeout: 1 Byte (0x3C when 60s) - seems to be global timeout countdown?
    const timeoutVal = buf[7];

    // Reserved 2 bytes (8, 9)

    const teamAScore = buf[10];
    const teamBScore = buf[11];
    const teamAFoul = buf[12];
    const teamBFoul = buf[13];
    const teamATimeout = buf[14];
    const teamBTimeout = buf[15];
    const teamAPoss = buf[16] === 0x01;
    const teamBPoss = buf[17] === 0x01;

    store.updateState('general', {
        period,
        periodTitle: getPeriodTitle(period),
        round: getRoundTitle(period),
        periodTitleShort: getPeriodTitleShort(period),
        matchTimerStatus: timerStatus,
        matchTimer,
        shotClock,
        timeout: timeoutVal,
        teamA: {
            score: teamAScore,
            foul: teamAFoul,
            timeout: teamATimeout,
            possession: teamAPoss
        },
        teamB: {
            score: teamBScore,
            foul: teamBFoul,
            timeout: teamBTimeout,
            possession: teamBPoss
        }
    });
}

function parsePlayerData(buf, teamKey) {
    // Length 100 bytes (0x64)
    // Start with Player 1.
    // Each player: Number (3 bytes), Individual Score (1 byte), Individual Foul (1 byte). Total 5 bytes.
    // 20 Players usually? 20 * 5 = 100 bytes.

    const players = [];
    for (let i = 0; i < 20; i++) {
        const offset = i * 5;
        if (offset + 5 > buf.length) break;

        // Player Number: 3 Bytes ASCII. 0x31 0x35 0x00 -> "15". 
        // If 0x00 0x00 0x00, likely empty/no player.
        const n1 = buf[offset];
        const n2 = buf[offset + 1];
        const n3 = buf[offset + 2];

        // Convert to string
        let numStr = '';
        if (n1) numStr += String.fromCharCode(n1);
        if (n2) numStr += String.fromCharCode(n2);
        if (n3) numStr += String.fromCharCode(n3);

        numStr = numStr.replace(/\0/g, ''); // Trim nulls

        if (!numStr) continue; // Skip empty slots

        const score = buf[offset + 3];
        const foul = buf[offset + 4];

        players.push({
            number: numStr,
            score,
            foul
        });
    }

    const update = {};
    update[teamKey] = players;
    store.updateState('players', update);
}

function parseCourtData(buf, teamKey) {
    // Length 80 bytes (0x50)
    // Each record: Number (3 bytes), On Court State (1 byte). Total 4 bytes.
    // 20*4 = 80.

    const onCourt = [];

    for (let i = 0; i < 20; i++) {
        const offset = i * 4;
        if (offset + 4 > buf.length) break;

        const n1 = buf[offset];
        const n2 = buf[offset + 1];
        const n3 = buf[offset + 2];

        let numStr = '';
        if (n1) numStr += String.fromCharCode(n1);
        if (n2) numStr += String.fromCharCode(n2);
        if (n3) numStr += String.fromCharCode(n3);
        numStr = numStr.replace(/\0/g, '');

        if (!numStr) continue;

        const state = buf[offset + 3]; // 0x01 on court

        if (state === 0x01) {
            onCourt.push(numStr);
        }
    }

    const update = {};
    update[teamKey] = onCourt;
    store.updateState('court', update);
}

function parsePenaltyData(buf, teamKey) {
    // Length 15 bytes ? Wait doc says for Penalty "Length 2 BYTES 0x0C 0x00 (Length=12)"
    // But wait, "Penalty" item on Page 3 says "Item ... Player Number (3) ... Penalty Time (2)". 
    // "Info 1 ... Info 2 ... Info 3". 3 Infos?
    // 3 * (3+2) = 15 bytes?
    // Let's check doc: "Length 2 BYTES 0x0C 0x00 (Length=12)".
    // 12 bytes / 5 bytes per info = 2.4? Maybe only 2 infos or something else.
    // Image 2 (Page 3) table:
    // Penalty Info 1: Player Number (3), Penalty Time (2).
    // Info 2: Penalty Time (2) ??? Wait, "Info 2 -> Penalty Time 2 BYTES". Player Number?
    // "Penalty -> Player Number 3 BYTES".
    // "Info 3 -> Penalty Time 2 BYTES".
    // This table is confusing.
    // Let's look at the structure more closely.
    // Row "Penalty" "Player Number" "3 BYTES".
    // Row "Info 1" "Penalty Time" "2 BYTES".
    // Row "Info 2" "Penalty Time" "2 BYTES".
    // Row "Penalty" "Player Number" "3 BYTES" (Again?)
    // Row "Info 3" "Penalty Time" "2 BYTES".
    // Wait, let's look at the Length again. 12 Bytes.
    // The table rows are a bit messy.

    // Maybe it's a fixed list of penalties?
    // Let's assume standard structure: Multiple slots of [Number(3) + Time(2)].
    // If Length is 12, that doesn't fit 5-byte chunks perfectly (2 remainder).
    // Unless it's 2 penalties: 5 + 5 = 10. + 2 padding?
    // Or 3 entries of 4 bytes? No.

    // Let's look at formatting in doc for Penalty Time:
    // "Minute part + second part" (2 bytes). 0x01 0x38 = 1:59.

    // Let's assume the table in Image 2 is:
    // Info 1:
    //   Player Number (3)
    //   Penalty Time (2)
    // Info 2:
    //   Player Number? (See "Penalty Player Number 3 Bytes" in the row below Info 2?)
    //   Penalty Time (2)
    // Actual parsing: Let's loop 5 bytes at a time and see if it fits Length.
    // If Length=12, maybe 2 entries? 10 bytes used, 2 bytes left?
    // Or maybe the doc screenshot is cut off or I'm misreading Length=12.
    // "Length 2 BYTES 0x0C 0x00" -> 12 bytes.
    // It seems to support up to 2 penalties? (10 bytes). 2 bytes padding?

    const penalties = [];
    const structSize = 5;

    for (let offset = 0; offset + structSize <= buf.length; offset += structSize) {
        // Player Number
        const n1 = buf[offset];
        const n2 = buf[offset + 1];
        const n3 = buf[offset + 2];

        let numStr = '';
        if (n1) numStr += String.fromCharCode(n1);
        if (n2) numStr += String.fromCharCode(n2);
        if (n3) numStr += String.fromCharCode(n3);
        numStr = numStr.replace(/\0/g, '');

        if (!numStr) continue;

        const pMin = buf[offset + 3];
        const pSec = buf[offset + 4];
        const timeStr = `${pMin}:${pSec.toString().padStart(2, '0')}`;

        penalties.push({
            number: numStr,
            time: timeStr
        });
    }

    const update = {};
    update[teamKey] = penalties;
    store.updateState('penalties', update);
}

// Helpers

function formatTimer(min, sec, tenth) {
    // Check special value 0xFF 0xFF 0xFF ?
    if (min === 0xFF && sec === 0xFF && tenth === 0xFF) return '';
    if (min > 0) {
        if (tenth >= 1) {
            sec++;
            if (sec >= 60) {
                sec = 0;
                min++;
            }
        }
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    } else {
        return `${sec}.${tenth}`;
    }
}

function formatShotClock(sec, tenth) {
    if (sec === 0xFF && tenth === 0xFF) return '';
    if (sec > 5) {
        return (tenth >= 1 ? sec + 1 : sec).toString();
    }
    return `${sec}.${tenth}`;
}

function getPeriodTitle(p) {
    const titles = {
        0: 'pregame',
        1: 'quarter1',
        2: 'break',
        3: 'quarter2',
        4: 'halftime',
        5: 'quarter3',
        6: 'break',
        7: 'quarter4',
        8: 'break',
        9: 'overtime1',
        10: 'break',
        11: 'overtime2',
        12: 'break',
        13: 'overtime3',
        14: 'break',
        15: 'overtime4'
    };
    return titles[p] || '';
}

function getPeriodTitleShort(p) {
    const titles = {
        0: '',
        1: 'Q1',
        2: '',
        3: 'Q2',
        4: '',
        5: 'Q3',
        6: '',
        7: 'Q4',
        8: '',
        9: 'OT1',
        10: '',
        11: 'OT2',
        12: '',
        13: 'OT3',
        14: '',
        15: 'OT4'
    };
    return titles[p] || '';
}

function getRoundTitle(p) {
    const titles = {
        0: 'Pre Game',
        1: '1st Quarter',
        2: 'Break',
        3: '2nd Quarter',
        4: 'Halftime',
        5: '3rd Quarter',
        6: 'Break',
        7: '4th Quarter',
        8: 'Break',
        9: 'Overtime 1',
        10: 'Break',
        11: 'Overtime 2',
        12: 'Break',
        13: 'Overtime 3',
        14: 'Break',
        15: 'Overtime 4'
    };
    return titles[p] || '';
}

module.exports = {
    parseMessage
};
