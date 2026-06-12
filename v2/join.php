<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('error' => 'Methode non autorisee.'));
    exit;
}

$file = __DIR__ . '/game_state.json';

$raw = '';
$input = fopen('php://input', 'r');
while ($chunk = fread($input, 1024)) {
    $raw .= $chunk;
}
fclose($input);

$data = json_decode($raw, true);

if ($data === null || !isset($data['player'])) {
    http_response_code(400);
    echo json_encode(array('error' => 'Parametre player manquant.'));
    exit;
}

$player = (int) $data['player'];

if ($player !== 0 && $player !== 1) {
    http_response_code(400);
    echo json_encode(array('error' => 'Player doit etre 0 (SUD) ou 1 (NORD).'));
    exit;
}

$content = file_get_contents($file);
$state   = json_decode($content, true);

if ($state === null) {
    http_response_code(500);
    echo json_encode(array('error' => 'Etat corrompu.'));
    exit;
}

if ($state['players'][$player] === true) {
    echo json_encode(array('success' => false, 'message' => 'Ce camp est deja pris.', 'state' => $state));
    exit;
}

$state['players'][$player] = true;
$state['lastUpdate']       = time();

if ($state['players'][0] === true && $state['players'][1] === true) {
    $state['message'] = 'Les deux joueurs sont connectes. SUD joue en premier.';
}

file_put_contents($file, json_encode($state));

echo json_encode(array('success' => true, 'player' => $player, 'state' => $state));
