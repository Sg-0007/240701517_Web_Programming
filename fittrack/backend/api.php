<?php
/**
 * FitTrack backend (PHP + PDO + SQLite)
 *
 * GET  api.php  -> returns the saved FitTrack data: {"data": {...} | null, "updatedAt": "..."}
 * POST api.php  -> saves the JSON body sent by the React app: {"ok": true}
 *
 * Run locally (from the folder that contains this file):
 *     php -S localhost:8000
 * Then the React app reaches it at http://localhost:8000/api.php
 *
 * The database file (fittrack.sqlite) is created automatically next to this file.
 * Requires PHP 7.4+ with the pdo_sqlite extension (enabled by default in XAMPP).
 */

declare(strict_types=1);

// ---- Headers (CORS lets the Vite dev server on another port call this API) ----
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // development only: restrict to your site in production
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

const MAX_BYTES = 2 * 1024 * 1024; // refuse bodies larger than 2 MB

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

// Browsers send an OPTIONS "preflight" request before a cross-origin POST.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---- Database connection and table ----
try {
    $db = new PDO('sqlite:' . __DIR__ . '/fittrack.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    // One row (id = 1) holds the whole app data as JSON text.
    $db->exec(
        'CREATE TABLE IF NOT EXISTS app_data (
            id         INTEGER PRIMARY KEY CHECK (id = 1),
            json       TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )'
    );
} catch (Throwable $e) {
    respond(500, ['error' => 'Database unavailable. Check that pdo_sqlite is enabled and the folder is writable.']);
}

$method = $_SERVER['REQUEST_METHOD'];

// ---- GET: read saved data ----
if ($method === 'GET') {
    try {
        $row = $db->query('SELECT json, updated_at FROM app_data WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        respond(500, ['error' => 'Could not read data.']);
    }

    if (!$row) {
        respond(200, ['data' => null, 'updatedAt' => null]);
    }

    // The stored JSON is echoed as-is so its structure is preserved exactly.
    http_response_code(200);
    echo '{"data":' . $row['json'] . ',"updatedAt":' . json_encode($row['updated_at']) . '}';
    exit;
}

// ---- POST: save data ----
if ($method === 'POST') {
    $raw = file_get_contents('php://input');

    if ($raw === false || $raw === '') {
        respond(400, ['error' => 'Empty request body.']);
    }
    if (strlen($raw) > MAX_BYTES) {
        respond(413, ['error' => 'Data is too large.']);
    }

    $data = json_decode($raw, true);
    if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) {
        respond(400, ['error' => 'Body must be valid JSON.']);
    }

    // Basic shape check: these sections must be lists when present.
    foreach (['customExercises', 'workouts', 'history'] as $key) {
        if (isset($data[$key]) && !is_array($data[$key])) {
            respond(422, ['error' => "\"$key\" must be a list."]);
        }
    }

    try {
        $stmt = $db->prepare(
            'INSERT INTO app_data (id, json, updated_at) VALUES (1, :json, :t)
             ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at'
        );
        $stmt->execute([':json' => $raw, ':t' => gmdate('c')]);
    } catch (Throwable $e) {
        respond(500, ['error' => 'Could not save data.']);
    }

    respond(200, ['ok' => true]);
}

respond(405, ['error' => 'Method not allowed.']);
