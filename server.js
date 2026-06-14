const express = require('express');
const cors = require('cors');
const engine = require('./engine.js'); // même moteur adapté Node

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('client')); // serve les fichiers statiques

let gameState = engine.createGame('south');
let players = { south: null, north: null }; // socket.id ou simple compteur
let nextPlayerId = 0;

// Attribution des rôles : le premier client est sud, second nord
app.post('/join', (req, res) => {
    if (!players.south) {
        players.south = { id: Date.now() };
        res.json({ role: 'south', state: gameState });
    } else if (!players.north) {
        players.north = { id: Date.now() };
        res.json({ role: 'north', state: gameState });
    } else {
        res.status(403).json({ error: 'Partie pleine' });
    }
});

app.get('/state', (req, res) => {
    res.json(gameState);
});

app.post('/move', (req, res) => {
    const { player, pitIndex, role } = req.body;
    // vérifier que le role correspond bien au joueur courant
    if (gameState.currentPlayer !== player) {
        return res.status(400).json({ error: 'Ce n\'est pas votre tour' });
    }
    const move = { player, pitIndex };
    const result = engine.applyMove(gameState, move);
    if (!result.ok) {
        return res.status(400).json({ error: result.error });
    }
    gameState = result.state;
    res.json({ state: gameState, action: result.action });
});

app.post('/reset', (req, res) => {
    gameState = engine.createGame('south');
    res.json({ state: gameState });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur Songho démarré sur port ${PORT}`));

