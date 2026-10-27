<?php


declare(strict_types=1);

// Never print PHP warnings into the response: the React app expects clean JSON.
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // development only: restrict to your site in production
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Auth-Token');

const MAX_BYTES = 2 * 1024 * 1024;   // largest accepted request body
const TOKEN_DAYS = 30;               // how long a login lasts
const MAX_FAILED_LOGINS = 5;         // failed attempts allowed ...
const LOCKOUT_SECONDS = 600;         // ... within this many seconds

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

// Any unexpected error becomes a JSON message instead of a blank page.
set_exception_handler(function (Throwable $e): void {
    respond(500, ['error' => 'Server error.', 'detail' => $e->getMessage()]);
});

function readBody(): string
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        respond(400, ['error' => 'Empty request body.']);
    }
    if (strlen($raw) > MAX_BYTES) {
        respond(413, ['error' => 'Data is too large.']);
    }
    return $raw;
}

function readJson(): array
{
    $data = json_decode(readBody(), true);
    if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) {
        respond(400, ['error' => 'Body must be valid JSON.']);
    }
    return $data;
}

function requireMethod(string $expected): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $expected) {
        respond(405, ['error' => 'Method not allowed.']);
    }
}

// Browsers send an OPTIONS "preflight" request before a cross-origin request with custom headers.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$action = $_GET['action'] ?? '';

// ---- Health check: open api.php?action=health in the browser to diagnose setup problems ----
if ($action === 'health') {
    $drivers = class_exists('PDO') ? PDO::getAvailableDrivers() : [];
    $hasSqlite = in_array('sqlite', $drivers, true);
    $writable = is_writable(__DIR__);
    $problems = [];
    if (PHP_VERSION_ID < 70400) {
        $problems[] = 'PHP 7.4 or newer is required. You have ' . PHP_VERSION . '.';
    }
    if (!$hasSqlite) {
        $problems[] = 'The pdo_sqlite extension is not enabled. In php.ini remove the ";" before extension=pdo_sqlite and extension=sqlite3, then stop and restart the PHP server.';
    }
    if (!$writable) {
        $problems[] = 'The backend folder is not writable, so fittrack.sqlite cannot be created.';
    }
    respond(200, [
        'ok' => count($problems) === 0,
        'phpVersion' => PHP_VERSION,
        'phpIni' => php_ini_loaded_file() ?: 'none loaded (copy php.ini-development to php.ini)',
        'pdoDrivers' => $drivers,
        'folder' => __DIR__,
        'folderWritable' => $writable,
        'problems' => $problems,
    ]);
}

// ---- Database connection and tables ----
try {
    $db = new PDO('sqlite:' . __DIR__ . '/fittrack.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec(
        'CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            created_at    TEXT NOT NULL
        )'
    );
    $db->exec(
        'CREATE TABLE IF NOT EXISTS tokens (
            token_hash TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at INTEGER NOT NULL
        )'
    );
    $db->exec(
        'CREATE TABLE IF NOT EXISTS user_data (
            user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            json       TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )'
    );
    $db->exec(
        'CREATE TABLE IF NOT EXISTS login_attempts (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL COLLATE NOCASE,
            at       INTEGER NOT NULL
        )'
    );
} catch (Throwable $e) {
    // "detail" helps while developing; remove it before putting the site online.
    respond(500, [
        'error' => 'Database unavailable. Open api.php?action=health to see what is missing.',
        'detail' => $e->getMessage(),
    ]);
}

// ---- Helpers that need the database ----
function issueToken(PDO $db, int $userId): string
{
    $db->prepare('DELETE FROM tokens WHERE expires_at < :now')->execute([':now' => time()]);
    $token = bin2hex(random_bytes(32));
    $db->prepare('INSERT INTO tokens (token_hash, user_id, expires_at) VALUES (:h, :u, :e)')->execute([
        ':h' => hash('sha256', $token),
        ':u' => $userId,
        ':e' => time() + TOKEN_DAYS * 86400,
    ]);
    return $token;
}

function headerToken(): string
{
    $token = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
    return preg_match('/^[a-f0-9]{64}$/', (string) $token) === 1 ? (string) $token : '';
}

function requireUser(PDO $db): array
{
    $token = headerToken();
    if ($token === '') {
        respond(401, ['error' => 'Please log in.']);
    }
    $stmt = $db->prepare(
        'SELECT u.id, u.username FROM tokens t JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = :h AND t.expires_at > :now'
    );
    $stmt->execute([':h' => hash('sha256', $token), ':now' => time()]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        respond(401, ['error' => 'Your session has expired. Please log in again.']);
    }
    return $user;
}

// ---- Routing ----
switch ($action) {
    case 'register':
        requireMethod('POST');
        $in = readJson();
        $username = is_string($in['username'] ?? null) ? trim($in['username']) : '';
        $password = is_string($in['password'] ?? null) ? $in['password'] : '';

        if (preg_match('/^[A-Za-z0-9_.-]{3,30}$/', $username) !== 1) {
            respond(422, ['error' => 'Username must be 3 to 30 letters, numbers, dots, dashes or underscores.']);
        }
        if (strlen($password) < 8 || strlen($password) > 72) {
            respond(422, ['error' => 'Password must be 8 to 72 characters.']);
        }

        try {
            $db->prepare('INSERT INTO users (username, password_hash, created_at) VALUES (:u, :p, :t)')->execute([
                ':u' => $username,
                ':p' => password_hash($password, PASSWORD_DEFAULT),
                ':t' => gmdate('c'),
            ]);
        } catch (PDOException $e) {
            // The UNIQUE constraint on username fails if the name is taken.
            respond(409, ['error' => 'That username is already taken. Choose another one.']);
        }
        respond(201, ['token' => issueToken($db, (int) $db->lastInsertId()), 'username' => $username]);
        break;

    case 'login':
        requireMethod('POST');
        $in = readJson();
        $username = is_string($in['username'] ?? null) ? trim($in['username']) : '';
        $password = is_string($in['password'] ?? null) ? $in['password'] : '';
        if ($username === '' || $password === '') {
            respond(422, ['error' => 'Enter your username and password.']);
        }

        // Slow down password guessing: too many recent failures locks the username for a while.
        $stmt = $db->prepare('SELECT COUNT(*) FROM login_attempts WHERE username = :u AND at > :since');
        $stmt->execute([':u' => $username, ':since' => time() - LOCKOUT_SECONDS]);
        if ((int) $stmt->fetchColumn() >= MAX_FAILED_LOGINS) {
            respond(429, ['error' => 'Too many failed attempts. Wait 10 minutes and try again.']);
        }

        $stmt = $db->prepare('SELECT id, username, password_hash FROM users WHERE username = :u');
        $stmt->execute([':u' => $username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            $db->prepare('INSERT INTO login_attempts (username, at) VALUES (:u, :t)')->execute([':u' => $username, ':t' => time()]);
            respond(401, ['error' => 'Incorrect username or password.']);
        }

        $db->prepare('DELETE FROM login_attempts WHERE username = :u')->execute([':u' => $username]);
        respond(200, ['token' => issueToken($db, (int) $user['id']), 'username' => $user['username']]);
        break;

    case 'logout':
        requireMethod('POST');
        $token = headerToken();
        if ($token !== '') {
            $db->prepare('DELETE FROM tokens WHERE token_hash = :h')->execute([':h' => hash('sha256', $token)]);
        }
        respond(200, ['ok' => true]);
        break;

    case 'me':
        requireMethod('GET');
        $user = requireUser($db);
        respond(200, ['username' => $user['username']]);
        break;

    case 'data':
        $user = requireUser($db);

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $stmt = $db->prepare('SELECT json, updated_at FROM user_data WHERE user_id = :id');
            $stmt->execute([':id' => $user['id']]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                respond(200, ['data' => null, 'updatedAt' => null]);
            }
            // The stored JSON is echoed as-is so its structure is preserved exactly.
            http_response_code(200);
            echo '{"data":' . $row['json'] . ',"updatedAt":' . json_encode($row['updated_at']) . '}';
            exit;
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $raw = readBody();
            $data = json_decode($raw, true);
            if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) {
                respond(400, ['error' => 'Body must be valid JSON.']);
            }
            foreach (['customExercises', 'workouts', 'history'] as $key) {
                if (isset($data[$key]) && !is_array($data[$key])) {
                    respond(422, ['error' => "\"$key\" must be a list."]);
                }
            }
            $db->prepare(
                'INSERT OR REPLACE INTO user_data (user_id, json, updated_at) VALUES (:id, :json, :t)'
            )->execute([':id' => $user['id'], ':json' => $raw, ':t' => gmdate('c')]);
            respond(200, ['ok' => true]);
        }

        respond(405, ['error' => 'Method not allowed.']);
        break;

    default:
        respond(404, ['error' => 'Unknown action. Try api.php?action=health']);
}
