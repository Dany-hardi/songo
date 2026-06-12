/*
 * Songo - Interface utilisateur
 * Rendu du plateau, animations, interactions
 */

class SongoUI {
    constructor(game) {
        this.game = game;
        this.selectedCase = null;
        this.animating = false;

        this.boardEl = document.getElementById('songo-board');
        this.messageEl = document.getElementById('game-message');
        this.logEl = document.getElementById('game-log');
        this.turnEl = document.getElementById('current-turn');
        this.scoreNordEl = document.getElementById('score-nord');
        this.scoreSudEl = document.getElementById('score-sud');
        this.newGameBtn = document.getElementById('btn-new-game');

        this.newGameBtn.addEventListener('click', () => this.newGame());
        this.render();
    }

    newGame() {
        this.game.reset();
        this.selectedCase = null;
        this.animating = false;
        this.clearLog();
        this.render();
        this.setMessage("Nouvelle partie. SUD commence.", 'info');
    }

    /*
     * Rendu complet du plateau.
     */
    render() {
        const state = this.game.getState();
        this.renderBoard(state);
        this.renderScores(state);
        this.renderTurnIndicator(state);
        if (state.gameOver) {
            this.renderGameOver(state);
        }
    }

    renderBoard(state) {
        this.boardEl.innerHTML = '';

        // Ligne NORD (joueur 1) — affichée en haut, cases 7→1 de gauche à droite
        const nordRow = document.createElement('div');
        nordRow.className = 'board-row row-nord';

        // Étiquette joueur
        const nordLabel = document.createElement('div');
        nordLabel.className = 'player-label label-nord';
        nordLabel.textContent = 'NORD';
        nordRow.appendChild(nordLabel);

        // Cases NORD : affichées 7..1 (index 6..0)
        for (let i = CASES_PER_PLAYER - 1; i >= 0; i--) {
            const cell = this.createCell(1, i, state);
            nordRow.appendChild(cell);
        }
        this.boardEl.appendChild(nordRow);

        // Séparateur central
        const separator = document.createElement('div');
        separator.className = 'board-separator';
        for (let i = CASES_PER_PLAYER; i >= 1; i--) {
            const num = document.createElement('span');
            num.className = 'case-number-mid';
            num.textContent = i;
            separator.appendChild(num);
        }
        this.boardEl.appendChild(separator);

        // Ligne SUD (joueur 0) — cases 7→1 de gauche à droite (même sens que NORD visuellement)
        const sudRow = document.createElement('div');
        sudRow.className = 'board-row row-sud';

        const sudLabel = document.createElement('div');
        sudLabel.className = 'player-label label-sud';
        sudLabel.textContent = 'SUD';
        sudRow.appendChild(sudLabel);

        // Cases SUD : affichées 7..1 (index 6..0) — la case 7 est à gauche de SUD
        for (let i = CASES_PER_PLAYER - 1; i >= 0; i--) {
            const cell = this.createCell(0, i, state);
            sudRow.appendChild(cell);
        }
        this.boardEl.appendChild(sudRow);
    }

    createCell(player, caseIndex, state) {
        const seeds = state.board[player][caseIndex];
        const isCurrentPlayer = state.currentPlayer === player;
        const isLegal = state.legalMoves.includes(caseIndex);
        const isSelected = this.selectedCase !== null
            && this.selectedCase.player === player
            && this.selectedCase.caseIndex === caseIndex;

        const cell = document.createElement('div');
        cell.className = 'board-cell';

        if (player === 0) cell.classList.add('cell-sud');
        if (player === 1) cell.classList.add('cell-nord');
        if (seeds === 0) cell.classList.add('cell-empty');
        if (isSelected) cell.classList.add('cell-selected');
        if (isCurrentPlayer && isLegal && !state.gameOver && !this.animating) {
            cell.classList.add('cell-playable');
        }

        // Numéro de case
        const caseNum = document.createElement('div');
        caseNum.className = 'cell-number';
        caseNum.textContent = caseIndex + 1;
        cell.appendChild(caseNum);

        // Graines
        const seedsContainer = document.createElement('div');
        seedsContainer.className = 'seeds-container';
        seedsContainer.appendChild(this.renderSeeds(seeds));
        cell.appendChild(seedsContainer);

        // Compteur numérique
        const countEl = document.createElement('div');
        countEl.className = 'seed-count';
        countEl.textContent = seeds;
        cell.appendChild(countEl);

        if (isCurrentPlayer && !state.gameOver && !this.animating) {
            cell.addEventListener('click', () => this.handleCellClick(player, caseIndex));
        }

        return cell;
    }

    /*
     * Dessine les graines sous forme de cercles dans un SVG.
     * Disposition automatique selon le nombre.
     */
    renderSeeds(count) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 60 50');
        svg.setAttribute('class', 'seeds-svg');

        if (count === 0) return svg;

        const display = Math.min(count, 20); // max 20 cercles affichés
        const r = display <= 5 ? 8 : display <= 10 ? 6 : 4;
        const cols = display <= 4 ? display : display <= 9 ? Math.ceil(display / 2) : 5;
        const rows = Math.ceil(display / cols);

        const totalW = cols * (r * 2 + 2);
        const totalH = rows * (r * 2 + 2);
        const offsetX = (60 - totalW) / 2 + r + 1;
        const offsetY = (50 - totalH) / 2 + r + 1;

        for (let k = 0; k < display; k++) {
            const col = k % cols;
            const row = Math.floor(k / cols);
            const cx = offsetX + col * (r * 2 + 2);
            const cy = offsetY + row * (r * 2 + 2);

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', cx);
            circle.setAttribute('cy', cy);
            circle.setAttribute('r', r);
            circle.setAttribute('class', 'seed-circle');
            svg.appendChild(circle);
        }

        // Si plus de 20 graines, indicateur "+"
        if (count > 20) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', '50');
            text.setAttribute('y', '46');
            text.setAttribute('class', 'seed-overflow');
            text.textContent = '+';
            svg.appendChild(text);
        }

        return svg;
    }

    renderScores(state) {
        this.scoreNordEl.textContent = state.scores[1];
        this.scoreSudEl.textContent = state.scores[0];
    }

    renderTurnIndicator(state) {
        if (state.gameOver) {
            this.turnEl.textContent = "Fin de partie";
            this.turnEl.className = 'turn-indicator';
            return;
        }
        const name = state.currentPlayer === 0 ? "SUD" : "NORD";
        this.turnEl.textContent = `Tour de ${name}`;
        this.turnEl.className = `turn-indicator turn-${name.toLowerCase()}`;
    }

    renderGameOver(state) {
        this.setMessage(state.message, 'gameover');
    }

    handleCellClick(player, caseIndex) {
        if (this.animating || this.game.gameOver) return;
        if (player !== this.game.currentPlayer) return;

        const result = this.game.play(caseIndex);

        if (!result.success) {
            this.setMessage(result.message, 'error');
            return;
        }

        this.logMove(result.message);
        this.setMessage(result.message, 'info');
        this.selectedCase = null;
        this.render();
    }

    setMessage(text, type = 'info') {
        this.messageEl.textContent = text;
        this.messageEl.className = `game-message msg-${type}`;
    }

    logMove(text) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.textContent = text;
        this.logEl.insertBefore(entry, this.logEl.firstChild);

        // Garder les 30 dernières entrées
        while (this.logEl.children.length > 30) {
            this.logEl.removeChild(this.logEl.lastChild);
        }
    }

    clearLog() {
        this.logEl.innerHTML = '';
    }
}
