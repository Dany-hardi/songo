/*
 * Songo - Logique du jeu
 * Version 1 : deux joueurs, même machine
 *
 * Conventions de représentation :
 *   board[0][0..6] = rangée du joueur SUD (cases 1 à 7, de droite à gauche)
 *   board[1][0..6] = rangée du joueur NORD (cases 1 à 7, de gauche à droite)
 *
 *   L'index 0 correspond toujours à la case n°1 (la "case protégée" de chaque joueur).
 *   La distribution se fait : droite → gauche dans son camp, gauche → droite chez l'adversaire.
 *   On modélise cela avec un tableau circulaire de 14 positions.
 *
 *   Positions dans le circuit pour SUD (currentPlayer = 0) :
 *     0-6  → board[0][6], board[0][5], ..., board[0][0]  (son camp, droite→gauche)
 *     7-13 → board[1][0], board[1][1], ..., board[1][6]  (camp adverse, gauche→droite)
 *
 *   Positions dans le circuit pour NORD (currentPlayer = 1) :
 *     0-6  → board[1][6], board[1][5], ..., board[1][0]
 *     7-13 → board[0][0], board[0][1], ..., board[0][6]
 */

const TOTAL_SEEDS = 70;
const WIN_THRESHOLD = 40;
const END_GAME_SEEDS = 10;
const CASES_PER_PLAYER = 7;
const CIRCUIT_SIZE = 14;

class SongoGame {
    constructor() {
        this.reset();
    }

    reset() {
        // 5 graines dans chaque case au départ
        this.board = [
            [5, 5, 5, 5, 5, 5, 5], // SUD : index 0 = case 1
            [5, 5, 5, 5, 5, 5, 5], // NORD : index 0 = case 1
        ];
        this.scores = [0, 0];       // graines récoltées par chaque joueur
        this.currentPlayer = 0;     // 0 = SUD, 1 = NORD
        this.gameOver = false;
        this.winner = null;         // 0, 1, ou 'draw'
        this.message = "";
        this.lastMove = null;       // { player, caseIndex, harvested }
    }

    /*
     * Convertit un index de case (0-6) du joueur courant
     * en position de départ dans le circuit.
     * Le circuit part de la case 7 du joueur (index 6) et va vers la case 1.
     */
    caseToCircuitStart(player, caseIndex) {
        // Position dans le circuit = distance depuis la case 7 du joueur
        // Case 7 (index 6) → position 0
        // Case 1 (index 0) → position 6
        return CASES_PER_PLAYER - 1 - caseIndex;
    }

    /*
     * Retourne la valeur du plateau à la position `pos` dans le circuit
     * du point de vue du joueur `player`.
     */
    circuitGet(player, pos) {
        const [row, col] = this.circuitToBoard(player, pos);
        return this.board[row][col];
    }

    circuitSet(player, pos, value) {
        const [row, col] = this.circuitToBoard(player, pos);
        this.board[row][col] = value;
    }

    circuitAdd(player, pos, value) {
        const [row, col] = this.circuitToBoard(player, pos);
        this.board[row][col] += value;
    }

    /*
     * Conversion position-circuit → [row, col] dans board[][].
     */
    circuitToBoard(player, pos) {
        const p = ((pos % CIRCUIT_SIZE) + CIRCUIT_SIZE) % CIRCUIT_SIZE;
        if (player === 0) {
            if (p <= 6) return [0, 6 - p];           // camp SUD, droite→gauche
            return [1, p - 7];                        // camp NORD, gauche→droite
        } else {
            if (p <= 6) return [1, 6 - p];           // camp NORD, droite→gauche
            return [0, p - 7];                        // camp SUD, gauche→droite
        }
    }

    /*
     * Indique si une position du circuit appartient au camp adverse.
     */
    isAdversarySide(pos) {
        const p = ((pos % CIRCUIT_SIZE) + CIRCUIT_SIZE) % CIRCUIT_SIZE;
        return p >= 7;
    }

    /*
     * Indique si une position correspond à la case n°1 adverse
     * (la plus protégée : pos 7 dans le circuit).
     */
    isAdversaryCase1(pos) {
        const p = ((pos % CIRCUIT_SIZE) + CIRCUIT_SIZE) % CIRCUIT_SIZE;
        return p === 7;
    }

    /*
     * Vérifie si un coup est légal depuis la case `caseIndex` (0-6).
     */
    isLegalMove(player, caseIndex) {
        if (this.board[player][caseIndex] === 0) return false;

        // Interdit : semer 1 ou 2 graines uniquement via la case 7 (index 6)
        // sauf si la solidarité l'impose
        if (caseIndex === 6) {
            const seeds = this.board[player][caseIndex];
            if (seeds === 1 || seeds === 2) return false;
        }

        return true;
    }

    /*
     * Retourne tous les coups jouables pour le joueur courant.
     */
    getLegalMoves(player) {
        const moves = [];
        for (let i = 0; i < CASES_PER_PLAYER; i++) {
            if (this.board[player][i] > 0 && this.isLegalMove(player, i)) {
                moves.push(i);
            }
        }
        return moves;
    }

    /*
     * Vérifie si le joueur `player` peut respecter la règle de solidarité :
     * distribuer au moins 7 graines dans le camp adverse.
     */
    canFeedOpponent(player, minSeeds = 7) {
        for (let i = 0; i < CASES_PER_PLAYER; i++) {
            if (this.board[player][i] === 0) continue;
            const reach = this.countSeedsInOpponentTerritory(player, i);
            if (reach >= minSeeds) return true;
        }
        return false;
    }

    /*
     * Compte le nombre de graines qui atterriraient chez l'adversaire
     * si on joue la case `caseIndex`.
     */
    countSeedsInOpponentTerritory(player, caseIndex) {
        const start = this.caseToCircuitStart(player, caseIndex);
        const seeds = this.board[player][caseIndex];
        let count = 0;
        for (let k = 1; k <= seeds; k++) {
            let pos = (start + k) % CIRCUIT_SIZE;
            if (this.isAdversarySide(pos)) count++;
        }
        return count;
    }

    /*
     * Joue un coup depuis la case `caseIndex` pour le joueur courant.
     * Retourne { success, message }.
     */
    play(caseIndex) {
        if (this.gameOver) return { success: false, message: "La partie est terminée." };

        const player = this.currentPlayer;
        const opponent = 1 - player;

        // Validation de base
        if (caseIndex < 0 || caseIndex >= CASES_PER_PLAYER) {
            return { success: false, message: "Case invalide." };
        }
        if (this.board[player][caseIndex] === 0) {
            return { success: false, message: "Cette case est vide." };
        }

        // Vérification solidarité : si le camp adverse est vide
        const opponentTotal = this.board[opponent].reduce((a, b) => a + b, 0);
        if (opponentTotal === 0) {
            const maxReach = Math.max(...Array.from({ length: CASES_PER_PLAYER }, (_, i) =>
                this.board[player][i] > 0 ? this.countSeedsInOpponentTerritory(player, i) : 0
            ));

            if (maxReach >= 7) {
                // Doit distribuer au moins 7 graines
                const reach = this.countSeedsInOpponentTerritory(player, caseIndex);
                if (reach < 7) {
                    return { success: false, message: "Solidarité : vous devez jouer un coup qui distribue au moins 7 graines chez l'adversaire." };
                }
            } else {
                // Doit maximiser les graines envoyées
                const maxPossible = Math.max(...Array.from({ length: CASES_PER_PLAYER }, (_, i) =>
                    this.board[player][i] > 0 ? this.countSeedsInOpponentTerritory(player, i) : 0
                ));
                const reach = this.countSeedsInOpponentTerritory(player, caseIndex);
                if (reach < maxPossible) {
                    return { success: false, message: `Solidarité : vous devez maximiser les graines envoyées chez l'adversaire (max possible : ${maxPossible}).` };
                }
            }
        }

        // Vérification interdit case 7 (index 6)
        if (caseIndex === 6) {
            const seeds = this.board[player][caseIndex];
            if (seeds === 1 || seeds === 2) {
                // Seule exception : solidarité impose ce coup
                // Dans ce cas les graines vont à l'adversaire
                this.board[player][caseIndex] = 0;
                this.scores[opponent] += seeds;
                this.message = `Interdit : la case 7 ne peut semer 1 ou 2 graines. Graines données à l'adversaire.`;
                this.switchPlayer();
                this.checkEndGame();
                return { success: true, message: this.message };
            }
        }

        // --- Distribution ---
        let seeds = this.board[player][caseIndex];
        this.board[player][caseIndex] = 0;

        const startPos = this.caseToCircuitStart(player, caseIndex);
        let currentPos = startPos;
        let fullTurns = Math.floor(seeds / CIRCUIT_SIZE);

        // Si > 13 graines : tour(s) complet(s) sans remplir la case de départ
        if (seeds > CIRCUIT_SIZE - 1) {
            // Distribuer fullTurns fois dans toutes les cases sauf la case de départ
            for (let t = 0; t < fullTurns; t++) {
                for (let p = 1; p < CIRCUIT_SIZE; p++) {
                    const pos = (startPos + p) % CIRCUIT_SIZE;
                    this.circuitAdd(player, pos, 1);
                }
            }
            seeds = seeds - fullTurns * CIRCUIT_SIZE;
            // Les graines restantes se distribuent normalement depuis startPos
        }

        // Distribution des graines restantes
        for (let k = 1; k <= seeds; k++) {
            const pos = (startPos + k) % CIRCUIT_SIZE;
            this.circuitAdd(player, pos, 1);
            currentPos = pos;
        }

        // --- Récolte ---
        let harvested = 0;

        // Cas spécial : distribution se termine en case 1 adverse après tour complet
        if (this.isAdversaryCase1(currentPos) && fullTurns >= 1) {
            harvested += 1;
            this.circuitSet(player, currentPos, this.circuitGet(player, currentPos) - 1);
            this.scores[player] += 1;
        } else if (this.isAdversarySide(currentPos) && !this.isAdversaryCase1(currentPos)) {
            // Vérification que le coup ne vide pas entièrement le camp adverse (interdit)
            const wouldEmpty = this.wouldEmptyOpponent(player, currentPos);

            if (!wouldEmpty) {
                // Prise à la chaîne depuis currentPos vers la droite (vers case 1 adverse)
                let pos = currentPos;
                while (this.isAdversarySide(pos) && !this.isAdversaryCase1(pos)) {
                    const val = this.circuitGet(player, pos);
                    if (val >= 2 && val <= 4) {
                        harvested += val;
                        this.circuitSet(player, pos, 0);
                        pos = ((pos - 1) + CIRCUIT_SIZE) % CIRCUIT_SIZE;
                    } else {
                        break;
                    }
                }
                // Vérification post-chaîne : si la case 1 adverse est incluse dans la chaîne
                // (elle l'est uniquement si la chaîne l'a atteinte), on peut prendre ses graines
                if (this.isAdversaryCase1(pos)) {
                    const val = this.circuitGet(player, pos);
                    if (val >= 2 && val <= 4) {
                        harvested += val;
                        this.circuitSet(player, pos, 0);
                    }
                }
                this.scores[player] += harvested;
            }
        }

        this.lastMove = { player, caseIndex, harvested };
        this.message = harvested > 0
            ? `Joueur ${player === 0 ? "SUD" : "NORD"} récolte ${harvested} graine(s).`
            : `Joueur ${player === 0 ? "SUD" : "NORD"} joue la case ${caseIndex + 1}.`;

        this.switchPlayer();
        this.checkEndGame();

        return { success: true, message: this.message };
    }

    /*
     * Simule une récolte et vérifie si elle viderait entièrement le camp adverse.
     */
    wouldEmptyOpponent(player, lastPos) {
        const opponent = 1 - player;
        // Compter les graines restantes dans le camp adverse si on prend à la chaîne
        let tempBoard = this.board[opponent].slice();

        let pos = lastPos;
        while (this.isAdversarySide(pos) && !this.isAdversaryCase1(pos)) {
            const [row, col] = this.circuitToBoard(player, pos);
            const val = this.board[row][col];
            if (val >= 2 && val <= 4) {
                tempBoard[col] = 0;
                pos = ((pos - 1) + CIRCUIT_SIZE) % CIRCUIT_SIZE;
            } else {
                break;
            }
        }

        return tempBoard.every(v => v === 0);
    }

    switchPlayer() {
        this.currentPlayer = 1 - this.currentPlayer;
    }

    /*
     * Vérifie les conditions de fin de partie.
     */
    checkEndGame() {
        const totalOnBoard = this.board[0].reduce((a, b) => a + b, 0)
            + this.board[1].reduce((a, b) => a + b, 0);

        // Victoire immédiate : 40 graines ou plus
        if (this.scores[0] >= WIN_THRESHOLD) {
            this.gameOver = true;
            this.winner = 0;
            this.message = "SUD remporte la partie avec " + this.scores[0] + " graines !";
            return;
        }
        if (this.scores[1] >= WIN_THRESHOLD) {
            this.gameOver = true;
            this.winner = 1;
            this.message = "NORD remporte la partie avec " + this.scores[1] + " graines !";
            return;
        }

        // Moins de 10 graines sur le plateau
        if (totalOnBoard < END_GAME_SEEDS) {
            this.scores[0] += this.board[0].reduce((a, b) => a + b, 0);
            this.scores[1] += this.board[1].reduce((a, b) => a + b, 0);
            this.board = [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]];
            this.gameOver = true;
            this.determineWinner();
            return;
        }

        // Vérification solidarité impossible
        const opponent = 1 - this.currentPlayer;
        const opponentTotal = this.board[opponent].reduce((a, b) => a + b, 0);
        if (opponentTotal === 0) {
            const canFeed = this.canFeedOpponentAtAll();
            if (!canFeed) {
                // Graines restantes reviennent à leur propriétaire
                this.scores[0] += this.board[0].reduce((a, b) => a + b, 0);
                this.scores[1] += this.board[1].reduce((a, b) => a + b, 0);
                this.board = [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]];
                this.gameOver = true;
                this.determineWinner();
            }
        }
    }

    canFeedOpponentAtAll() {
        const player = this.currentPlayer;
        for (let i = 0; i < CASES_PER_PLAYER; i++) {
            if (this.board[player][i] > 0) {
                if (this.countSeedsInOpponentTerritory(player, i) > 0) return true;
            }
        }
        return false;
    }

    determineWinner() {
        if (this.scores[0] >= WIN_THRESHOLD) {
            this.winner = 0;
            this.message = "SUD remporte la partie avec " + this.scores[0] + " graines !";
        } else if (this.scores[1] >= WIN_THRESHOLD) {
            this.winner = 1;
            this.message = "NORD remporte la partie avec " + this.scores[1] + " graines !";
        } else {
            this.winner = 'draw';
            this.message = "Partie nulle. SUD : " + this.scores[0] + " — NORD : " + this.scores[1];
        }
    }

    getState() {
        return {
            board: this.board.map(row => [...row]),
            scores: [...this.scores],
            currentPlayer: this.currentPlayer,
            gameOver: this.gameOver,
            winner: this.winner,
            message: this.message,
            legalMoves: this.gameOver ? [] : this.getLegalMoves(this.currentPlayer),
        };
    }
}
