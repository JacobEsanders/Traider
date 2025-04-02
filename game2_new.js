// Game Configuration
const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    PLAYER_SPEED: 5,
    GRID_SIZE: 32,
    INTERACTION_DISTANCE: 50,
    DEFAULT_SETTINGS: {
        controlMode: 'laptop'
    }
};

// Game state and variables
let canvas;
let ctx;
let attackEffects = [];
const keys = {};

// Initialize game state
const gameState = {
    player: {
        x: 0,
        y: 0,
        health: 100,
        maxHealth: 100,
        mana: 100,
        maxMana: 100,
        speed: CONFIG.PLAYER_SPEED,
        inventory: [],
        maxInventory: 10,
        gold: 100
    },
    camera: {
        x: 0,
        y: 0
    },
    chunks: new Map(),
    npcs: [],
    enemies: [],
    items: [],
    activeTrade: null,
    otherPlayers: new Map(),
    isPaused: false,
    p2pServer: null,
    settings: { ...CONFIG.DEFAULT_SETTINGS },
    debug: true
};

// Input handling
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === 'Escape') {
        gameState.isPaused = !gameState.isPaused;
    } else if (!gameState.isPaused) {
        if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
        if (e.key.toLowerCase() === 'e') {
            handleTrading();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Update game state
function update() {
    if (gameState.isPaused) return;

    // Player movement
    if (keys['ArrowLeft'] || keys['a']) gameState.player.x -= gameState.player.speed;
    if (keys['ArrowRight'] || keys['d']) gameState.player.x += gameState.player.speed;
    if (keys['ArrowUp'] || keys['w']) gameState.player.y -= gameState.player.speed;
    if (keys['ArrowDown'] || keys['s']) gameState.player.y += gameState.player.speed;

    // Update camera to follow player
    gameState.camera.x = gameState.player.x;
    gameState.camera.y = gameState.player.y;

    updateCombat();
    updateChunks();
    updateAttackEffects();
}

// Convert world coordinates to screen coordinates
function worldToScreen(x, y) {
    return {
        x: x - gameState.camera.x + canvas.width / 2,
        y: y - gameState.camera.y + canvas.height / 2
    };
}

// Render function
function render() {
    try {
        // Clear canvas
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 1;
        const offsetX = (-gameState.camera.x % CONFIG.GRID_SIZE + CONFIG.GRID_SIZE) % CONFIG.GRID_SIZE;
        const offsetY = (-gameState.camera.y % CONFIG.GRID_SIZE + CONFIG.GRID_SIZE) % CONFIG.GRID_SIZE;
        
        for (let x = offsetX; x < canvas.width; x += CONFIG.GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let y = offsetY; y < canvas.height; y += CONFIG.GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Draw player
        const playerScreen = worldToScreen(gameState.player.x, gameState.player.y);
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(playerScreen.x, playerScreen.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw enemies
        for (const chunk of gameState.chunks.values()) {
            for (const enemy of chunk.enemies || []) {
                const enemyScreen = worldToScreen(enemy.x, enemy.y);
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(enemyScreen.x, enemyScreen.y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // Draw NPCs
        for (const chunk of gameState.chunks.values()) {
            for (const npc of chunk.npcs || []) {
                const npcScreen = worldToScreen(npc.x, npc.y);
                ctx.fillStyle = '#0000ff';
                ctx.beginPath();
                ctx.arc(npcScreen.x, npcScreen.y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // Draw attack effects
        for (const effect of attackEffects) {
            const effectScreen = worldToScreen(effect.x, effect.y);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(effectScreen.x, effectScreen.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw health bar
        const healthBarWidth = 200;
        const healthBarHeight = 20;
        const healthBarX = 20;
        const healthBarY = 20;
        
        ctx.fillStyle = '#333333';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        
        const healthPercent = gameState.player.health / gameState.player.maxHealth;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercent, healthBarHeight);
        
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            `${Math.round(gameState.player.health)} / ${gameState.player.maxHealth}`,
            healthBarX + healthBarWidth / 2,
            healthBarY + 15
        );

        // Draw mana bar
        const manaBarWidth = 200;
        const manaBarHeight = 20;
        const manaBarX = 20;
        const manaBarY = 50;
        
        ctx.fillStyle = '#333333';
        ctx.fillRect(manaBarX, manaBarY, manaBarWidth, manaBarHeight);
        
        const manaPercent = gameState.player.mana / gameState.player.maxMana;
        ctx.fillStyle = '#0000ff';
        ctx.fillRect(manaBarX, manaBarY, manaBarWidth * manaPercent, manaBarHeight);
        
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(manaBarX, manaBarY, manaBarWidth, manaBarHeight);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            `${Math.round(gameState.player.mana)} / ${gameState.player.maxMana}`,
            manaBarX + manaBarWidth / 2,
            manaBarY + 15
        );

        // Draw gold counter
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Gold: ${gameState.player.gold}`, 20, 90);

        // Update debug info
        if (gameState.debug) {
            const debugInfo = document.getElementById('debug-info');
            if (debugInfo) {
                debugInfo.textContent = `
Position: (${Math.round(gameState.player.x)}, ${Math.round(gameState.player.y)})
Camera: (${Math.round(gameState.camera.x)}, ${Math.round(gameState.camera.y)})
FPS: ${Math.round(1000 / (performance.now() - (window._lastFrameTime || performance.now())))}
                `.trim();
                window._lastFrameTime = performance.now();
            }
        }
    } catch (error) {
        console.error('Render error:', error);
    }
}

// Game loop
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// Initialize game
function initGame() {
    // Initialize canvas
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get canvas context!');
        return;
    }
    
    // Set canvas size
    canvas.width = CONFIG.CANVAS_WIDTH;
    canvas.height = CONFIG.CANVAS_HEIGHT;
    
    // Center player
    gameState.player.x = 0;
    gameState.player.y = 0;
    
    // Start game loop
    gameLoop();
}

// Start game when window loads
window.addEventListener('load', initGame);

// Combat System
function attack(attacker, target) {
    const damage = attacker.damage;
    target.health = Math.max(0, target.health - damage);
    
    createFloatingText(target.x, target.y, damage.toString(), '#ff0000');
    createAttackEffect(attacker.x, attacker.y, target.x, target.y);
    
    if (target.health <= 0) {
        handleTargetDeath(target);
    }
}

function handleTargetDeath(target) {
    if (target === gameState.player) {
        playerDied();
    } else {
        const currentChunk = getCurrentChunk();
        if (currentChunk) {
            currentChunk.enemies = currentChunk.enemies.filter(e => e !== target);
        }
    }
}

// Player Functions
function playerDied() {
    gameState.isPaused = true;
    document.getElementById('death-screen').style.display = 'flex';
    dropInventoryOnDeath();
}

function respawnPlayer() {
    gameState.player.health = gameState.player.maxHealth;
    gameState.player.mana = gameState.player.maxMana;
    gameState.player.x = 0;
    gameState.player.y = 0;
    gameState.isPaused = false;
    document.getElementById('death-screen').style.display = 'none';
}

// Inventory System
function addItemToInventory(item) {
    if (gameState.player.inventory.length < gameState.player.maxInventory) {
        gameState.player.inventory.push(item);
        updateInventoryUI();
        return true;
    }
    return false;
}

function useItem(index) {
    const item = gameState.player.inventory[index];
    if (!item) return;

    switch(item.type) {
        case 'health':
            gameState.player.health = Math.min(
                gameState.player.health + item.value,
                gameState.player.maxHealth
            );
            break;
        case 'mana':
            gameState.player.mana = Math.min(
                gameState.player.mana + item.value,
                gameState.player.maxMana
            );
            break;
    }

    gameState.player.inventory.splice(index, 1);
    updateInventoryUI();
    updateStats();
}

// Trading System
function handleTrading() {
    const currentChunk = getCurrentChunk();
    if (!currentChunk) return;

    // Find closest NPC within interaction distance
    const closestNPC = currentChunk.npcs?.find(npc => {
        const distance = getDistance(gameState.player.x, gameState.player.y, npc.x, npc.y);
        return distance <= CONFIG.INTERACTION_DISTANCE;
    });

    if (closestNPC) {
        if (!gameState.activeTrade) {
            // Start trade
            gameState.activeTrade = {
                npc: closestNPC,
                npcInventory: generateNPCInventory(),
                selectedPlayerItem: null,
                selectedNPCItem: null
            };
            showTradeMenu();
        } else {
            // End trade
            gameState.activeTrade = null;
            hideTradeMenu();
        }
    }
}

function generateNPCInventory() {
    const items = [
        { id: 1, name: 'Health Potion', price: 50, type: 'consumable' },
        { id: 2, name: 'Mana Potion', price: 50, type: 'consumable' },
        { id: 3, name: 'Iron Sword', price: 100, type: 'weapon' },
        { id: 4, name: 'Leather Armor', price: 80, type: 'armor' }
    ];
    
    const inventory = [];
    const itemCount = Math.floor(Math.random() * 3) + 2; // 2-4 items
    
    for (let i = 0; i < itemCount; i++) {
        const item = { ...items[Math.floor(Math.random() * items.length)] };
        item.quantity = Math.floor(Math.random() * 3) + 1;
        inventory.push(item);
    }
    
    return inventory;
}

function showTradeMenu() {
    const tradeMenu = document.getElementById('trade-menu');
    if (!tradeMenu) return;
    
    tradeMenu.style.display = 'flex';
    updateTradeMenu();
}

function hideTradeMenu() {
    const tradeMenu = document.getElementById('trade-menu');
    if (!tradeMenu) return;
    
    tradeMenu.style.display = 'none';
}

function updateTradeMenu() {
    if (!gameState.activeTrade) return;

    const playerInventoryElement = document.getElementById('player-inventory');
    const npcInventoryElement = document.getElementById('npc-inventory');
    
    if (!playerInventoryElement || !npcInventoryElement) return;

    // Update player inventory display
    playerInventoryElement.innerHTML = gameState.player.inventory.map((item, index) => `
        <div class="inventory-item ${gameState.activeTrade.selectedPlayerItem === index ? 'selected' : ''}"
             onclick="selectPlayerItem(${index})">
            ${item.name} (x${item.quantity})
            <span class="price">${item.price} gold</span>
        </div>
    `).join('');

    // Update NPC inventory display
    npcInventoryElement.innerHTML = gameState.activeTrade.npcInventory.map((item, index) => `
        <div class="inventory-item ${gameState.activeTrade.selectedNPCItem === index ? 'selected' : ''}"
             onclick="selectNPCItem(${index})">
            ${item.name} (x${item.quantity})
            <span class="price">${item.price} gold</span>
        </div>
    `).join('');
}

function selectPlayerItem(index) {
    if (!gameState.activeTrade) return;
    gameState.activeTrade.selectedPlayerItem = index;
    gameState.activeTrade.selectedNPCItem = null;
    updateTradeMenu();
}

function selectNPCItem(index) {
    if (!gameState.activeTrade) return;
    gameState.activeTrade.selectedNPCItem = index;
    gameState.activeTrade.selectedPlayerItem = null;
    updateTradeMenu();
}

function executeTrade() {
    if (!gameState.activeTrade) return;

    const { selectedPlayerItem, selectedNPCItem } = gameState.activeTrade;

    if (selectedPlayerItem !== null) {
        // Sell item to NPC
        const item = gameState.player.inventory[selectedPlayerItem];
        if (item) {
            gameState.player.gold += item.price;
            item.quantity--;
            if (item.quantity <= 0) {
                gameState.player.inventory.splice(selectedPlayerItem, 1);
            }
        }
    } else if (selectedNPCItem !== null) {
        // Buy item from NPC
        const item = gameState.activeTrade.npcInventory[selectedNPCItem];
        if (item && gameState.player.gold >= item.price) {
            gameState.player.gold -= item.price;
            
            // Add to player inventory
            const existingItem = gameState.player.inventory.find(i => i.name === item.name);
            if (existingItem) {
                existingItem.quantity++;
            } else {
                gameState.player.inventory.push({
                    ...item,
                    quantity: 1
                });
            }
            
            // Remove from NPC inventory
            item.quantity--;
            if (item.quantity <= 0) {
                gameState.activeTrade.npcInventory.splice(selectedNPCItem, 1);
            }
        }
    }

    updateTradeMenu();
}

// UI Functions
function togglePauseMenu() {
    const pauseMenu = document.getElementById('pause-menu');
    const settingsMenu = document.getElementById('settings-menu');
    
    if (gameState.isPaused) {
        pauseMenu.style.display = 'flex';
        settingsMenu.style.display = 'none';
    } else {
        pauseMenu.style.display = 'none';
        settingsMenu.style.display = 'none';
    }
}

function initializeMenuButtons() {
    const buttonHandlers = {
        'pause-button': () => {
            gameState.isPaused = true;
            togglePauseMenu();
        },
        'resume-button': () => {
            gameState.isPaused = false;
            togglePauseMenu();
        },
        'settings-button': () => {
            document.getElementById('pause-menu').style.display = 'none';
            document.getElementById('settings-menu').style.display = 'flex';
        },
        'back-to-pause': () => {
            document.getElementById('pause-menu').style.display = 'flex';
            document.getElementById('settings-menu').style.display = 'none';
        },
        'save-settings': () => {
            const controlMode = document.getElementById('control-mode').value;
            gameState.settings.controlMode = controlMode;
            localStorage.setItem('gameSettings', JSON.stringify(gameState.settings));
            togglePauseMenu();
        },
        'respawn-button': respawnPlayer
    };

    Object.entries(buttonHandlers).forEach(([id, handler]) => {
        document.getElementById(id).addEventListener('click', handler);
    });
}

// Utility Functions
function getDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
}

function getCurrentChunk() {
    return gameState.chunks.get(getChunkKey(gameState.player.x, gameState.player.y));
}

function getChunkKey(x, y) {
    const chunkX = Math.floor(x / 1000);
    const chunkY = Math.floor(y / 1000);
    return `${chunkX},${chunkY}`;
}

function createFloatingText(x, y, text, color = '#ff0000') {
    floatingTexts.push({ x, y, text, color, age: 0 });
}

function loadSettings() {
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
        gameState.settings = { ...CONFIG.DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
    }
}

// Debug Functions
function updateDebugInfo() {
    if (!gameState.debug) return;
    
    const debugInfo = document.getElementById('debug-info');
    if (!debugInfo) return;

    const { x, y } = gameState.player;
    const chunk = getCurrentChunk();
    const fps = (1000 / (performance.now() - (window._lastFrameTime || 0))).toFixed(1);
    window._lastFrameTime = performance.now();

    debugInfo.textContent = `
        FPS: ${fps}
        Position: (${x.toFixed(2)}, ${y.toFixed(2)})
        Chunk: ${chunk ? getChunkKey(x, y) : 'none'}
        Entities: ${chunk ? (chunk.enemies.length + chunk.npcs.length) : 0}
    `;
}

// Update Functions
function updateCombat() {
    // Update attack cooldown
    if (gameState.player.attackCooldown > 0) {
        gameState.player.attackCooldown -= 16; // Assume ~60fps
    }

    // Check for spacebar attack
    if (keys[' '] && gameState.player.attackCooldown <= 0) {
        // Attack closest enemy or player
        let closest = null;
        let closestDist = 100; // Attack range

        // Check enemies
        for (const chunk of gameState.chunks.values()) {
            for (const enemy of chunk.enemies) {
                const dx = enemy.x - gameState.player.x;
                const dy = enemy.y - gameState.player.y;
                const dist = Math.hypot(dx, dy);

                if (dist < closestDist) {
                    closest = enemy;
                    closestDist = dist;
                }
            }
        }

        // Check other players
        for (const [id, player] of gameState.otherPlayers) {
            const dx = player.x - gameState.player.x;
            const dy = player.y - gameState.player.y;
            const dist = Math.hypot(dx, dy);

            if (dist < closestDist) {
                closest = player;
                closestDist = dist;

                // Broadcast attack to other players
                if (gameState.p2pServer) {
                    gameState.p2pServer.broadcast('attack', {
                        x: gameState.player.x,
                        y: gameState.player.y
                    });
                }
            }
        }

        if (closest) {
            attack(gameState.player, closest);
            gameState.player.attackCooldown = 500; // 0.5 second cooldown
        }
    }
}

function updateChunks() {
    const playerChunkX = Math.floor(gameState.player.x / 1000);
    const playerChunkY = Math.floor(gameState.player.y / 1000);

    // Generate chunks in render distance
    for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
            const chunkX = (playerChunkX + dx) * 1000;
            const chunkY = (playerChunkY + dy) * 1000;
            const chunkKey = getChunkKey(chunkX, chunkY);

            if (!gameState.chunks.has(chunkKey)) {
                gameState.chunks.set(chunkKey, generateChunk(chunkX, chunkY));
            }
        }
    }

    // Remove chunks outside render distance
    for (const [key, chunk] of gameState.chunks) {
        const chunkX = Math.floor(chunk.x / 1000);
        const chunkY = Math.floor(chunk.y / 1000);

        if (Math.abs(chunkX - playerChunkX) > 2 || Math.abs(chunkY - playerChunkY) > 2) {
            gameState.chunks.delete(key);
        }
    }
}

function updateAttackEffects() {
    const now = Date.now();
    for (let i = attackEffects.length - 1; i >= 0; i--) {
        const effect = attackEffects[i];
        effect.age += 16; // Assume ~60fps
        if (effect.age >= 200) { // 200ms duration
            attackEffects.splice(i, 1);
        }
    }
}

function updateInventoryUI() {
    const inventoryElement = document.getElementById('inventory');
    if (!inventoryElement) return;

    // Clear current inventory display
    inventoryElement.innerHTML = '';

    // Create inventory slots
    for (let i = 0; i < gameState.player.maxInventory; i++) {
        const slot = document.createElement('div');
        slot.className = 'inventory-slot';

        if (gameState.player.inventory[i]) {
            const item = gameState.player.inventory[i];
            slot.style.backgroundColor = getItemColor(item.type);
            slot.title = item.type;

            // Add click handler for using/dropping items
            slot.onclick = () => {
                useItem(i);
            };
        }

        inventoryElement.appendChild(slot);
    }
}

function updateStats() {
    const healthBar = document.querySelector('#health-bar > div');
    const manaBar = document.querySelector('#mana-bar > div');

    if (healthBar && manaBar) {
        healthBar.style.width = `${(gameState.player.health / gameState.player.maxHealth) * 100}%`;
        manaBar.style.width = `${(gameState.player.mana / gameState.player.maxMana) * 100}%`;
    }
}

// Generate Chunk
function generateChunk(x, y) {
    const chunk = {
        x: x,
        y: y,
        npcs: [],
        enemies: [],
        items: []
    };

    // Add NPCs
    if (Math.random() < 0.3) {
        chunk.npcs.push({
            x: x + Math.random() * 1000,
            y: y + Math.random() * 1000,
            type: 'merchant',
            inventory: generateNPCInventory(),
            pulseOffset: Math.random() * Math.PI * 2
        });
    }

    // Add enemies
    const enemyCount = Math.floor(Math.random() * 3);
    for (let i = 0; i < enemyCount; i++) {
        chunk.enemies.push({
            x: x + Math.random() * 1000,
            y: y + Math.random() * 1000,
            health: 50,
            maxHealth: 50,
            damage: 10,
            type: 'enemy'
        });
    }

    // Add items
    const itemCount = Math.floor(Math.random() * 2);
    for (let i = 0; i < itemCount; i++) {
        chunk.items.push(generateRandomItem(x + Math.random() * 1000, y + Math.random() * 1000));
    }

    return chunk;
}

// Generate NPC Inventory
function generateNPCInventory() {
    const inventory = [];
    const itemCount = Math.floor(Math.random() * 5) + 3;

    for (let i = 0; i < itemCount; i++) {
        inventory.push(generateRandomItem());
    }

    return inventory;
}

// Generate Random Item
function generateRandomItem(x = 0, y = 0) {
    const types = ['health', 'mana', 'damage', 'health'];
    return {
        type: types[Math.floor(Math.random() * types.length)],
        x: x,
        y: y
    };
}

// Get Item Color
function getItemColor(type) {
    switch (type) {
        case 'health':
            return '#ff0000';
        case 'mana':
            return '#0000ff';
        case 'damage':
            return '#808080';
        default:
            return '#ffffff';
    }
}

// Create Attack Effect
function createAttackEffect(startX, startY, endX, endY) {
    const effect = {
        startX: startX,
        startY: startY,
        endX: endX,
        endY: endY,
        age: 0
    };
    attackEffects.push(effect);
}