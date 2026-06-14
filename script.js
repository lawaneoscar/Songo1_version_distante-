let myRole = null; // 'south' ou 'north'
let gameState = null;
let pollingInterval = null;

async function joinGame() {
    try {
        const resp = await fetch('/join', { method: 'POST' });
        const data = await resp.json();
        if (data.error) {
            document.getElementById('status').textContent = 'Partie pleine, rafraîchissez plus tard.';
            return;
        }
        myRole = data.role;
        gameState = data.state;
        document.getElementById('status').textContent = `Vous êtes ${myRole === 'south' ? 'Sud' : 'Nord'}. En attente du coup...`;
        renderBoard();
        startPolling();
    } catch (err) {
        console.error(err);
        document.getElementById('status').textContent = 'Erreur de connexion au serveur.';
    }
}

function renderBoard() {
    if (!gameState) return;
    const northRow = document.getElementById('north-row');
    const southRow = document.getElementById('south-row');
    northRow.innerHTML = '';
    southRow.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        const northPit = document.createElement('div');
        northPit.className = 'pit';
        northPit.textContent = gameState.board.north[i];
        northPit.dataset.player = 'north';
        northPit.dataset.index = i;
        northPit.addEventListener('click', () => onPitClick('north', i));
        if (myRole !== 'north' || gameState.currentPlayer !== 'north' || gameState.status !== 'playing') northPit.classList.add('inactive');
        northRow.appendChild(northPit);
    }
    for (let i = 0; i < 7; i++) {
        const southPit = document.createElement('div');
        southPit.className = 'pit';
        southPit.textContent = gameState.board.south[i];
        southPit.dataset.player = 'south';
        southPit.dataset.index = i;
        southPit.addEventListener('click', () => onPitClick('south', i));
        if (myRole !== 'south' || gameState.currentPlayer !== 'south' || gameState.status !== 'playing') southPit.classList.add('inactive');
        southRow.appendChild(southPit);
    }
    document.querySelector('.north-score').textContent = `Nord : ${gameState.scores.north}`;
    document.querySelector('.south-score').textContent = `Sud : ${gameState.scores.south}`;
    let statusMsg = '';
    if (gameState.status !== 'playing') {
        if (gameState.winner === 'north') statusMsg = 'Nord gagne !';
        else if (gameState.winner === 'south') statusMsg = 'Sud gagne !';
        else statusMsg = 'Match nul !';
        statusMsg += ` (${gameState.reason})`;
    } else {
        statusMsg = `Tour du joueur ${gameState.currentPlayer === 'north' ? 'Nord' : 'Sud'}`;
        if (gameState.currentPlayer === myRole) statusMsg += ' (Votre tour !)';
    }
    document.getElementById('status').textContent = statusMsg;
}

async function onPitClick(player, idx) {
    if (gameState.status !== 'playing') return;
    if (player !== myRole) return;
    if (gameState.currentPlayer !== player) return;
    try {
        const resp = await fetch('/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player, pitIndex: idx, role: myRole })
        });
        const data = await resp.json();
        if (!resp.ok) {
            alert(data.error);
            return;
        }
        gameState = data.state;
        renderBoard();
    } catch (err) {
        alert('Erreur réseau');
    }
}

async function resetGame() {
    if (myRole !== 'south') {
        alert('Seul le joueur Sud peut réinitialiser la partie.');
        return;
    }
    const resp = await fetch('/reset', { method: 'POST' });
    const data = await resp.json();
    gameState = data.state;
    renderBoard();
}

async function pollState() {
    if (!myRole) return;
    const resp = await fetch('/state');
    const newState = await resp.json();
    // vérifier si l'état a changé (comparaison simple)
    if (JSON.stringify(gameState) !== JSON.stringify(newState)) {
        gameState = newState;
        renderBoard();
    }
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(pollState, 800);
}

joinGame();
document.getElementById('resetBtn').addEventListener('click', resetGame);

