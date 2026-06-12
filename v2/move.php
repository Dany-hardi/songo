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

// Lire le corps de la requete
$raw = '';
$input = fopen('php://input', 'r');
while ($chunk = fread($input, 1024)) {
    $raw .= $chunk;
}
fclose($input);

if (trim($raw) === '') {
    http_response_code(400);
    echo json_encode(array('error' => 'Corps de requete vide.'));
    exit;
}

$data = json_decode($raw, true);

if ($data === null) {
    http_response_code(400);
    echo json_encode(array('error' => 'JSON invalide : ' . json_last_error_msg()));
    exit;
}

if (!isset($data['state'])) {
    http_response_code(400);
    echo json_encode(array('error' => 'Champ state manquant.'));
    exit;
}

$state = $data['state'];
$state['lastUpdate'] = time();

$written = file_put_contents($file, json_encode($state));

if ($written === false) {
    http_response_code(500);
    echo json_encode(array('error' => 'Impossible d ecrire l etat.'));
    exit;
}

echo json_encode(array('success' => true, 'state' => $state));
