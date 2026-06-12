<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Access-Control-Allow-Origin: *');

$file = __DIR__ . '/game_state.json';

if (!file_exists($file)) {
    http_response_code(500);
    echo json_encode(array('error' => 'Fichier etat introuvable.'));
    exit;
}

$content = file_get_contents($file);

if ($content === false || trim($content) === '') {
    http_response_code(500);
    echo json_encode(array('error' => 'Fichier etat vide.'));
    exit;
}

echo $content;
