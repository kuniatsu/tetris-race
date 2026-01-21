// ゲーム定数
const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const BLOCK_SIZE = 16;
const CANVAS_WIDTH = GRID_WIDTH * BLOCK_SIZE;
const CANVAS_HEIGHT = GRID_HEIGHT * BLOCK_SIZE;

// ゲームフェーズ
const PHASES = {
    DISGUISE: 1,        // 偽装テトリス
    FREE_FALL: 2,       // 自由落下
    ACCELERATION: 3,    // 加速と覚醒
    ENDLESS_DRIFT: 4    // ランダムレース
};

// テトリミノの定義
const TETRIMINOS = {
    I: [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    O: [
        [1, 1, 0, 0],
        [1, 1, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    T: [
        [0, 1, 0, 0],
        [1, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    S: [
        [0, 1, 1, 0],
        [1, 1, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    Z: [
        [1, 1, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    J: [
        [1, 0, 0, 0],
        [1, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    L: [
        [0, 0, 1, 0],
        [1, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ]
};

// テトリミノの色
const COLORS = {
    I: '#00ffff',
    O: '#ffff00',
    T: '#ff00ff',
    S: '#00ff00',
    Z: '#ff0000',
    J: '#0000ff',
    L: '#ff8800'
};

// ゲーム状態
let gameState = {
    phase: PHASES.DISGUISE,
    board: initializeBoard(),
    boardHeight: GRID_HEIGHT, // 動的ボード高さ
    currentPiece: null,
    nextPiece: null,
    score: 0,
    depth: 0,
    depthDistance: 0, // 実際の落下距離
    time: 0,
    gameActive: false,
    gameOver: false,
    startTime: 0,
    phaseStartTime: 0,
    bottomBroken: false,
    gravity: 1,
    fallCounter: 0, // 落下カウンター
    obstacles: [],
    freefall_start_time: 0,
    acceleration_start_time: 0,
    maxYReached: 0, // 最大の深度（最も下に到達したY座標）
    airResistance: 0, // 空気抵抗（0=小、1=大）
    viewportY: 0, // ビューポート上部のY座標（無限スクロール用）
};

// ボード初期化
function initializeBoard() {
    return Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));
}

// ボード拡張（Phase 2以降用）
function expandBoard(newHeight) {
    while (gameState.board.length < newHeight) {
        gameState.board.push(Array(GRID_WIDTH).fill(0));
    }
    gameState.boardHeight = gameState.board.length;
}

// ゲーム開始
function startGame() {
    gameState.board = initializeBoard();
    gameState.boardHeight = GRID_HEIGHT;
    gameState.phase = PHASES.DISGUISE;
    gameState.score = 0;
    gameState.depth = 0;
    gameState.depthDistance = 0;
    gameState.time = 0;
    gameState.gameActive = true;
    gameState.gameOver = false;
    gameState.startTime = Date.now();
    gameState.phaseStartTime = Date.now();
    gameState.bottomBroken = false;
    gameState.gravity = 0.5; // Phase 1は遅い落下速度
    gameState.fallCounter = 0;
    gameState.obstacles = [];
    gameState.freefall_start_time = 0;
    gameState.acceleration_start_time = 0;
    gameState.maxYReached = 0;
    gameState.airResistance = 0;
    gameState.viewportY = 0;

    gameState.currentPiece = createRandomPiece();
    gameState.nextPiece = createRandomPiece();

    updateDisplay();
}

// ランダムなテトリミノ生成
function createRandomPiece() {
    const types = Object.keys(TETRIMINOS);
    const type = types[Math.floor(Math.random() * types.length)];
    return {
        type: type,
        shape: JSON.parse(JSON.stringify(TETRIMINOS[type])),
        x: Math.floor(GRID_WIDTH / 2) - 2,
        y: 0,
        rotation: 0
    };
}

// 回転
function rotatePiece(piece, direction) {
    if (!piece) return;

    const newShape = rotateMatrix(piece.shape, direction);
    const testPiece = { ...piece, shape: newShape };

    // 回転後のスペース確認
    if (canPlacePiece(testPiece)) {
        piece.shape = newShape;

        // Phase 3以降：テトリミノの向きで空気抵抗を決定
        if (gameState.phase >= PHASES.ACCELERATION) {
            // I字が横向きの場合、または他のテトリミノが横向きの場合
            // 簡単な判定：幅が高さより大きい場合は空気抵抗大
            const width = 4;
            const height = 4;
            let hasContent = false;
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    if (newShape[i][j] === 1) {
                        hasContent = true;
                    }
                }
            }
            // 簡易的な判定：I字の場合
            if (piece.type === 'I') {
                gameState.airResistance = 1; // 横向きI字は空気抵抗大
            }
        }

        return true;
    }
    return false;
}

// マトリックス回転
function rotateMatrix(matrix, direction) {
    const newMatrix = Array(4).fill(null).map(() => Array(4).fill(0));
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            if (direction === 1) { // 時計回り
                newMatrix[j][3 - i] = matrix[i][j];
            } else { // 反時計回り
                newMatrix[3 - j][i] = matrix[i][j];
            }
        }
    }
    return newMatrix;
}

// ピース配置可能チェック
function canPlacePiece(piece) {
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            if (piece.shape[i][j] === 0) continue;
            const newX = piece.x + j;
            const newY = piece.y + i;

            // X軸の境界チェック
            if (newX < 0 || newX >= GRID_WIDTH) {
                return false;
            }

            // Y軸の境界チェック（Phase 2以降は動的ボード対応）
            if (gameState.phase === PHASES.DISGUISE) {
                if (newY < 0 || newY >= GRID_HEIGHT) {
                    return false;
                }
            } else {
                // Phase 2以降は上限のみチェック
                if (newY < 0) {
                    return false;
                }
                // ボード下限を超えた場合は拡張
                if (newY >= gameState.board.length) {
                    expandBoard(newY + 5);
                }
            }

            // ボード内容チェック
            if (newY < gameState.board.length && gameState.board[newY][newX] !== 0) {
                return false;
            }
        }
    }
    return true;
}

// ピース移動
function movePiece(dx, dy) {
    if (!gameState.currentPiece) return;

    const newPiece = { ...gameState.currentPiece };
    newPiece.x += dx;
    newPiece.y += dy;

    if (canPlacePiece(newPiece)) {
        gameState.currentPiece = newPiece;

        // 深度スコア計算
        if (dy > 0) {
            gameState.depthDistance += dy;
            // Phase 2以降では落下距離に応じてスコアを加算
            if (gameState.phase >= PHASES.FREE_FALL) {
                gameState.score += dy * 10;
            }
        }

        // 最大の深度を更新
        if (gameState.currentPiece.y > gameState.maxYReached) {
            gameState.maxYReached = gameState.currentPiece.y;
            gameState.depth = Math.floor((gameState.maxYReached + gameState.depthDistance / GRID_HEIGHT) * 10);
        }

        return true;
    }
    return false;
}

// ピース着地
function lockPiece() {
    const piece = gameState.currentPiece;
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            if (piece.shape[i][j] === 0) continue;
            const x = piece.x + j;
            const y = piece.y + i;
            if (y >= 0 && y < GRID_HEIGHT && x >= 0 && x < GRID_WIDTH) {
                gameState.board[y][x] = piece.type;
            }
        }
    }

    // 次のピースを生成
    gameState.currentPiece = gameState.nextPiece;
    gameState.nextPiece = createRandomPiece();

    // 空気抵抗をリセット
    gameState.airResistance = 0;

    // 新しいピースが配置できない場合、ゲームオーバー
    if (!canPlacePiece(gameState.currentPiece)) {
        gameState.gameOver = true;
        gameState.gameActive = false;
    }
}

// ラインクリア判定
function checkLineClears() {
    let linesCleared = 0;
    const rowsToDelete = [];
    let bottomLineCleared = false;

    // 最初にボトムラインをクリアしたかチェック
    if (gameState.phase === PHASES.DISGUISE) {
        const lastRowIndex = GRID_HEIGHT - 1;
        if (gameState.board[lastRowIndex] && gameState.board[lastRowIndex].every(cell => cell !== 0)) {
            bottomLineCleared = true;
        }
    }

    // クリア対象のラインを探す
    for (let row = 0; row < gameState.board.length; row++) {
        if (gameState.board[row].every(cell => cell !== 0)) {
            rowsToDelete.push(row);
            linesCleared++;
        }
    }

    // ラインを削除
    for (let i = rowsToDelete.length - 1; i >= 0; i--) {
        gameState.board.splice(rowsToDelete[i], 1);
        gameState.board.unshift(Array(GRID_WIDTH).fill(0));
    }

    // Phase 1でボトムラインをクリアした場合、底を抜く
    if (bottomLineCleared) {
        gameState.bottomBroken = true;
        transitionToPhase(PHASES.FREE_FALL);
    }

    // スコア加算
    if (linesCleared > 0) {
        gameState.score += linesCleared * 100;
    }

    return linesCleared;
}

// フェーズ遷移
function transitionToPhase(newPhase) {
    gameState.phase = newPhase;
    gameState.phaseStartTime = Date.now();

    switch (newPhase) {
        case PHASES.FREE_FALL:
            gameState.freefall_start_time = Date.now();
            gameState.gravity = 1; // 自由落下は通常速度
            break;
        case PHASES.ACCELERATION:
            gameState.acceleration_start_time = Date.now();
            gameState.gravity = 2; // 加速フェーズは速度2倍
            break;
        case PHASES.ENDLESS_DRIFT:
            gameState.gravity = 3; // エンドレスは速度3倍
            generateObstacles();
            break;
    }
}

// 障害物生成（Phase 4用）
function generateObstacles() {
    gameState.obstacles = [];
    // ランダムな障害物パターンを生成
    for (let y = GRID_HEIGHT; y < GRID_HEIGHT + 50; y++) {
        const patternType = Math.floor(Math.random() * 4);
        const obstacle = generateObstaclePattern(patternType, y);
        gameState.obstacles.push(...obstacle);
    }
}

// 障害物パターン生成
function generateObstaclePattern(type, startY) {
    const obstacles = [];
    switch (type) {
        case 0: // Straight
            if (Math.random() < 0.3) {
                obstacles.push({
                    x: Math.floor(GRID_WIDTH / 2),
                    y: startY,
                    width: 1,
                    height: 2
                });
            }
            break;
        case 1: // Chicane
            const sideX = Math.random() < 0.5 ? 2 : GRID_WIDTH - 3;
            obstacles.push({
                x: sideX,
                y: startY,
                width: 2,
                height: 3
            });
            break;
        case 2: // S-Curve
            if (Math.random() < 0.5) {
                obstacles.push({ x: 1, y: startY, width: 2, height: 2 });
                obstacles.push({ x: GRID_WIDTH - 3, y: startY + 2, width: 2, height: 2 });
            }
            break;
        case 3: // Narrow Gate
            obstacles.push({
                x: 0,
                y: startY,
                width: Math.floor(GRID_WIDTH / 2) - 1,
                height: 1
            });
            obstacles.push({
                x: Math.ceil(GRID_WIDTH / 2) + 1,
                y: startY,
                width: Math.floor(GRID_WIDTH / 2) - 1,
                height: 1
            });
            break;
    }
    return obstacles;
}

// ゲーム更新
function updateGame() {
    if (!gameState.gameActive) return;

    gameState.time = Math.floor((Date.now() - gameState.startTime) / 1000);

    // フェーズ遷移チェック
    if (gameState.phase === PHASES.FREE_FALL) {
        const freefall_time = (Date.now() - gameState.freefall_start_time) / 1000;
        if (freefall_time > 10) {
            transitionToPhase(PHASES.ACCELERATION);
        }
    } else if (gameState.phase === PHASES.ACCELERATION) {
        const acceleration_time = (Date.now() - gameState.acceleration_start_time) / 1000;
        if (acceleration_time > 10) {
            transitionToPhase(PHASES.ENDLESS_DRIFT);
        }
    }

    // Phase 2以降でボード拡張
    if (gameState.phase >= PHASES.FREE_FALL && gameState.currentPiece) {
        const maxPieceY = gameState.currentPiece.y + 4;
        if (maxPieceY >= gameState.board.length - 5) {
            expandBoard(gameState.board.length + 20);
        }
    }

    // 重力適用（落下カウンターを使用）
    gameState.fallCounter += gameState.gravity;

    // 空気抵抗の適用
    let gravity_adjusted = gameState.gravity;
    if (gameState.phase >= PHASES.ACCELERATION && gameState.airResistance === 1) {
        gravity_adjusted = Math.max(1, gameState.gravity * 0.5); // 空気抵抗で減速
    }

    if (gameState.fallCounter >= 1) {
        const steps = Math.floor(gameState.fallCounter);
        gameState.fallCounter -= steps;

        let moved = false;
        for (let i = 0; i < steps; i++) {
            if (movePiece(0, 1)) {
                moved = true;
            } else {
                break;
            }
        }

        if (!moved) {
            lockPiece();
            checkLineClears();
        }
    }

    updateDisplay();
}

// 表示更新
function updateDisplay() {
    document.getElementById('depth-score').textContent = gameState.depth;
    document.getElementById('time-score').textContent = gameState.time;

    // 総スコア = 深度スコア + 時間スコア
    const timeBonus = Math.floor(gameState.time * 5); // 1秒ごとに5ポイント
    const totalScore = gameState.score + timeBonus;
    document.getElementById('total-score').textContent = totalScore;

    const phaseNames = {
        1: 'Phase 1: 偽装テトリス',
        2: 'Phase 2: 自由落下',
        3: 'Phase 3: 加速と覚醒',
        4: 'Phase 4: ランダムレース'
    };
    document.getElementById('phase-indicator').textContent = phaseNames[gameState.phase];

    const statusText = gameState.gameOver ? 'ゲームオーバー' : 'ゲーム進行中';
    document.getElementById('game-status').textContent = statusText;

    // ゲームオーバーモーダル表示
    if (gameState.gameOver) {
        showGameOverModal(totalScore);
    }

    draw();
}

// ゲームオーバーモーダル表示
function showGameOverModal(totalScore) {
    const modal = document.getElementById('game-over-modal');
    if (modal.classList.contains('hidden')) {
        document.getElementById('final-score').textContent = totalScore;
        document.getElementById('final-depth').textContent = gameState.depth;
        document.getElementById('final-time').textContent = gameState.time;
        modal.classList.remove('hidden');
    }
}

// ゲーム描画
function draw() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // ビューポート更新（無限スクロール用）
    if (gameState.currentPiece && gameState.phase >= PHASES.FREE_FALL) {
        // ピースが画面下部に来たらスクロール
        const pieceBottomY = gameState.currentPiece.y + 4;
        const viewportBottom = gameState.viewportY + GRID_HEIGHT - 3;
        if (pieceBottomY > viewportBottom) {
            gameState.viewportY = pieceBottomY - GRID_HEIGHT + 3;
        }
    }

    // 背景
    ctx.fillStyle = '#001100';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // グリッド描画
    ctx.strokeStyle = '#003300';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_WIDTH; i++) {
        ctx.beginPath();
        ctx.moveTo(i * BLOCK_SIZE, 0);
        ctx.lineTo(i * BLOCK_SIZE, CANVAS_HEIGHT);
        ctx.stroke();
    }
    for (let i = 0; i <= GRID_HEIGHT; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * BLOCK_SIZE);
        ctx.lineTo(CANVAS_WIDTH, i * BLOCK_SIZE);
        ctx.stroke();
    }

    // ボードのブロック描画（ビューポート対応）
    const startRow = Math.floor(gameState.viewportY);
    const endRow = Math.min(startRow + GRID_HEIGHT, gameState.board.length);

    for (let row = startRow; row < endRow; row++) {
        for (let col = 0; col < GRID_WIDTH; col++) {
            if (gameState.board[row] && gameState.board[row][col] !== 0) {
                const screenY = (row - startRow) * BLOCK_SIZE;
                if (screenY >= 0 && screenY < CANVAS_HEIGHT) {
                    drawBlockAt(ctx, col, screenY / BLOCK_SIZE, gameState.board[row][col]);
                }
            }
        }
    }

    // 現在のピース描画
    if (gameState.currentPiece) {
        const piece = gameState.currentPiece;
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                if (piece.shape[i][j] !== 0) {
                    const x = piece.x + j;
                    const y = piece.y + i;
                    const screenY = (y - gameState.viewportY) * BLOCK_SIZE;
                    if (x >= 0 && x < GRID_WIDTH && screenY >= -BLOCK_SIZE && screenY < CANVAS_HEIGHT) {
                        drawBlockAt(ctx, x, screenY / BLOCK_SIZE, piece.type);
                    }
                }
            }
        }
    }

    // 障害物描画（Phase 4用）
    if (gameState.phase === PHASES.ENDLESS_DRIFT) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
        for (const obstacle of gameState.obstacles) {
            const screenY = (obstacle.y - gameState.viewportY) * BLOCK_SIZE;
            if (screenY >= -obstacle.height * BLOCK_SIZE && screenY < CANVAS_HEIGHT) {
                ctx.fillRect(
                    obstacle.x * BLOCK_SIZE,
                    screenY,
                    obstacle.width * BLOCK_SIZE,
                    obstacle.height * BLOCK_SIZE
                );
            }
        }
    }

    // ゲームオーバー表示
    if (gameState.gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
}

// ブロック描画（グリッド座標）
function drawBlock(ctx, col, row, type) {
    const x = col * BLOCK_SIZE;
    const y = row * BLOCK_SIZE;
    const color = COLORS[type];

    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

    // 3D効果
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(x + BLOCK_SIZE - 2, y + 1);
    ctx.lineTo(x + BLOCK_SIZE - 2, y + BLOCK_SIZE - 2);
    ctx.lineTo(x + 1, y + BLOCK_SIZE - 2);
    ctx.stroke();
}

// ブロック描画（画面座標）
function drawBlockAt(ctx, col, screenRow, type) {
    const x = col * BLOCK_SIZE;
    const y = screenRow * BLOCK_SIZE;
    const color = COLORS[type];

    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

    // 3D効果
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(x + BLOCK_SIZE - 2, y + 1);
    ctx.lineTo(x + BLOCK_SIZE - 2, y + BLOCK_SIZE - 2);
    ctx.lineTo(x + 1, y + BLOCK_SIZE - 2);
    ctx.stroke();
}

// UI イベント設定
function setupUI() {
    const buttons = {
        'btn-left': () => movePiece(-1, 0),
        'btn-right': () => movePiece(1, 0),
        'btn-down': () => movePiece(0, 1),
        'btn-rotate-cw': () => rotatePiece(gameState.currentPiece, 1),
        'btn-rotate-ccw': () => rotatePiece(gameState.currentPiece, -1)
    };

    for (const [btnId, action] of Object.entries(buttons)) {
        const btn = document.getElementById(btnId);
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            btn.classList.add('pressed');
            action();
        });
        btn.addEventListener('mouseup', () => {
            btn.classList.remove('pressed');
        });
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            btn.classList.add('pressed');
            action();
        });
        btn.addEventListener('touchend', () => {
            btn.classList.remove('pressed');
        });
    }
}

// キーボード操作
function setupKeyboard() {
    const keyActions = {
        'ArrowLeft': () => movePiece(-1, 0),
        'ArrowRight': () => movePiece(1, 0),
        'ArrowDown': () => {
            // ソフトドロップ - 複数ステップ落下
            for (let i = 0; i < 4; i++) {
                if (!movePiece(0, 1)) break;
            }
        },
        'ArrowUp': (e) => {
            e.preventDefault();
            rotatePiece(gameState.currentPiece, 1);
        },
        ' ': (e) => {
            e.preventDefault();
            // ハードドロップ - 底まで一気に落下
            while (movePiece(0, 1)) {}
        }
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') return; // Shiftキーは特別処理

        if (e.key === 'ArrowUp' && e.shiftKey) {
            e.preventDefault();
            rotatePiece(gameState.currentPiece, -1); // 左回転
            return;
        }

        if (keyActions[e.key]) {
            keyActions[e.key](e);
            // ボタンUIの視覚フィードバック
            updateButtonVisuals(e.key);
        }
    });
}

// ボタンUI視覚フィードバック
function updateButtonVisuals(key) {
    const keyToBtn = {
        'ArrowLeft': 'btn-left',
        'ArrowRight': 'btn-right',
        'ArrowDown': 'btn-down',
        'ArrowUp': 'btn-rotate-cw'
    };

    if (keyToBtn[key]) {
        const btn = document.getElementById(keyToBtn[key]);
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 100);
    }
}

// 初期化
window.addEventListener('DOMContentLoaded', () => {
    setupUI();
    setupKeyboard();

    // ゲーム開始
    startGame();

    // ゲームループ
    setInterval(updateGame, 100);

    // 再開ボタン機能
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            document.getElementById('game-over-modal').classList.add('hidden');
            startGame();
        });
    }
});
