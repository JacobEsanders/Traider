// Canvas setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = 1024;
canvas.height = 768;

// Game state
const gameState = {
    player: {
        id: null,
        x: canvas.width / 2,
        y: canvas.height / 2,
        speed: 5,
        health: 100,
        maxHealth: 100,
        mana: 100,
        maxMana: 100,
        inventory: [],
        maxInventory: 12,
        damage: 25,
        attackRange: 50,
        attackCooldown: 500,
        lastAttack: 0,
        isAttacking: false
    },
    camera: {
        x: 0,
        y: 0
    },
    map: {
        chunks: new Map(),
        chunkSize: 1024,
        generateNewChunks: true
    },
    effects: [],
    npcs: [],
    enemies: [],
    activeTrade: null,
    debug: true,
    isPaused: false,
    otherPlayers: new Map()
};

// Initialize game elements
function initGame() {
    debug('Initializing game...');
    
    // Reset canvas transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Generate initial chunks around player
    updateVisibleChunks();
    
    // Add some initial enemies
    const initialChunk = getChunkAt(0, 0);
    for (let i = 0; i < 5; i++) {
        const enemy = {
            x: Math.random() * gameState.map.chunkSize,
            y: Math.random() * gameState.map.chunkSize,
            health: 100,
            speed: 2,
            damage: 10,
            lastAttack: 0,
            pulseOffset: Math.random() * Math.PI * 2
        };
        initialChunk.enemies.push(enemy);
    }
    
    // Add some initial items
    for (let i = 0; i < 10; i++) {
        const item = {
            x: Math.random() * gameState.map.chunkSize,
            y: Math.random() * gameState.map.chunkSize,
            type: ['herb', 'coin', 'gem', 'scroll'][Math.floor(Math.random() * 4)],
            pulseOffset: Math.random() * Math.PI * 2
        };
        item.color = getItemColor(item.type);
        initialChunk.items.push(item);
    }
    
    debug('Game initialization complete');
}

// Get or create chunk at coordinates
function getChunkAt(x, y) {
    const chunkX = Math.floor(x / gameState.map.chunkSize);
    const chunkY = Math.floor(y / gameState.map.chunkSize);
    const key = `${chunkX},${chunkY}`;
    
    if (!gameState.map.chunks.has(key)) {
        const chunk = {
            x: chunkX * gameState.map.chunkSize,
            y: chunkY * gameState.map.chunkSize,
            items: [],
            npcs: [],
            enemies: []
        };
        gameState.map.chunks.set(key, chunk);
        debug('Created new chunk at', key);
    }
    
    return gameState.map.chunks.get(key);
}

// Update visible chunks
function updateVisibleChunks() {
    const playerChunkX = Math.floor(gameState.player.x / gameState.map.chunkSize);
    const playerChunkY = Math.floor(gameState.player.y / gameState.map.chunkSize);
    
    // Generate chunks in view distance
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const x = (playerChunkX + dx) * gameState.map.chunkSize;
            const y = (playerChunkY + dy) * gameState.map.chunkSize;
            getChunkAt(x, y);
        }
    }
}

// Camera functions
function updateCamera() {
    gameState.camera.x = gameState.player.x - canvas.width / 2;
    gameState.camera.y = gameState.player.y - canvas.height / 2;
}

// Render the game
function render(deltaTime) {
    debug('Rendering frame...');
    
    // Reset transform and clear the entire canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a1a');
    gradient.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply camera transform
    ctx.setTransform(1, 0, 0, 1, -Math.floor(gameState.camera.x), -Math.floor(gameState.camera.y));
    
    // Draw grid
    const gridSize = 50;
    const startX = Math.floor(gameState.camera.x / gridSize) * gridSize;
    const startY = Math.floor(gameState.camera.y / gridSize) * gridSize;
    const endX = startX + canvas.width + gridSize;
    const endY = startY + canvas.height + gridSize;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    
    for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
    }
    
    for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
    }
    
    // Draw items, NPCs, and enemies from visible chunks
    for (const chunk of gameState.map.chunks.values()) {
        // Skip if chunk is not in view
        if (chunk.x + gameState.map.chunkSize < gameState.camera.x - 100 ||
            chunk.x > gameState.camera.x + canvas.width + 100 ||
            chunk.y + gameState.map.chunkSize < gameState.camera.y - 100 ||
            chunk.y > gameState.camera.y + canvas.height + 100) {
            continue;
        }
        
        // Draw items
        for (const item of chunk.items) {
            const pulse = Math.sin(Date.now() * 0.003 + item.pulseOffset) * 0.2 + 0.8;
            const size = 6 * pulse;
            
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(item.x, item.y, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Glow effect
            ctx.shadowColor = item.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(item.x, item.y, size * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        
        // Draw enemies
        for (const enemy of chunk.enemies) {
            const pulse = Math.sin(Date.now() * 0.004 + enemy.pulseOffset) * 0.2 + 0.8;
            const size = 15 * pulse;
            
            ctx.shadowColor = '#ff4444';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, size, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ff6666';
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, size * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Draw effects
    for (const effect of gameState.effects) {
        const progress = effect.duration / effect.maxDuration;
        
        if (effect.type === 'attack') {
            ctx.strokeStyle = `rgba(255, 68, 68, ${progress})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.size * (1 - progress), 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    // Draw other players
    for (const [id, player] of gameState.otherPlayers) {
        ctx.shadowColor = '#7777ff';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#7777ff';
        ctx.beginPath();
        ctx.arc(player.x, player.y, 18, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#aaaaff';
        ctx.beginPath();
        ctx.arc(player.x, player.y, 12, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw player
    ctx.shadowColor = '#77ff77';
    ctx.shadowBlur = gameState.player.isAttacking ? 30 : 20;
    ctx.fillStyle = '#77ff77';
    ctx.beginPath();
    ctx.arc(gameState.player.x, gameState.player.y, 18, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = gameState.player.isAttacking ? '#88ff88' : '#aaffaa';
    ctx.beginPath();
    ctx.arc(gameState.player.x, gameState.player.y, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Reset transform for UI
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Draw floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const text = floatingTexts[i];
        text.y -= 1;
        text.life -= deltaTime;
        text.alpha = text.life / 1000;
        
        if (text.life <= 0) {
            floatingTexts.splice(i, 1);
            continue;
        }
        
        const screenPos = worldToScreen(text.x, text.y);
        ctx.fillStyle = `rgba(255, 255, 255, ${text.alpha})`;
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text.text, screenPos.x, screenPos.y);
    }
}

// Start game when window loads
window.onload = function() {
    debug('Window loaded, initializing game...');
    
    // Initialize game state
    initGame();
    
    // Start game loop
    let isGameRunning = true;
    let lastTime = 0;
    function gameLoop(timestamp) {
        if (!isGameRunning) return;
        
        const deltaTime = lastTime ? (timestamp - lastTime) : 0;
        lastTime = timestamp;
        
        debug('Game loop running, deltaTime:', deltaTime);
        
        if (!gameState.isPaused) {
            update(deltaTime);
        }
        render(deltaTime);
        requestAnimationFrame(gameLoop);
    }
    requestAnimationFrame(gameLoop);
    
    // Initialize UI
    updateInventoryUI();
    updateStats();
    
    debug('Game initialized and started');
};

// Helper function to get item color
function getItemColor(type) {
    const colors = {
        herb: '#4CAF50',
        coin: '#FFD700',
        gem: '#E91E63',
        scroll: '#9C27B0'
    };
    return colors[type] || '#ffffff';
}

// Floating text array
const floatingTexts = [];

// Create floating text
function createFloatingText(x, y, text, color = '#ffffff') {
    floatingTexts.push({
        x,
        y,
        text,
        life: 1000,
        alpha: 1
    });
}

// Attack player function
function attackPlayer(damage) {
    gameState.player.health = Math.max(0, gameState.player.health - damage);
    createFloatingText(gameState.player.x, gameState.player.y, `-${damage}`, '#ff4444');
    updateStats();
}

// Update UI elements
function updateStats() {
    const healthBar = document.querySelector('#health-bar > div');
    const manaBar = document.querySelector('#mana-bar > div');
    
    healthBar.style.width = `${(gameState.player.health / gameState.player.maxHealth) * 100}%`;
    manaBar.style.width = `${(gameState.player.mana / gameState.player.maxMana) * 100}%`;
}

function updateInventoryUI() {
    const inventoryPanel = document.getElementById('inventory-panel');
    inventoryPanel.innerHTML = '';
    
    gameState.player.inventory.forEach((item, index) => {
        const slot = document.createElement('div');
        slot.className = 'inventory-slot';
        slot.innerHTML = `
            <div class="item ${item.type}">
                <span class="quantity">${item.quantity}</span>
            </div>
        `;
        inventoryPanel.appendChild(slot);
    });
}

// Add item to inventory
function addItemToInventory(item) {
    if (gameState.player.inventory.length >= gameState.player.maxInventory) {
        createFloatingText(gameState.player.x, gameState.player.y, 'Inventory full!', '#ff4444');
        return false;
    }
    
    const existingItem = gameState.player.inventory.find(i => i.type === item.type);
    if (existingItem) {
        existingItem.quantity += item.quantity;
    } else {
        gameState.player.inventory.push(item);
    }
    
    updateInventoryUI();
    return true;
}

// Key tracking
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Escape') {
        togglePauseMenu();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Pause menu
function togglePauseMenu() {
    const pauseMenu = document.getElementById('pause-menu');
    gameState.isPaused = !gameState.isPaused;
    pauseMenu.style.display = gameState.isPaused ? 'flex' : 'none';
}

// Initialize pause menu buttons
document.getElementById('resume-button').addEventListener('click', () => {
    togglePauseMenu();
});

document.getElementById('settings-button').addEventListener('click', () => {
    // TODO: Implement settings menu
});

document.getElementById('help-button').addEventListener('click', () => {
    // TODO: Implement help menu
});

// Helper functions for coordinate conversion
function worldToScreen(x, y) {
    return {
        x: x - gameState.camera.x,
        y: y - gameState.camera.y
    };
}

function screenToWorld(x, y) {
    return {
        x: x + gameState.camera.x,
        y: y + gameState.camera.y
    };
}

// Update game state
function update(deltaTime) {
    if (gameState.isPaused) return;
    
    debug('Updating game state...');
    
    // Update effects
    for (let i = gameState.effects.length - 1; i >= 0; i--) {
        const effect = gameState.effects[i];
        effect.duration -= deltaTime;
        if (effect.duration <= 0) {
            gameState.effects.splice(i, 1);
        }
    }
    
    // Store old position
    const oldX = gameState.player.x;
    const oldY = gameState.player.y;
    
    // Player movement
    if (keys.ArrowLeft) {
        gameState.player.x -= gameState.player.speed;
        debug('Player moved left to:', gameState.player.x);
    }
    if (keys.ArrowRight) {
        gameState.player.x += gameState.player.speed;
        debug('Player moved right to:', gameState.player.x);
    }
    if (keys.ArrowUp) {
        gameState.player.y -= gameState.player.speed;
        debug('Player moved up to:', gameState.player.y);
    }
    if (keys.ArrowDown) {
        gameState.player.y += gameState.player.speed;
        debug('Player moved down to:', gameState.player.y);
    }
    
    // Send position update if moved
    if (oldX !== gameState.player.x || oldY !== gameState.player.y) {
        gameState.p2pServer.updatePosition(gameState.player.x, gameState.player.y);
    }
    
    // Attack with spacebar
    if (keys.Space) {
        playerAttack();
    }

    // Update camera
    updateCamera();

    // Generate new chunks as player moves
    if (gameState.map.generateNewChunks) {
        updateVisibleChunks();
    }

    // Update enemies in visible chunks
    for (const chunk of gameState.map.chunks.values()) {
        // Remove dead enemies
        chunk.enemies = chunk.enemies.filter(enemy => {
            if (enemy.health <= 0) {
                createFloatingText(enemy.x, enemy.y, 'Defeated!', '#ff4444');
                return false;
            }
            return true;
        });
        
        // Update remaining enemies
        for (const enemy of chunk.enemies) {
            const dx = gameState.player.x - enemy.x;
            const dy = gameState.player.y - enemy.y;
            const distance = Math.hypot(dx, dy);
            
            if (distance < 300) {
                const angle = Math.atan2(dy, dx);
                enemy.x += Math.cos(angle) * enemy.speed;
                enemy.y += Math.sin(angle) * enemy.speed;

                if (distance < 30 && Date.now() - enemy.lastAttack > 1000) {
                    attackPlayer(enemy.damage);
                    enemy.lastAttack = Date.now();
                    debug('Player attacked by enemy, health:', gameState.player.health);
                }
            }
        }

        // Check item collection
        for (let i = chunk.items.length - 1; i >= 0; i--) {
            const item = chunk.items[i];
            const distance = Math.hypot(
                gameState.player.x - item.x,
                gameState.player.y - item.y
            );

            if (distance < 30) {
                addItemToInventory({
                    type: item.type,
                    quantity: 1
                });
                createFloatingText(item.x, item.y, '+1 ' + item.type);
                chunk.items.splice(i, 1);
                debug('Item collected:', item.type);
            }
        }

        // Check NPC interaction
        for (const npc of chunk.npcs) {
            const distance = Math.hypot(
                gameState.player.x - npc.x,
                gameState.player.y - npc.y
            );

            if (distance < 50 && keys.KeyE) {
                openTradePanel(npc);
            }
        }
    }
}

// Combat functions
function attackEnemy(enemy) {
    enemy.health -= gameState.player.damage;
    createFloatingText(enemy.x, enemy.y, `-${gameState.player.damage}`, '#ff4444');
    
    // Create attack effect
    gameState.effects.push({
        x: enemy.x,
        y: enemy.y,
        size: 30,
        duration: 200,
        maxDuration: 200,
        type: 'attack'
    });
    
    // Send attack to other players
    if (gameState.p2pServer) {
        gameState.p2pServer.sendAttack(enemy.x, enemy.y);
    }
}

function playerAttack() {
    const now = Date.now();
    if (now - gameState.player.lastAttack < gameState.player.attackCooldown) {
        return;
    }
    
    gameState.player.lastAttack = now;
    gameState.player.isAttacking = true;
    
    // Create attack effect around player
    const attackEffect = {
        x: gameState.player.x,
        y: gameState.player.y,
        size: gameState.player.attackRange,
        duration: 200,
        maxDuration: 200,
        type: 'playerAttack'
    };
    gameState.effects.push(attackEffect);
    
    // Check for enemies in range
    for (const chunk of gameState.map.chunks.values()) {
        for (const enemy of chunk.enemies) {
            const dx = enemy.x - gameState.player.x;
            const dy = enemy.y - gameState.player.y;
            const distance = Math.hypot(dx, dy);
            
            if (distance <= gameState.player.attackRange) {
                attackEnemy(enemy);
            }
        }
    }
    
    setTimeout(() => {
        gameState.player.isAttacking = false;
    }, 200);
}

// Debug logging
function debug(...args) {
    if (gameState.debug) {
        console.log(...args);
    }
}

// Initialize P2P server
function initializeMultiplayer() {
    gameState.p2pServer = new P2PServer();
    gameState.player.id = gameState.p2pServer.peerId;
    debug('Initialized P2P multiplayer with ID:', gameState.player.id);
}

// P2P server implementation
class P2PServer {
    constructor() {
        this.peerId = Math.floor(Math.random() * 1000000);
        this.peers = {};
    }

    updatePosition(x, y) {
        // Send position update to all connected peers
        for (const peerId in this.peers) {
            const peer = this.peers[peerId];
            peer.send({
                type: 'updatePosition',
                x,
                y
            });
        }
    }

    sendAttack(x, y) {
        // Send attack to all connected peers
        for (const peerId in this.peers) {
            const peer = this.peers[peerId];
            peer.send({
                type: 'attack',
                x,
                y
            });
        }
    }
}

// Helper function to generate NPC inventory
function generateNPCInventory() {
    const inventory = [];
    const itemTypes = ['herb', 'coin', 'gem', 'scroll'];
    
    for (let i = 0; i < 5; i++) {
        inventory.push({
            type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
            quantity: Math.floor(Math.random() * 5) + 1
        });
    }
    
    return inventory;
}
