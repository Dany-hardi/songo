<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$file = __DIR__ . '/game_state.json';

$reset = array(
    'board'         => array(
        array(5, 5, 5, 5, 5, 5, 5),
        array(5, 5, 5, 5, 5, 5, 5)
    ),
    'scores'        => array(0, 0),
    'currentPlayer' => 0,
    'gameOver'      => false,
    'winner'        => null,
    'message'       => 'Partie arretee. En attente des joueurs.',
    'players'       => array(false, false),
    'lastUpdate'    => time(),
    'reset'         => true
);

$written = file_put_contents($file, json_encode($reset));

if ($written === false) {
    http_response_code(500);
    echo json_encode(array('error' => 'Impossible de reinitialiser.'));
    exit;
}

echo json_encode(array('success' => true, 'state' => $reset));
