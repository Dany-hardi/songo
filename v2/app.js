/*
 * app.js — Contrôleur principal v2
 * Ajax pur (XMLHttpRequest), polling, rendu du plateau.
 */

(function () {

    var POLL_MS    = 1500;
    var CASES      = 7;
    var moveCount  = 0;

    var myPlayer   = null;
    var pollTimer  = null;
    var lastUpdate = -1;
    var failCount  = 0;
    var MAX_FAILS  = 3;

    /* ============================================================
       Ajax — XMLHttpRequest pur
       ============================================================ */

    function ajaxGet(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url + '?t=' + Date.now(), true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            if (xhr.status === 200) {
                try { callback(null, JSON.parse(xhr.responseText)); }
                catch (e) { callback('Reponse invalide.', null); }
            } else {
                callback('HTTP ' + xhr.status, null);
            }
        };
        xhr.onerror = function () { callback('Erreur reseau.', null); };
        xhr.send();
    }

    function ajaxPost(url, payload, callback) {
        var xhr  = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            if (xhr.status === 200) {
                try { callback(null, JSON.parse(xhr.responseText)); }
                catch (e) { callback('Reponse invalide.', null); }
            } else {
                callback('HTTP ' + xhr.status, null);
            }
        };
        xhr.onerror = function () { callback('Erreur reseau.', null); };
        xhr.send(JSON.stringify(payload));
    }

    /* ============================================================
       Polling
       ============================================================ */

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(function () {
            ajaxGet('state.php', function (err, state) {
                if (err) {
                    failCount++;
                    if (failCount >= MAX_FAILS) setNetStatus('HORS LIGNE', 'offline');
                    return;
                }
                failCount = 0;
                setNetStatus('EN LIGNE', 'online');

                if (state.lastUpdate !== lastUpdate) {
                    lastUpdate = state.lastUpdate;

                    // Detecter un reset synchronise
                    if (state.reset === true) {
                        handleRemoteReset();
                        return;
                    }

                    renderAll(state);
                }
            });
        }, POLL_MS);
    }

    function stopPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    /* ============================================================
       Actions joueur
       ============================================================ */

    function joinGame(player) {
        ajaxPost('join.php', { player: player }, function (err, data) {
            if (err) { showLobbyError('Erreur reseau : ' + err); return; }
            if (!data.success) { showLobbyError(data.message); return; }

            myPlayer   = player;
            lastUpdate = data.state.lastUpdate;

            showGameArea(player);
            renderAll(data.state);
            startPolling();
        });
    }

    function playCase(caseIndex) {
        ajaxGet('state.php', function (err, state) {
            if (err) { setGameStatus('Erreur reseau.', 'error'); return; }

            var result = SongoLogic.play(state, myPlayer, caseIndex);

            if (!result.success) {
                setGameStatus(result.message, 'error');
                return;
            }

            ajaxPost('move.php', { state: result.state }, function (err2, data) {
                if (err2) { setGameStatus('Erreur envoi : ' + err2, 'error'); return; }

                lastUpdate = data.state.lastUpdate;
                addLog(myPlayer, result.message);
                renderAll(data.state);
            });
        });
    }

    function stopGame() {
        if (!confirm('Arrêter la partie et réinitialiser ? Les deux joueurs seront déconnectés.')) return;

        ajaxPost('reset.php', {}, function (err, data) {
            if (err) { alert('Erreur : ' + err); return; }
            resetLocal();
        });
    }

    function newGame() {
        ajaxPost('new_game.php', {}, function (err, data) {
            if (err) { alert('Erreur : ' + err); return; }
            resetLocal();
        });
    }

    function handleRemoteReset() {
        stopPolling();
        resetLocal();
    }

    function resetLocal() {
        stopPolling();
        myPlayer   = null;
        lastUpdate = -1;
        moveCount  = 0;

        clearLog();
        showLobby(null);

        ajaxGet('state.php', function (err, state) {
            if (!err) showLobby(state);
        });
    }

    /* ============================================================
       Rendu
       ============================================================ */

    function renderAll(state) {
        renderBoard(state);
        renderScores(state);
        renderTurnBar(state);
        renderGameStatus(state);
        if (state.gameOver) stopPolling();
    }

    function renderBoard(state) {
        var el = document.getElementById('board');
        el.innerHTML = '';

        var isMyTurn = myPlayer !== null
            && state.currentPlayer === myPlayer
            && !state.gameOver
            && state.players[0] && state.players[1];

        el.appendChild(makeRow(state, 1, isMyTurn));

        var sep = document.createElement('div');
        sep.className = 'sep-row';
        var pad = document.createElement('div');
        pad.className = 'sep-pad';
        sep.appendChild(pad);
        for (var n = CASES; n >= 1; n--) {
            var s = document.createElement('div');
            s.className   = 'sep-num';
            s.textContent = n;
            sep.appendChild(s);
        }
        el.appendChild(sep);

        el.appendChild(makeRow(state, 0, isMyTurn));
    }

    function makeRow(state, player, isMyTurn) {
        var row = document.createElement('div');
        row.className = 'board-row';

        var label = document.createElement('div');
        label.className   = 'row-label ' + (player === 0 ? 'label-sud' : 'label-nord');
        label.textContent = player === 0 ? 'SUD' : 'NORD';
        row.appendChild(label);

        var legal = SongoLogic.getLegalMoves(state.board, player);

        for (var i = CASES - 1; i >= 0; i--) {
            var canPlay = isMyTurn && player === myPlayer && legal.indexOf(i) !== -1;
            row.appendChild(makeCell(state.board[player][i], i, canPlay, player));
        }

        return row;
    }

    function makeCell(seeds, caseIndex, canPlay, player) {
        var cell = document.createElement('div');
        cell.className = 'cell'
            + (player === 1 ? ' cell-nord' : ' cell-sud')
            + (seeds === 0  ? ' cell-empty' : '')
            + (canPlay      ? ' cell-playable' : '');

        var num = document.createElement('span');
        num.className   = 'cell-num';
        num.textContent = caseIndex + 1;
        cell.appendChild(num);

        cell.appendChild(drawSeeds(seeds));

        var count = document.createElement('span');
        count.className   = 'cell-count';
        count.textContent = seeds;
        cell.appendChild(count);

        if (canPlay) {
            (function (ci) {
                cell.addEventListener('click', function () { playCase(ci); });
            })(caseIndex);
        }

        return cell;
    }

    function drawSeeds(count) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 60 52');
        svg.setAttribute('class', 'seeds-svg');

        if (count === 0) return svg;

        var n    = Math.min(count, 20);
        var r    = n <= 4 ? 8 : n <= 9 ? 6.5 : n <= 16 ? 4.5 : 3.5;
        var cols = n <= 3 ? n : n <= 8 ? Math.ceil(n / 2) : n <= 15 ? Math.ceil(n / 3) : 5;
        var rows = Math.ceil(n / cols);
        var gap  = 2;
        var w    = cols * (r * 2 + gap);
        var h    = rows * (r * 2 + gap);
        var ox   = (60 - w) / 2 + r + gap / 2;
        var oy   = (52 - h) / 2 + r + gap / 2;

        for (var k = 0; k < n; k++) {
            var col = k % cols;
            var row = Math.floor(k / cols);
            var c   = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('cx', ox + col * (r * 2 + gap));
            c.setAttribute('cy', oy + row * (r * 2 + gap));
            c.setAttribute('r',  r);
            c.setAttribute('class', 'seed');
            svg.appendChild(c);
        }

        if (count > 20) {
            var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('x', '55'); t.setAttribute('y', '49');
            t.setAttribute('class', 'seed-plus');
            t.textContent = '+';
            svg.appendChild(t);
        }

        return svg;
    }

    function renderScores(state) {
        document.getElementById('score-sud').textContent  = state.scores[0];
        document.getElementById('score-nord').textContent = state.scores[1];

        var pct = Math.round((state.scores[0] / 70) * 100);
        document.getElementById('score-bar-sud').style.width  = pct + '%';
        document.getElementById('score-bar-nord').style.width = (100 - pct) + '%';
    }

    function renderTurnBar(state) {
        var bar  = document.getElementById('turn-bar');
        var text = document.getElementById('turn-text');

        if (state.gameOver) {
            bar.className    = 'turn-bar turn-over';
            text.textContent = 'FIN DE PARTIE';
            return;
        }
        if (!state.players[0] || !state.players[1]) {
            bar.className    = 'turn-bar turn-waiting';
            text.textContent = 'EN ATTENTE DU SECOND JOUEUR...';
            return;
        }
        if (myPlayer !== null && state.currentPlayer === myPlayer) {
            bar.className    = 'turn-bar turn-yours';
            text.textContent = 'VOTRE TOUR — CHOISISSEZ UNE CASE';
        } else {
            var name = state.currentPlayer === 0 ? 'SUD' : 'NORD';
            bar.className    = 'turn-bar turn-theirs';
            text.textContent = 'TOUR DE ' + name + ' — PATIENTEZ...';
        }
    }

    function renderGameStatus(state) {
        if (state.gameOver) {
            setGameStatus(state.message, 'over');
            addLog(state.winner === 0 ? 0 : 1, state.message);
        }
    }

    /* ============================================================
       UI utilitaires
       ============================================================ */

    function showLobby(state) {
        document.getElementById('lobby').style.display     = '';
        document.getElementById('game-area').style.display = 'none';

        var btnSud  = document.getElementById('btn-sud');
        var btnNord = document.getElementById('btn-nord');
        btnSud.disabled  = false; btnSud.textContent  = 'Jouer en SUD';
        btnNord.disabled = false; btnNord.textContent = 'Jouer en NORD';

        // Reconstruire les spans internes
        btnSud.innerHTML  = '<span class="camp-name">▼ SUD</span><span class="camp-info">Rangée du bas · Joue en premier</span>';
        btnNord.innerHTML = '<span class="camp-name">▲ NORD</span><span class="camp-info">Rangée du haut</span>';

        if (state && state.players) {
            if (state.players[0]) {
                btnSud.disabled  = true;
                btnSud.innerHTML = '<span class="camp-name">▼ SUD</span><span class="camp-info">Camp pris</span>';
            }
            if (state.players[1]) {
                btnNord.disabled  = true;
                btnNord.innerHTML = '<span class="camp-name">▲ NORD</span><span class="camp-info">Camp pris</span>';
            }
        }

        document.getElementById('lobby-error').style.display = 'none';
    }

    function showGameArea(player) {
        document.getElementById('lobby').style.display     = 'none';
        document.getElementById('game-area').style.display = '';

        var badge = document.getElementById('player-badge');
        badge.textContent = 'Vous jouez : ' + (player === 0 ? 'SUD' : 'NORD');
        badge.className   = 'player-badge ' + (player === 0 ? 'badge-sud' : 'badge-nord');
    }

    function showLobbyError(msg) {
        var el = document.getElementById('lobby-error');
        el.textContent   = msg;
        el.style.display = '';
    }

    function setGameStatus(msg, type) {
        var el = document.getElementById('game-status');
        el.textContent = msg;
        el.className   = 'game-status status-' + (type || 'info');
    }

    function setNetStatus(msg, type) {
        var el = document.getElementById('net-status');
        el.textContent = msg;
        el.className   = 'net-status net-' + type;
    }

    /* ============================================================
       Journal tableau
       ============================================================ */

    function addLog(player, msg) {
        var tbody = document.getElementById('log-body');

        // Supprimer la ligne d'init si presente
        var initRow = tbody.querySelector('.log-init-row');
        if (initRow) tbody.removeChild(initRow);

        moveCount++;

        var tr  = document.createElement('tr');
        var td1 = document.createElement('td');
        var td2 = document.createElement('td');
        var td3 = document.createElement('td');

        td1.textContent = moveCount;
        td2.textContent = player === 0 ? 'SUD' : 'NORD';
        td3.textContent = msg;

        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);

        tbody.insertBefore(tr, tbody.firstChild);

        // Scroll vers le haut (entrée la plus récente)
        tbody.scrollTop = 0;

        // Garder les 50 dernières entrées
        while (tbody.children.length > 50) tbody.removeChild(tbody.lastChild);
    }

    function clearLog() {
        var tbody = document.getElementById('log-body');
        tbody.innerHTML = '<tr class="log-init-row"><td>—</td><td>—</td><td>Partie initialisée</td></tr>';
        moveCount = 0;
    }

    /* ============================================================
       Init
       ============================================================ */

    function init() {
        document.getElementById('btn-sud').addEventListener('click', function () {
            joinGame(0);
        });
        document.getElementById('btn-nord').addEventListener('click', function () {
            joinGame(1);
        });
        document.getElementById('btn-new-game').addEventListener('click', function () {
            newGame();
        });
        document.getElementById('btn-stop').addEventListener('click', function () {
            stopGame();
        });
        document.getElementById('nav-rules').addEventListener('click', function () {
            var panel = document.getElementById('rules-panel');
            panel.hidden = !panel.hidden;
        });
        document.getElementById('btn-close-rules').addEventListener('click', function () {
            document.getElementById('rules-panel').hidden = true;
        });

        ajaxGet('state.php', function (err, state) {
            if (!err) showLobby(state);
            else showLobby(null);
        });
    }

    window.addEventListener('load', init);

})();
