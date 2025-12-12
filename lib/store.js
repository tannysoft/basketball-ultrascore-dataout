/**
 * In-memory data store for Ultra Score data.
 */

const state = {
    general: {
        period: 0,
        matchTimerStatus: 0,
        matchTimer: '00:00.0', // Formatted string
        shotClock: '0.0', // Formatted string
        timeout: 0,
        teamA: {
            score: 0,
            foul: 0,
            timeout: 0,
            possession: false,
        },
        teamB: {
            score: 0,
            foul: 0,
            timeout: 0,
            possession: false,
        }
    },
    players: {
        teamA: [], // Array of { number, score, foul }
        teamB: []
    },
    court: {
        teamA: [], // Array of player numbers on court
        teamB: []
    },
    penalties: {
        teamA: [], // Array of { number, time }
        teamB: []
    },
    lastUpdated: null
};

/**
 * Updates a section of the state
 * @param {string} section - 'general', 'players', 'court', 'penalties'
 * @param {object} data - The data to merge or replace
 */
function updateState(section, data) {
    if (section === 'general') {
        state.general = { ...state.general, ...data };
    } else if (section === 'players') {
        // Expect data to have teamA or teamB array updates
        if (data.teamA) state.players.teamA = data.teamA;
        if (data.teamB) state.players.teamB = data.teamB;
    } else if (section === 'court') {
        if (data.teamA) state.court.teamA = data.teamA;
        if (data.teamB) state.court.teamB = data.teamB;
    } else if (section === 'penalties') {
        if (data.teamA) state.penalties.teamA = data.teamA;
        if (data.teamB) state.penalties.teamB = data.teamB;
    }

    state.lastUpdated = new Date();
}

/**
 * Returns the current full state
 */
function getState() {
    return state;
}

module.exports = {
    updateState,
    getState
};
