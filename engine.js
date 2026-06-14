// CONSTANTES
const RULES = {
    players: ["north", "south"],
    pitsPerPlayer: 7,
    initialSeedsPerPit: 5,
    totalSeeds: 70,
    victoryScore: 40,
    lowBoardLimit: 10,
    captureValues: [2, 3, 4],
    maxNormalSowSeeds: 13
};

// Utilitaires
function other(player) {
    return player === "north" ? "south" : "north";
}

function sum(arr) {
    return arr.reduce((a,b) => a + b, 0);
}

function boardSeeds(state) {
    return sum(state.board.north) + sum(state.board.south);
}

function totalSeeds(state) {
    return state.scores.north + state.scores.south + boardSeeds(state);
}

function samePosition(a, b) {
    return a.player === b.player && a.pitIndex === b.pitIndex;
}

function isOpponentPit(player, position) {
    return position.player === other(player);
}

function attackPit(player) {
    return player === "north" ? { player: "north", pitIndex: 6 } : { player: "south", pitIndex: 0 };
}

function opponentFirstPit(player) {
    return player === "north" ? { player: "south", pitIndex: 6 } : { player: "north", pitIndex: 0 };
}

// Cycle de semaille (ordre physique)
const CYCLE = [
    { player: "north", pitIndex: 0 }, { player: "north", pitIndex: 1 }, { player: "north", pitIndex: 2 },
    { player: "north", pitIndex: 3 }, { player: "north", pitIndex: 4 }, { player: "north", pitIndex: 5 },
    { player: "north", pitIndex: 6 },
    { player: "south", pitIndex: 6 }, { player: "south", pitIndex: 5 }, { player: "south", pitIndex: 4 },
    { player: "south", pitIndex: 3 }, { player: "south", pitIndex: 2 }, { player: "south", pitIndex: 1 },
    { player: "south", pitIndex: 0 }
];

function cycleIndexOf(position) {
    return CYCLE.findIndex(p => samePosition(p, position));
}

function nextPositionsAfter(source) {
    const start = cycleIndexOf(source);
    const positions = [];
    for (let step = 1; step <= 13; step++) {
        const idx = (start + step) % CYCLE.length;
        positions.push(CYCLE[idx]);
    }
    return positions;
}

function opponentPath(player) {
    if (player === "north") {
        return [
            { player: "south", pitIndex: 6 }, { player: "south", pitIndex: 5 }, { player: "south", pitIndex: 4 },
            { player: "south", pitIndex: 3 }, { player: "south", pitIndex: 2 }, { player: "south", pitIndex: 1 },
            { player: "south", pitIndex: 0 }
        ];
    } else {
        return [
            { player: "north", pitIndex: 0 }, { player: "north", pitIndex: 1 }, { player: "north", pitIndex: 2 },
            { player: "north", pitIndex: 3 }, { player: "north", pitIndex: 4 }, { player: "north", pitIndex: 5 },
            { player: "north", pitIndex: 6 }
        ];
    }
}

// SEMAINES
function sowNormal(state, player, pitIndex) {
    const seeds = state.board[player][pitIndex];
    const source = { player, pitIndex };
    const visited = [];
    state.board[player][pitIndex] = 0;
    const path = nextPositionsAfter(source);
    for (let i = 0; i < seeds; i++) {
        const pos = path[i];
        state.board[pos.player][pos.pitIndex] += 1;
        visited.push(pos);
    }
    return { visited, lastPosition: visited[visited.length-1], specialCapture: 0 };
}

function sowGranary(state, player, pitIndex) {
    const seeds = state.board[player][pitIndex];
    const source = { player, pitIndex };
    const visited = [];
    let remaining = seeds;
    let specialCapture = 0;
    state.board[player][pitIndex] = 0;
    // tour complet sur 13 cases (toutes sauf source)
    const fullCycle = nextPositionsAfter(source);
    for (let i = 0; i < fullCycle.length && remaining > 0; i++) {
        state.board[fullCycle[i].player][fullCycle[i].pitIndex] += 1;
        visited.push(fullCycle[i]);
        remaining--;
    }
    // reste dans le camp adverse
    const advPath = opponentPath(player);
    let idx = 0;
    while (remaining > 0) {
        const pos = advPath[idx % advPath.length];
        const isLast = (remaining === 1);
        if (isLast && samePosition(pos, opponentFirstPit(player))) {
            specialCapture++;
            visited.push(pos);
        } else {
            state.board[pos.player][pos.pitIndex] += 1;
            visited.push(pos);
        }
        remaining--;
        idx++;
    }
    return { visited, lastPosition: visited[visited.length-1], specialCapture };
}

function sow(state, player, pitIndex) {
    const seeds = state.board[player][pitIndex];
    if (seeds <= 0) throw new Error("Case vide");
    if (seeds <= 13) return sowNormal(state, player, pitIndex);
    return sowGranary(state, player, pitIndex);
}

// CAPTURES
function isCaptureValue(count) {
    return count === 2 || count === 3 || count === 4;
}

function canStartCapture(state, player, lastPosition) {
    if (!isOpponentPit(player, lastPosition)) return false;
    if (samePosition(lastPosition, opponentFirstPit(player))) return false;
    const count = state.board[lastPosition.player][lastPosition.pitIndex];
    return isCaptureValue(count);
}

function captureChainPositions(state, player, lastPosition) {
    const path = opponentPath(player);
    const lastIdx = path.findIndex(p => samePosition(p, lastPosition));
    if (lastIdx < 0) return [];
    const captured = [];
    for (let i = lastIdx; i >= 0; i--) {
        const pos = path[i];
        const count = state.board[pos.player][pos.pitIndex];
        if (!isCaptureValue(count)) break;
        captured.push({ player: pos.player, pitIndex: pos.pitIndex, seeds: count });
    }
    return captured;
}

function wouldEmptyOpponent(state, player, captureList) {
    const opp = other(player);
    const remaining = [...state.board[opp]];
    for (const cap of captureList) {
        remaining[cap.pitIndex] -= cap.seeds;
    }
    return sum(remaining) === 0;
}

function applyCaptureIfAllowed(state, player, captureList) {
    if (captureList.length === 0) return 0;
    if (wouldEmptyOpponent(state, player, captureList)) return 0;
    let total = 0;
    for (const cap of captureList) {
        state.board[cap.player][cap.pitIndex] -= cap.seeds;
        total += cap.seeds;
    }
    state.scores[player] += total;
    return total;
}

function resolveCaptures(state, player, sowingResult) {
    if (sowingResult.specialCapture > 0) {
        state.scores[player] += sowingResult.specialCapture;
        return { captured: sowingResult.specialCapture, type: "special-granary" };
    }
    const last = sowingResult.lastPosition;
    if (!canStartCapture(state, player, last)) {
        return { captured: 0, type: "none" };
    }
    const captureList = captureChainPositions(state, player, last);
    const captured = applyCaptureIfAllowed(state, player, captureList);
    return { captured, type: captured > 0 && captureList.length > 1 ? "chain" : "normal" };
}

// INTERDICTION CASE D'ATTAQUE
function isAttackPitMove(player, pitIndex) {
    const att = attackPit(player);
    return att.player === player && att.pitIndex === pitIndex;
}

function wouldMoveCapture(state, player, pitIndex) {
    const sim = cloneState(state);
    const sowing = sow(sim, player, pitIndex);
    if (sowing.specialCapture > 0) return true;
    const last = sowing.lastPosition;
    return canStartCapture(sim, player, last);
}

function isForbiddenAttackMove(state, player, pitIndex) {
    if (!isAttackPitMove(player, pitIndex)) return false;
    const seeds = state.board[player][pitIndex];
    if (seeds === 1) return true;
    if (seeds === 2) return !wouldMoveCapture(state, player, pitIndex);
    return false;
}

// SOLIDARITE
function opponentCampIsEmpty(state, player) {
    return sum(state.board[other(player)]) === 0;
}

function countDeliveredToOpponent(state, player, pitIndex) {
    const sim = cloneState(state);
    const before = sum(sim.board[other(player)]);
    sow(sim, player, pitIndex);
    const after = sum(sim.board[other(player)]);
    return after - before;
}

function getSolidarityMoves(state, player) {
    const candidates = ownNonEmptyMoves(state, player);
    const ordinary = candidates.filter(m => !isForbiddenAttackMove(state, player, m.pitIndex));
    const enriched = ordinary.map(m => ({ ...m, delivered: countDeliveredToOpponent(state, player, m.pitIndex) }));
    const atLeastSeven = enriched.filter(m => m.delivered >= 7);
    if (atLeastSeven.length) return atLeastSeven;
    const positive = enriched.filter(m => m.delivered > 0);
    if (positive.length) {
        const maxDel = Math.max(...positive.map(m => m.delivered));
        return positive.filter(m => m.delivered === maxDel);
    }
    const forcedDonation = candidates.filter(m => isAttackPitMove(player, m.pitIndex) && [1,2].includes(state.board[player][m.pitIndex]));
    return forcedDonation.map(m => ({ ...m, forcedDonation: true }));
}

// COUPS LEGAUX
function ownNonEmptyMoves(state, player) {
    const moves = [];
    for (let i = 0; i < 7; i++) {
        if (state.board[player][i] > 0) moves.push({ player, pitIndex: i });
    }
    return moves;
}

function getLegalMoves(state) {
    const player = state.currentPlayer;
    if (state.status !== "playing") return [];
    if (opponentCampIsEmpty(state, player)) {
        return getSolidarityMoves(state, player);
    }
    return ownNonEmptyMoves(state, player).filter(m => !isForbiddenAttackMove(state, player, m.pitIndex));
}

// DON FORCE
function applyForcedDonation(state, player, pitIndex) {
    const seeds = state.board[player][pitIndex];
    state.board[player][pitIndex] = 0;
    state.scores[other(player)] += seeds;
    return { type: "forced-donation", donated: seeds };
}

// VALIDATION
function validateMove(state, move) {
    if (state.status !== "playing") return { ok: false, reason: "Partie terminée." };
    if (move.player !== state.currentPlayer) return { ok: false, reason: "Ce n'est pas votre tour." };
    if (move.pitIndex < 0 || move.pitIndex > 6) return { ok: false, reason: "Case invalide." };
    if (state.board[move.player][move.pitIndex] <= 0) return { ok: false, reason: "Case vide." };
    const legalMoves = getLegalMoves(state);
    const legal = legalMoves.some(lm => lm.player === move.player && lm.pitIndex === move.pitIndex);
    if (!legal) return { ok: false, reason: "Coup interdit par les règles." };
    return { ok: true };
}

// CLONE
function cloneState(state) {
    return {
        board: {
            north: [...state.board.north],
            south: [...state.board.south]
        },
        scores: { ...state.scores },
        currentPlayer: state.currentPlayer,
        status: state.status,
        winner: state.winner,
        reason: state.reason,
        moveNumber: state.moveNumber,
        history: [...state.history]
    };
}

// FIN DE PARTIE
function collectRemainingSeeds(state) {
    state.scores.north += sum(state.board.north);
    state.scores.south += sum(state.board.south);
    state.board.north = [0,0,0,0,0,0,0];
    state.board.south = [0,0,0,0,0,0,0];
}

function computeWinnerStrict40OrDraw(state) {
    if (state.scores.north >= 40) return "north";
    if (state.scores.south >= 40) return "south";
    return "draw";
}

function resolveEndGameAfterMove(state) {
    if (state.scores.north >= 40 || state.scores.south >= 40) {
        state.status = "ended";
        state.reason = "score_40";
        state.winner = computeWinnerStrict40OrDraw(state);
        return;
    }
    if (boardSeeds(state) < 10) {
        collectRemainingSeeds(state);
        state.status = "ended";
        state.reason = "low_board";
        state.winner = computeWinnerStrict40OrDraw(state);
    }
}

function resolveEndGameBeforeTurn(state) {
    const legalMoves = getLegalMoves(state);
    if (legalMoves.length === 0) {
        collectRemainingSeeds(state);
        state.status = "ended";
        state.reason = "solidarity_impossible";
        state.winner = computeWinnerStrict40OrDraw(state);
    }
}

function assertTotalSeeds(state) {
    const total = totalSeeds(state);
    if (total !== 70) console.error(`Invariant violation: ${total} au lieu de 70`);
}

// APPLICATION D'UN COUP COMPLET
function applyMove(state, move) {
    const validation = validateMove(state, move);
    if (!validation.ok) return { state, ok: false, error: validation.reason };
    const legalMove = getLegalMoves(state).find(m => m.player === move.player && m.pitIndex === move.pitIndex);
    let actionResult;
    if (legalMove && legalMove.forcedDonation) {
        actionResult = applyForcedDonation(state, move.player, move.pitIndex);
    } else {
        const sowing = sow(state, move.player, move.pitIndex);
        const capture = resolveCaptures(state, move.player, sowing);
        actionResult = { type: "sow", sowing, capture };
    }
    state.moveNumber++;
    state.history.push({ moveNumber: state.moveNumber, player: move.player, pitIndex: move.pitIndex, result: actionResult });
    resolveEndGameAfterMove(state);
    if (state.status === "playing") {
        state.currentPlayer = other(state.currentPlayer);
        resolveEndGameBeforeTurn(state);
    }
    assertTotalSeeds(state);
    return { state, ok: true, action: actionResult };
}

// CREATION D'UNE PARTIE
function createGame(startingPlayer = "south") {
    return {
        board: {
            north: [5,5,5,5,5,5,5],
            south: [5,5,5,5,5,5,5]
        },
        scores: { north: 0, south: 0 },
        currentPlayer: startingPlayer,
        status: "playing",
        winner: null,
        reason: null,
        moveNumber: 0,
        history: []
    };
}

// Exporter pour Node ou global pour navigateur
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createGame, applyMove, getLegalMoves, other, cloneState, boardSeeds, totalSeeds };
} else {
    window.SonghoEngine = { createGame, applyMove, getLegalMoves, other, cloneState, boardSeeds, totalSeeds };
}

