/*
 * songo-logic.js
 * Logique pure du jeu Songo — aucune dépendance DOM.
 *
 * Circuit (du point de vue du joueur courant) :
 *   positions 0-6  : son camp, de la case 7 (pos 0) vers la case 1 (pos 6)
 *   positions 7-13 : camp adverse, de la case 1 (pos 7) vers la case 7 (pos 13)
 *
 *   board[0] = SUD  (index 0 = case 1)
 *   board[1] = NORD (index 0 = case 1)
 */

var SongoLogic = (function () {

    var CASES  = 7;
    var CIRCUIT = 14;
    var WIN    = 40;
    var LOW    = 10;

    function circuitToBoard(player, pos) {
        var p = ((pos % CIRCUIT) + CIRCUIT) % CIRCUIT;
        if (player === 0) {
            if (p <= 6) return { row: 0, col: 6 - p };
            return { row: 1, col: p - 7 };
        } else {
            if (p <= 6) return { row: 1, col: 6 - p };
            return { row: 0, col: p - 7 };
        }
    }

    function getCell(board, player, pos) {
        var rc = circuitToBoard(player, pos);
        return board[rc.row][rc.col];
    }

    function setCell(board, player, pos, val) {
        var rc = circuitToBoard(player, pos);
        board[rc.row][rc.col] = val;
    }

    function addCell(board, player, pos, val) {
        var rc = circuitToBoard(player, pos);
        board[rc.row][rc.col] += val;
    }

    function isAdverse(pos) {
        return ((pos % CIRCUIT) + CIRCUIT) % CIRCUIT >= 7;
    }

    function isCase1Adverse(pos) {
        return ((pos % CIRCUIT) + CIRCUIT) % CIRCUIT === 7;
    }

    function startPos(caseIndex) {
        return CASES - 1 - caseIndex;
    }

    function seedsReachingOpponent(board, player, caseIndex) {
        var start  = startPos(caseIndex);
        var seeds  = board[player][caseIndex];
        var count  = 0;
        for (var k = 1; k <= seeds; k++) {
            if (isAdverse((start + k) % CIRCUIT)) count++;
        }
        return count;
    }

    function getLegalMoves(board, player) {
        var moves = [];
        for (var i = 0; i < CASES; i++) {
            if (board[player][i] === 0) continue;
            if (i === 6 && (board[player][6] === 1 || board[player][6] === 2)) continue;
            moves.push(i);
        }
        return moves;
    }

    function wouldEmptyOpponent(board, player, lastPos) {
        var opponent = 1 - player;
        var temp     = board[opponent].slice();
        var pos      = lastPos;

        while (isAdverse(pos) && !isCase1Adverse(pos)) {
            var rc  = circuitToBoard(player, pos);
            var val = board[rc.row][rc.col];
            if (val >= 2 && val <= 4) {
                temp[rc.col] = 0;
                pos = ((pos - 1) + CIRCUIT) % CIRCUIT;
            } else {
                break;
            }
        }

        for (var i = 0; i < temp.length; i++) {
            if (temp[i] !== 0) return false;
        }
        return true;
    }

    /*
     * Joue un coup sur un état cloné.
     * Retourne { success, message, state }
     */
    function play(state, player, caseIndex) {
        if (state.gameOver) {
            return { success: false, message: 'La partie est terminee.' };
        }
        if (state.currentPlayer !== player) {
            return { success: false, message: 'Ce n\'est pas votre tour.' };
        }

        var board    = state.board.map(function (r) { return r.slice(); });
        var scores   = state.scores.slice();
        var opponent = 1 - player;

        if (caseIndex < 0 || caseIndex >= CASES) {
            return { success: false, message: 'Case invalide.' };
        }
        if (board[player][caseIndex] === 0) {
            return { success: false, message: 'Case vide.' };
        }

        // Solidarite
        var oppTotal = 0;
        for (var x = 0; x < CASES; x++) oppTotal += board[opponent][x];

        if (oppTotal === 0) {
            var reaches = [];
            for (var i = 0; i < CASES; i++) {
                reaches.push(board[player][i] > 0
                    ? seedsReachingOpponent(board, player, i) : 0);
            }
            var maxReach = Math.max.apply(null, reaches);
            var myReach  = seedsReachingOpponent(board, player, caseIndex);

            if (maxReach >= 7 && myReach < 7) {
                return { success: false, message: 'Solidarite : distribuez au moins 7 graines chez l\'adversaire.' };
            }
            if (maxReach < 7 && myReach < maxReach) {
                return { success: false, message: 'Solidarite : envoyez le maximum possible (' + maxReach + ') chez l\'adversaire.' };
            }
        }

        // Interdit case 7
        if (caseIndex === 6) {
            var s7 = board[player][6];
            if (s7 === 1 || s7 === 2) {
                board[player][6] = 0;
                scores[opponent] += s7;
                return buildResult(board, scores, opponent, state,
                    'Interdit case 7 : ' + s7 + ' graine(s) donnee(s) a l\'adversaire.');
            }
        }

        // Distribution
        var seeds      = board[player][caseIndex];
        board[player][caseIndex] = 0;

        var start      = startPos(caseIndex);
        var fullTurns  = Math.floor(seeds / CIRCUIT);
        var currentPos = start;

        if (seeds > CIRCUIT - 1) {
            for (var t = 0; t < fullTurns; t++) {
                for (var p = 1; p < CIRCUIT; p++) {
                    addCell(board, player, (start + p) % CIRCUIT, 1);
                }
            }
            seeds -= fullTurns * CIRCUIT;
        }

        for (var k = 1; k <= seeds; k++) {
            var pos = (start + k) % CIRCUIT;
            addCell(board, player, pos, 1);
            currentPos = pos;
        }

        // Recolte
        var harvested = 0;

        if (isCase1Adverse(currentPos) && fullTurns >= 1) {
            var cur = getCell(board, player, currentPos);
            if (cur >= 1) {
                harvested = 1;
                setCell(board, player, currentPos, cur - 1);
                scores[player] += 1;
            }
        } else if (isAdverse(currentPos) && !isCase1Adverse(currentPos)) {
            if (!wouldEmptyOpponent(board, player, currentPos)) {
                var chainPos = currentPos;
                while (isAdverse(chainPos) && !isCase1Adverse(chainPos)) {
                    var val = getCell(board, player, chainPos);
                    if (val >= 2 && val <= 4) {
                        harvested += val;
                        setCell(board, player, chainPos, 0);
                        chainPos = ((chainPos - 1) + CIRCUIT) % CIRCUIT;
                    } else {
                        break;
                    }
                }
                // Case 1 adverse incluse dans la chaine
                if (isCase1Adverse(chainPos)) {
                    var v1 = getCell(board, player, chainPos);
                    if (v1 >= 2 && v1 <= 4) {
                        harvested += v1;
                        setCell(board, player, chainPos, 0);
                    }
                }
                scores[player] += harvested;
            }
        }

        var pname   = player === 0 ? 'SUD' : 'NORD';
        var message = harvested > 0
            ? pname + ' recolte ' + harvested + ' graine(s).'
            : pname + ' joue la case ' + (caseIndex + 1) + '.';

        return buildResult(board, scores, opponent, state, message);
    }

    function buildResult(board, scores, nextPlayer, oldState, message) {
        var newState = {
            board:         board,
            scores:        scores,
            currentPlayer: nextPlayer,
            gameOver:      false,
            winner:        null,
            message:       message,
            players:       oldState.players,
            lastUpdate:    oldState.lastUpdate
        };

        checkEndGame(newState);

        return { success: true, message: newState.message, state: newState };
    }

    function checkEndGame(state) {
        var total = 0;
        for (var r = 0; r < 2; r++) {
            for (var c = 0; c < CASES; c++) total += state.board[r][c];
        }

        if (state.scores[0] >= WIN) {
            state.gameOver = true; state.winner = 0;
            state.message  = 'SUD remporte la partie avec ' + state.scores[0] + ' graines !';
            return;
        }
        if (state.scores[1] >= WIN) {
            state.gameOver = true; state.winner = 1;
            state.message  = 'NORD remporte la partie avec ' + state.scores[1] + ' graines !';
            return;
        }

        if (total < LOW) {
            state.scores[0] += sumRow(state.board[0]);
            state.scores[1] += sumRow(state.board[1]);
            state.board      = [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]];
            state.gameOver   = true;
            determineWinner(state);
            return;
        }

        // Solidarite impossible
        var opp      = 1 - state.currentPlayer;
        var oppTotal = sumRow(state.board[opp]);
        if (oppTotal === 0) {
            var cur     = state.currentPlayer;
            var canFeed = false;
            for (var i = 0; i < CASES; i++) {
                if (state.board[cur][i] > 0 &&
                    seedsReachingOpponent(state.board, cur, i) > 0) {
                    canFeed = true; break;
                }
            }
            if (!canFeed) {
                state.scores[0] += sumRow(state.board[0]);
                state.scores[1] += sumRow(state.board[1]);
                state.board      = [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]];
                state.gameOver   = true;
                determineWinner(state);
            }
        }
    }

    function determineWinner(state) {
        if (state.scores[0] >= WIN) {
            state.winner  = 0;
            state.message = 'SUD remporte la partie avec ' + state.scores[0] + ' graines !';
        } else if (state.scores[1] >= WIN) {
            state.winner  = 1;
            state.message = 'NORD remporte la partie avec ' + state.scores[1] + ' graines !';
        } else {
            state.winner  = 'draw';
            state.message = 'Partie nulle — SUD : ' + state.scores[0] + ' / NORD : ' + state.scores[1];
        }
    }

    function sumRow(row) {
        var s = 0;
        for (var i = 0; i < row.length; i++) s += row[i];
        return s;
    }

    return {
        play:          play,
        getLegalMoves: getLegalMoves,
        sumRow:        sumRow
    };

})();
