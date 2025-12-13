const express = require('express');
const store = require('./store');

function startHttpServer(port = 3000) {
    const app = express();

    // Middleware
    app.use(express.json());

    // CORS (Simple allow all for dev)
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        next();
    });

    // API Endpoints
    app.get('/api/game', (req, res) => {
        res.json(store.getState());
    });

    app.get('/api/score', (req, res) => {
        const { teamA, teamB, ...rest } = store.getState().general;
        const flattened = {
            ...rest,
            teamAScore: teamA.score,
            teamAFoul: teamA.foul,
            teamATimeout: teamA.timeout,
            teamAPossession: teamA.possession,
            teamBScore: teamB.score,
            teamBFoul: teamB.foul,
            teamBTimeout: teamB.timeout,
            teamBPossession: teamB.possession
        };
        res.json([flattened]);
    });

    app.get('/health', (req, res) => {
        res.send('OK');
    });

    app.listen(port, () => {
        console.log(`HTTP Server listening at http://localhost:${port}`);
    });

    return app;
}

module.exports = { startHttpServer };
