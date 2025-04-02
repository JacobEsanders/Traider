// Event handlers
function handleKeyboard(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        gameState.isPaused = !gameState.isPaused;
        togglePauseMenu();
    } else if (!gameState.isPaused) {
        if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
        keys[e.key] = true;
        
        // Handle 'E' key for trading
        if (e.key === 'e' || e.key === 'E') {
            handleTrading();
        }
    }
}

function handleTrading() {
    let closestNPC = null;
    let closestDistance = Infinity;
    
    for (const chunk of gameState.chunks.values()) {
        for (const npc of chunk.npcs || []) {
            const dx = gameState.player.x - npc.x;
            const dy = gameState.player.y - npc.y;
            const distance = Math.hypot(dx, dy);
            
            if (distance < closestDistance && distance < 50) {
                closestDistance = distance;
                closestNPC = npc;
            }
        }
    }
    
    if (closestNPC) {
        handleNPCInteraction(closestNPC);
    }
}

function handleTargetDeath(target) {
    if (target === gameState.player) {
        playerDied();
    } else {
        // Remove enemy from current chunk
        const currentChunk = getCurrentChunk();
        if (currentChunk) {
            currentChunk.enemies = currentChunk.enemies.filter(e => e !== target);
        }
    }
}

// UI functions
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
    // Button event listeners
    document.getElementById('pause-button').addEventListener('click', function() {
        gameState.isPaused = true;
        document.getElementById('pause-menu').style.display = 'flex';
        document.getElementById('settings-menu').style.display = 'none';
    });
    
    document.getElementById('resume-button').addEventListener('click', function() {
        gameState.isPaused = false;
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('settings-menu').style.display = 'none';
    });
    
    document.getElementById('settings-button').addEventListener('click', function() {
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('settings-menu').style.display = 'flex';
    });
    
    document.getElementById('back-to-pause').addEventListener('click', function() {
        document.getElementById('pause-menu').style.display = 'flex';
        document.getElementById('settings-menu').style.display = 'none';
    });
    
    document.getElementById('save-settings').addEventListener('click', function() {
        const controlMode = document.getElementById('control-mode').value;
        gameState.settings.controlMode = controlMode;
        localStorage.setItem('gameSettings', JSON.stringify(gameState.settings));
        
        document.getElementById('settings-menu').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'flex';
    });
    
    document.getElementById('respawn-button').addEventListener('click', function() {
        respawnPlayer();
    });
}

// Game functions
function initGame() {
    // Initialize game state
    gameState = {
        player: {
            x: 0,
            y: 0,
            health: 100,
            maxHealth: 100,
            mana: 100,
            maxMana: 100,
            inventory: [],
            maxInventory: 10
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
        settings: {
            controlMode: 'laptop'
        }
    };

    // Initialize canvas
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // Make sure canvas is properly sized
    canvas.width = 800;
    canvas.height = 600;

    // Hide all menus at game start
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('settings-menu').style.display = 'none';
    document.getElementById('death-screen').style.display = 'none';
    document.getElementById('trade-menu').style.display = 'none';

    // Add event listener for window load
    window.addEventListener('load', () => {
        // Start game loop
        gameLoop();
    });

    // Initialize menu buttons
    initializeMenuButtons();

    // Load settings
    loadSettings();

    // Initialize chunks
    updateChunks();
}

function gameLoop() {
    // Track render count for debugging
    window._debugRenderCount = (window._debugRenderCount || 0) + 1;
    
    if (!gameState.isPaused) {
        update();
    }
    render();
    updateDebugInfo(); // Add debug info update
    requestAnimationFrame(gameLoop);
}

function loadSettings() {
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
        gameState.settings = JSON.parse(savedSettings);
    }
}

// Combat functions
function attack(attacker, target) {
    const damage = attacker.damage;
    target.health = Math.max(0, target.health - damage);
    
    // Create floating damage text
    floatingTexts.push({
        x: target.x,
        y: target.y,
        text: damage.toString(),
        color: '#ff0000',
        age: 0
    });
    
    // Create attack effect
    attackEffects.push({
        x: target.x,
        y: target.y,
        radius: 10,
        age: 0
    });
    
    // Check if target died
    if (target.health <= 0) {
        handleTargetDeath(target);
    }
}

// Player death function
function playerDied() {
    console.log('Player died!');
    gameState.isPaused = true;
    document.getElementById('death-screen').style.display = 'flex';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('settings-menu').style.display = 'none';
    dropInventoryOnDeath();
}

// Drop items on death
function dropInventoryOnDeath() {
    if (!gameState.player.inventory.length) return;

    const currentChunkX = Math.floor(gameState.player.x / CHUNK_SIZE);
    const currentChunkY = Math.floor(gameState.player.y / CHUNK_SIZE);
    const chunkKey = getChunkKey(currentChunkX * CHUNK_SIZE, currentChunkY * CHUNK_SIZE);
    const currentChunk = gameState.chunks.get(chunkKey);

    if (currentChunk) {
        // Drop half of the inventory items
        const itemsToDrop = Math.ceil(gameState.player.inventory.length / 2);
        for (let i = 0; i < itemsToDrop; i++) {
            const item = gameState.player.inventory.pop();
            if (item) {
                item.x = gameState.player.x + (Math.random() * 40 - 20);
                item.y = gameState.player.y + (Math.random() * 40 - 20);
                currentChunk.items.push(item);
            }
        }
    }
}

// Respawn function
function respawnPlayer() {
    console.log('Respawning player...');
    gameState.player.health = gameState.player.maxHealth;
    gameState.player.x = 0;
    gameState.player.y = 0;
    gameState.camera.x = gameState.player.x;
    gameState.camera.y = gameState.player.y;
    gameState.isPaused = false; // Ensure game is unpaused when player respawns
    document.getElementById('death-screen').style.display = 'none';
    
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) {
        deathScreen.style.display = 'none';
    }
    
    // Clear any nearby enemies
    const safeRadius = CHUNK_SIZE / 2;
    for (const chunk of gameState.chunks.values()) {
        chunk.enemies = chunk.enemies.filter(enemy => {
            const dx = enemy.x - gameState.player.x;
            const dy = enemy.y - gameState.player.y;
            return Math.hypot(dx, dy) > safeRadius;
        });
    }
    
    updateStats();
}

// Add item to inventory
function addItemToInventory(item) {
    console.log('Adding item to inventory:', item);
    if (gameState.player.inventory.length < gameState.player.maxInventory) {
        gameState.player.inventory.push(item);
        updateInventoryUI();
        return true;
    }
    return false;
}

// Update inventory UI
function updateInventoryUI() {
    console.log('Updating inventory UI');
    const inventoryPanel = document.getElementById('inventory-panel');
    if (!inventoryPanel) return;

    // Clear current inventory display
    inventoryPanel.innerHTML = '';

    // Create inventory slots
    for (let i = 0; i < gameState.player.maxInventory; i++) {
        const slot = document.createElement('div');
        slot.className = 'inventory-slot';
        
        if (i < gameState.player.inventory.length) {
            const item = gameState.player.inventory[i];
            slot.style.backgroundColor = getItemColor(item.type);
            slot.title = item.type;
            
            // Add click handler for using/dropping items
            slot.onclick = () => {
                useItem(i);
            };
        }
        
        inventoryPanel.appendChild(slot);
    }
}

// Use or drop item
function useItem(index) {
    console.log('Using item at index:', index);
    if (index >= 0 && index < gameState.player.inventory.length) {
        const item = gameState.player.inventory[index];
        
        switch(item.type) {
            case 'herb':
                // Heal player
                const healAmount = 30;
                gameState.player.health = Math.min(gameState.player.maxHealth, gameState.player.health + healAmount);
                floatingTexts.push({
                    x: gameState.player.x,
                    y: gameState.player.y,
                    text: `+${healAmount} HP`,
                    color: '#00ff00',
                    age: 0
                });
                gameState.player.inventory.splice(index, 1);
                break;
            
            default:
                // Drop item
                const currentChunkX = Math.floor(gameState.player.x / CHUNK_SIZE);
                const currentChunkY = Math.floor(gameState.player.y / CHUNK_SIZE);
                const chunkKey = getChunkKey(currentChunkX * CHUNK_SIZE, currentChunkY * CHUNK_SIZE);
                const currentChunk = gameState.chunks.get(chunkKey);
                
                if (currentChunk) {
                    const droppedItem = gameState.player.inventory.splice(index, 1)[0];
                    droppedItem.x = gameState.player.x + (Math.random() * 20 - 10);
                    droppedItem.y = gameState.player.y + (Math.random() * 20 - 10);
                    currentChunk.items.push(droppedItem);
                }
                break;
        }
        
        updateInventoryUI();
    }
}

// Update stats display
function updateStats() {
    const healthBar = document.querySelector('#health-bar > div');
    const manaBar = document.querySelector('#mana-bar > div');
    
    if (healthBar) {
        const healthPercent = (gameState.player.health / gameState.player.maxHealth) * 100;
        healthBar.style.width = `${healthPercent}%`;
        healthBar.style.backgroundColor = `rgb(${255 - healthPercent * 2.55}, ${healthPercent * 2.55}, 0)`;
    }
    
    if (manaBar) {
        const manaPercent = (gameState.player.mana / gameState.player.maxMana) * 100;
        manaBar.style.width = `${manaPercent}%`;
    }
}

// Render function
function render() {
    try {
        // Clear canvas
        ctx.fillStyle = '#111111'; // Darker background color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    
        // Draw grid
        ctx.strokeStyle = '#222222'; // Subtle grid lines
        ctx.lineWidth = 1;
        const gridSize = 32;
        const offsetX = (-gameState.camera.x % gridSize + gridSize) % gridSize;
        const offsetY = (-gameState.camera.y % gridSize + gridSize) % gridSize;
    
        for (let x = offsetX; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
    
        for (let y = offsetY; y < canvas.height; y += gridSize) {
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
    
        // Draw UI
        drawUI();
    } catch (error) {
        // Log rendering errors to debug overlay
        const debugOverlay = document.getElementById('debug-overlay');
        if (debugOverlay) {
            debugOverlay.innerHTML += `<br><span style="color:red">RENDER ERROR: ${error.message}</span>`;
        }
        console.error('Render error:', error);
    }
}

// Draw UI elements
function drawUI() {
    // Health bar
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

    // Mana bar
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

    // Inventory
    const inventoryX = canvas.width - 220;
    const inventoryY = 20;
    const slotSize = 40;
    const padding = 5;
    
    for (let i = 0; i < gameState.player.maxInventory; i++) {
        const x = inventoryX + (i % 4) * (slotSize + padding);
        const y = inventoryY + Math.floor(i / 4) * (slotSize + padding);
        
        ctx.fillStyle = '#333333';
        ctx.fillRect(x, y, slotSize, slotSize);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(x, y, slotSize, slotSize);
        
        if (gameState.player.inventory[i]) {
            const item = gameState.player.inventory[i];
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(x + slotSize/2, y + slotSize/2, 5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(item.type, x + slotSize/2, y + slotSize - 5);
        }
    }
}

// Helper function to get chunk key
function getChunkKey(x, y) {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    return `${chunkX},${chunkY}`;
}

// Helper function to convert world coordinates to screen coordinates
function worldToScreen(x, y) {
    return {
        x: x - gameState.camera.x + canvas.width / 2,
        y: y - gameState.camera.y + canvas.height / 2
    };
}

// Helper function to convert screen coordinates to world coordinates
function screenToWorld(x, y) {
    return {
        x: x + gameState.camera.x - canvas.width / 2,
        y: y + gameState.camera.y - canvas.height / 2
    };
}

// Update function
function update() {
    if (gameState.isPaused) return;

    // Handle player movement based on control mode
    if (gameState.settings.controlMode === 'laptop') {
        if (keys['ArrowLeft']) {
            gameState.player.x -= gameState.player.speed;
        }
        if (keys['ArrowRight']) {
            gameState.player.x += gameState.player.speed;
        }
        if (keys['ArrowUp']) {
            gameState.player.y -= gameState.player.speed;
        }
        if (keys['ArrowDown']) {
            gameState.player.y += gameState.player.speed;
        }
        if (keys[' ']) {
            handleAttack();
        }
    } else { // desktop mode
        if (keys['a'] || keys['A']) {
            gameState.player.x -= gameState.player.speed;
        }
        if (keys['d'] || keys['D']) {
            gameState.player.x += gameState.player.speed;
        }
        if (keys['w'] || keys['W']) {
            gameState.player.y -= gameState.player.speed;
        }
        if (keys['s'] || keys['S']) {
            gameState.player.y += gameState.player.speed;
        }
        if (keys[' ']) {
            handleAttack();
        }
    }

    // Update camera to follow player
    gameState.camera.x = gameState.player.x;
    gameState.camera.y = gameState.player.y;

    // Update P2P position
    if (gameState.p2pServer) {
        gameState.p2pServer.updatePeerData({
            x: gameState.player.x,
            y: gameState.player.y,
            health: gameState.player.health,
            maxHealth: gameState.player.maxHealth
        });
    }

    // Update chunks based on player position
    updateChunks();

    // Update combat
    updateCombat();

    // Update floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const text = floatingTexts[i];
        text.y -= 1;
        text.life -= 16;
        if (text.life <= 0) {
            floatingTexts.splice(i, 1);
        }
    }

    // Update attack effects
    updateAttackEffects();

    // Update stats
    updateStats();
}

// Handle P2P messages
function handleP2PMessage(message) {
    switch (message.type) {
        case 'attack':
            const attacker = gameState.otherPlayers.get(message.senderId);
            if (attacker) {
                const dx = gameState.player.x - attacker.x;
                const dy = gameState.player.y - attacker.y;
                const distance = Math.hypot(dx, dy);
                
                if (distance < 50) { // Attack range
                    attack(attacker, gameState.player);
                    createAttackEffect(attacker.x, attacker.y, gameState.player.x, gameState.player.y);
                }
            }
            break;
    }
}

// Add this function to handle attacks
function handleAttack() {
    if (gameState.player.attackCooldown <= 0) {
        // Find closest target
        let closestTarget = null;
        let closestDistance = Infinity;
        const ATTACK_RANGE = 50;

        // Check enemies
        for (const chunk of gameState.chunks.values()) {
            for (const enemy of chunk.enemies || []) {
                const dx = enemy.x - gameState.player.x;
                const dy = enemy.y - gameState.player.y;
                const distance = Math.hypot(dx, dy);
                
                if (distance < closestDistance && distance < ATTACK_RANGE) {
                    closestDistance = distance;
                    closestTarget = enemy;
                }
            }
        }

        // Check other players
        for (const [id, player] of gameState.otherPlayers) {
            const dx = player.x - gameState.player.x;
            const dy = player.y - gameState.player.y;
            const distance = Math.hypot(dx, dy);
            
            if (distance < closestDistance && distance < ATTACK_RANGE) {
                closestDistance = distance;
                closestTarget = player;
                
                // Broadcast attack to other players
                if (gameState.p2pServer) {
                    gameState.p2pServer.broadcast('attack', {
                        x: gameState.player.x,
                        y: gameState.player.y
                    });
                }
            }
        }

        if (closestTarget) {
            attack(gameState.player, closestTarget);
            createAttackEffect(gameState.player.x, gameState.player.y, closestTarget.x, closestTarget.y);
            gameState.player.attackCooldown = 500; // 500ms cooldown
        }
    }
}

// Attack function
function attack(attacker, target) {
    if (!target || target.health <= 0) return;
    
    const damage = Math.floor(Math.random() * attacker.damage * 0.5) + attacker.damage * 0.5;
    target.health = Math.max(0, target.health - damage);
    
    // Create floating damage text
    floatingTexts.push({
        x: target.x,
        y: target.y,
        text: damage.toString(),
        color: '#ff0000',
        age: 0
    });
    
    // Create attack effect
    attackEffects.push({
        x: target.x,
        y: target.y,
        radius: 10,
        age: 0
    });
    
    // Check if target died
    if (target.health <= 0) {
        if (target === gameState.player) {
            playerDied();
        } else if (target.type === 'enemy') {
            // Handle enemy death
            const chunkKey = getChunkKey(Math.floor(target.x / CHUNK_SIZE) * CHUNK_SIZE, Math.floor(target.y / CHUNK_SIZE) * CHUNK_SIZE);
            const chunk = gameState.chunks.get(chunkKey);
            if (chunk) {
                chunk.enemies = chunk.enemies.filter(e => e !== target);
            }
        }
    }
}

// Player death function
function playerDied() {
    console.log('Player died!');
    gameState.isPaused = true;
    document.getElementById('death-screen').style.display = 'flex';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('settings-menu').style.display = 'none';
    dropInventoryOnDeath();
}

// Drop items on death
function dropInventoryOnDeath() {
    const currentChunkX = Math.floor(gameState.player.x / CHUNK_SIZE);
    const currentChunkY = Math.floor(gameState.player.y / CHUNK_SIZE);
    const chunkKey = getChunkKey(currentChunkX * CHUNK_SIZE, currentChunkY * CHUNK_SIZE);
    const currentChunk = gameState.chunks.get(chunkKey);

    if (currentChunk && gameState.player.inventory.length > 0) {
        // Drop half of the inventory items
        const itemsToDrop = Math.ceil(gameState.player.inventory.length / 2);
        for (let i = 0; i < itemsToDrop; i++) {
            const item = gameState.player.inventory.pop();
            if (item) {
                item.x = gameState.player.x + (Math.random() * 40 - 20);
                item.y = gameState.player.y + (Math.random() * 40 - 20);
                currentChunk.items.push(item);
            }
        }
    }
}

// Respawn function
function respawnPlayer() {
    gameState.player.health = gameState.player.maxHealth;
    gameState.player.x = 0;
    gameState.player.y = 0;
    gameState.camera.x = gameState.player.x;
    gameState.camera.y = gameState.player.y;
    gameState.isPaused = false; // Ensure game is unpaused when player respawns
    document.getElementById('death-screen').style.display = 'none';
    
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) {
        deathScreen.style.display = 'none';
    }
    
    // Clear any nearby enemies
    const safeRadius = CHUNK_SIZE / 2;
    for (const chunk of gameState.chunks.values()) {
        chunk.enemies = chunk.enemies.filter(enemy => {
            const dx = enemy.x - gameState.player.x;
            const dy = enemy.y - gameState.player.y;
            return Math.hypot(dx, dy) > safeRadius;
        });
    }
    
    updateStats();
}

// Add item to inventory
function addItemToInventory(item) {
    if (gameState.player.inventory.length < gameState.player.maxInventory) {
        gameState.player.inventory.push(item);
        updateInventoryUI();
        return true;
    }
    return false;
}

// Update inventory UI
function updateInventoryUI() {
    console.log('Updating inventory UI');
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

// Use or drop item
function useItem(index) {
    if (index >= 0 && index < gameState.player.inventory.length) {
        const item = gameState.player.inventory[index];
        
        switch(item.type) {
            case 'herb':
                // Heal player
                const healAmount = 30;
                gameState.player.health = Math.min(gameState.player.maxHealth, gameState.player.health + healAmount);
                floatingTexts.push({
                    x: gameState.player.x,
                    y: gameState.player.y,
                    text: `+${healAmount} HP`,
                    color: '#00ff00',
                    age: 0
                });
                gameState.player.inventory.splice(index, 1);
                break;
            
            default:
                // Drop item
                const currentChunkX = Math.floor(gameState.player.x / CHUNK_SIZE);
                const currentChunkY = Math.floor(gameState.player.y / CHUNK_SIZE);
                const chunkKey = getChunkKey(currentChunkX * CHUNK_SIZE, currentChunkY * CHUNK_SIZE);
                const currentChunk = gameState.chunks.get(chunkKey);
                
                if (currentChunk) {
                    const droppedItem = gameState.player.inventory.splice(index, 1)[0];
                    droppedItem.x = gameState.player.x + (Math.random() * 20 - 10);
                    droppedItem.y = gameState.player.y + (Math.random() * 20 - 10);
                    currentChunk.items.push(droppedItem);
                }
                break;
        }
        
        updateInventoryUI();
    }
}

// Update stats display
function updateStats() {
    const healthBar = document.querySelector('#health-bar > div');
    const manaBar = document.querySelector('#mana-bar > div');
    
    if (healthBar && manaBar) {
        healthBar.style.width = `${(gameState.player.health / gameState.player.maxHealth) * 100}%`;
        manaBar.style.width = `${(gameState.player.mana / gameState.player.maxMana) * 100}%`;
    }
}

// Render function
function render() {
    try {
        // Clear canvas
        ctx.fillStyle = '#111111'; // Darker background color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    
        // Draw grid
        ctx.strokeStyle = '#222222'; // Subtle grid lines
        ctx.lineWidth = 1;
        const gridSize = 32;
        const offsetX = (-gameState.camera.x % gridSize + gridSize) % gridSize;
        const offsetY = (-gameState.camera.y % gridSize + gridSize) % gridSize;
    
        for (let x = offsetX; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
    
        for (let y = offsetY; y < canvas.height; y += gridSize) {
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
    
        // Draw UI
        drawUI();
    } catch (error) {
        // Log rendering errors to debug overlay
        const debugOverlay = document.getElementById('debug-overlay');
        if (debugOverlay) {
            debugOverlay.innerHTML += `<br><span style="color:red">RENDER ERROR: ${error.message}</span>`;
        }
        console.error('Render error:', error);
    }
}

// Draw UI elements
function drawUI() {
    // Health bar
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

    // Mana bar
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

    // Inventory
    const inventoryX = canvas.width - 220;
    const inventoryY = 20;
    const slotSize = 40;
    const padding = 5;
    
    for (let i = 0; i < gameState.player.maxInventory; i++) {
        const x = inventoryX + (i % 4) * (slotSize + padding);
        const y = inventoryY + Math.floor(i / 4) * (slotSize + padding);
        
        ctx.fillStyle = '#333333';
        ctx.fillRect(x, y, slotSize, slotSize);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(x, y, slotSize, slotSize);
        
        if (gameState.player.inventory[i]) {
            const item = gameState.player.inventory[i];
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(x + slotSize/2, y + slotSize/2, 5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(item.type, x + slotSize/2, y + slotSize - 5);
        }
    }
}

// Helper function to get chunk key
function getChunkKey(x, y) {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    return `${chunkX},${chunkY}`;
}

// Helper function to convert world coordinates to screen coordinates
function worldToScreen(x, y) {
    return {
        x: x - gameState.camera.x + canvas.width / 2,
        y: y - gameState.camera.y + canvas.height / 2
    };
}

// Helper function to convert screen coordinates to world coordinates
function screenToWorld(x, y) {
    return {
        x: x + gameState.camera.x - canvas.width / 2,
        y: y + gameState.camera.y - canvas.height / 2
    };
}

// Update visible chunks
function updateChunks() {
    const playerChunkX = Math.floor(gameState.player.x / CHUNK_SIZE);
    const playerChunkY = Math.floor(gameState.player.y / CHUNK_SIZE);

    // Generate or load chunks in render distance
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
        for (let dy = -RENDER_DISTANCE; dy <= RENDER_DISTANCE; dy++) {
            const chunkX = playerChunkX + dx;
            const chunkY = playerChunkY + dy;
            const key = getChunkKey(chunkX * CHUNK_SIZE, chunkY * CHUNK_SIZE);

            if (!gameState.chunks.has(key)) {
                gameState.chunks.set(key, generateChunk(chunkX, chunkY));
            }
        }
    }

    // Remove chunks outside render distance
    for (const [key, chunk] of gameState.chunks) {
        const chunkX = Math.floor(chunk.x / CHUNK_SIZE);
        const chunkY = Math.floor(chunk.y / CHUNK_SIZE);
        
        if (Math.abs(chunkX - playerChunkX) > RENDER_DISTANCE || 
            Math.abs(chunkY - playerChunkY) > RENDER_DISTANCE) {
            gameState.chunks.delete(key);
        }
    }
}

// Helper functions
function getItemColor(type) {
    const colors = {
        herb: '#44ff44',
        coin: '#ffff44',
        gem: '#ff44ff',
        scroll: '#4444ff'
    };
    return colors[type] || '#ffffff';
}

function createFloatingText(x, y, text) {
    floatingTexts.push({
        x,
        y,
        text,
        color: '#ffffff',
        age: 0
    });
}

function attackPlayer(damage) {
    gameState.player.health = Math.max(0, gameState.player.health - damage);
    createFloatingText(gameState.player.x, gameState.player.y, `-${damage}`);
    updateStats();

    // Check for death
    if (gameState.player.health <= 0) {
        playerDied();
    }
}

function playerDied() {
    console.log('Player died!');
    gameState.isPaused = true;
    document.getElementById('death-screen').style.display = 'flex';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('settings-menu').style.display = 'none';
    dropInventoryOnDeath();
}

function dropInventoryOnDeath() {
    const currentChunkX = Math.floor(gameState.player.x / CHUNK_SIZE);
    const currentChunkY = Math.floor(gameState.player.y / CHUNK_SIZE);
    const chunkKey = getChunkKey(currentChunkX * CHUNK_SIZE, currentChunkY * CHUNK_SIZE);
    const currentChunk = gameState.chunks.get(chunkKey);

    if (currentChunk && gameState.player.inventory.length > 0) {
        // Drop half of the inventory items
        const itemsToDrop = Math.ceil(gameState.player.inventory.length / 2);
        for (let i = 0; i < itemsToDrop; i++) {
            const item = gameState.player.inventory.pop();
            if (item) {
                item.x = gameState.player.x + (Math.random() * 40 - 20);
                item.y = gameState.player.y + (Math.random() * 40 - 20);
                currentChunk.items.push(item);
            }
        }
    }
}

function respawnPlayer() {
    gameState.player.health = gameState.player.maxHealth;
    gameState.player.x = 0;
    gameState.player.y = 0;
    gameState.camera.x = gameState.player.x;
    gameState.camera.y = gameState.player.y;
    gameState.isPaused = false; // Ensure game is unpaused when player respawns
    document.getElementById('death-screen').style.display = 'none';
    
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) {
        deathScreen.style.display = 'none';
    }
    
    // Clear any nearby enemies
    const safeRadius = CHUNK_SIZE / 2;
    for (const chunk of gameState.chunks.values()) {
        chunk.enemies = chunk.enemies.filter(enemy => {
            const dx = enemy.x - gameState.player.x;
            const dy = enemy.y - gameState.player.y;
            return Math.hypot(dx, dy) > safeRadius;
        });
    }
    
    updateStats();
}

function addItemToInventory(item) {
    if (gameState.player.inventory.length < gameState.player.maxInventory) {
        gameState.player.inventory.push(item);
        updateInventoryUI();
        return true;
    }
    return false;
}

function updateInventoryUI() {
    console.log('Updating inventory UI');
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

function useItem(index) {
    if (index >= 0 && index < gameState.player.inventory.length) {
        const item = gameState.player.inventory[index];
        
        switch(item.type) {
            case 'herb':
                // Heal player
                const healAmount = 30;
                gameState.player.health = Math.min(gameState.player.maxHealth, gameState.player.health + healAmount);
                createFloatingText(gameState.player.x, gameState.player.y, `+${healAmount} HP`);
                gameState.player.inventory.splice(index, 1);
                break;
            
            default:
                // Drop item
                const currentChunkX = Math.floor(gameState.player.x / CHUNK_SIZE);
                const currentChunkY = Math.floor(gameState.player.y / CHUNK_SIZE);
                const chunkKey = getChunkKey(currentChunkX * CHUNK_SIZE, currentChunkY * CHUNK_SIZE);
                const currentChunk = gameState.chunks.get(chunkKey);
                
                if (currentChunk) {
                    const droppedItem = gameState.player.inventory.splice(index, 1)[0];
                    droppedItem.x = gameState.player.x + (Math.random() * 20 - 10);
                    droppedItem.y = gameState.player.y + (Math.random() * 20 - 10);
                    currentChunk.items.push(droppedItem);
                }
                break;
        }
        
        updateInventoryUI();
    }
}

function spawnRandomItems() {
    const types = ['herb', 'coin', 'gem', 'scroll'];
    for (let i = 0; i < 10; i++) {
        gameState.items.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            type: types[Math.floor(Math.random() * types.length)],
            pulseOffset: Math.random() * Math.PI * 2
        });
    }
}

function spawnEnemies() {
    for (let i = 0; i < 5; i++) {
        gameState.enemies.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            speed: 2,
            health: 100,
            damage: 10,
            lastAttack: 0,
            pulseOffset: Math.random() * Math.PI * 2,
            attackCooldown: 0
        });
    }
}

function spawnNPCs() {
    for (let i = 0; i < 3; i++) {
        gameState.npcs.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            type: 'merchant',
            inventory: generateNPCInventory(),
            pulseOffset: Math.random() * Math.PI * 2
        });
    }
}

function generateNPCInventory() {
    const inventory = [];
    const types = ['herb', 'coin', 'gem', 'scroll'];
    
    const numItems = Math.floor(Math.random() * 5) + 3;
    for (let i = 0; i < numItems; i++) {
        inventory.push({
            type: types[Math.floor(Math.random() * types.length)],
            price: Math.floor(Math.random() * 10) + 5
        });
    }
    
    return inventory;
}

// Trading functions
function startTrade(npc) {
    gameState.activeTrade = {
        npc: npc,
        playerItems: [],
        npcItems: generateTradeItems()
    };
    
    // Show trade panel
    const tradePanel = document.getElementById('trade-panel');
    const npcNameSpan = document.getElementById('trade-npc-name');
    npcNameSpan.textContent = npc.name;
    tradePanel.classList.add('active');
    
    // Update trade panel contents
    updateTradePanel();
}

function generateTradeItems() {
    const items = [];
    const possibleItems = [
        { type: 'herb', value: 10 },
        { type: 'coin', value: 5 },
        { type: 'gem', value: 50 },
        { type: 'scroll', value: 30 },
        { type: 'potion', value: 20 }
    ];
    
    const numItems = Math.floor(Math.random() * 4) + 2; // 2-5 items
    for (let i = 0; i < numItems; i++) {
        const item = { ...possibleItems[Math.floor(Math.random() * possibleItems.length)] };
        item.id = Math.random().toString(36).substr(2, 9);
        items.push(item);
    }
    
    return items;
}

function updateTradePanel() {
    if (!gameState.activeTrade) return;
    
    const playerItemsDiv = document.getElementById('player-items');
    const npcItemsDiv = document.getElementById('npc-items');
    
    // Clear previous contents
    while (playerItemsDiv.children.length > 1) {
        playerItemsDiv.removeChild(playerItemsDiv.lastChild);
    }
    while (npcItemsDiv.children.length > 1) {
        npcItemsDiv.removeChild(npcItemsDiv.lastChild);
    }
    
    // Add player items
    gameState.player.inventory.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'trade-item';
        itemDiv.innerHTML = `
            <span class="item-name">${item.type}</span>
            <span class="item-value">${item.value} gold</span>
        `;
        itemDiv.onclick = () => {
            toggleTradeItem('player', index);
        };
        if (gameState.activeTrade.playerItems.includes(index)) {
            itemDiv.classList.add('selected');
        }
        playerItemsDiv.appendChild(itemDiv);
    });
    
    // Add NPC items
    gameState.activeTrade.npcItems.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'trade-item';
        itemDiv.innerHTML = `
            <span class="item-name">${item.type}</span>
            <span class="item-value">${item.value} gold</span>
        `;
        itemDiv.onclick = () => {
            toggleTradeItem('npc', index);
        };
        if (gameState.activeTrade.npcItems.includes(index)) {
            itemDiv.classList.add('selected');
        }
        npcItemsDiv.appendChild(itemDiv);
    });
}

function toggleTradeItem(source, index) {
    if (!gameState.activeTrade) return;
    
    const items = source === 'player' ? gameState.activeTrade.playerItems : gameState.activeTrade.npcItems;
    const itemIndex = items.indexOf(index);
    
    if (itemIndex === -1) {
        items.push(index);
    } else {
        items.splice(itemIndex, 1);
    }
    
    updateTradePanel();
}

function confirmTrade() {
    if (!gameState.activeTrade) return;
    
    // Get selected items
    const playerItems = gameState.activeTrade.playerItems.map(index => gameState.player.inventory[index]);
    const npcItems = gameState.activeTrade.npcItems;
    
    // Calculate trade values
    const playerValue = playerItems.reduce((sum, item) => sum + item.value, 0);
    const npcValue = npcItems.reduce((sum, item) => sum + item.value, 0);
    
    // Execute trade if values are equal
    if (playerValue === npcValue) {
        // Remove traded items from player's inventory
        for (const index of gameState.activeTrade.playerItems.sort((a, b) => b - a)) {
            gameState.player.inventory.splice(index, 1);
        }
        
        // Add NPC items to player's inventory
        for (const item of npcItems) {
            gameState.player.inventory.push(item);
        }
        
        // Close trade panel
        closeTrade();
        createFloatingText(gameState.player.x, gameState.player.y - 30, "Trade successful!");
    } else {
        createFloatingText(gameState.player.x, gameState.player.y - 30, "Trade values must be equal!");
    }
}

function closeTrade() {
    gameState.activeTrade = null;
    const tradePanel = document.getElementById('trade-panel');
    tradePanel.classList.remove('active');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize game
    initGame();
});

// Handle keyboard input
function handleKeyboard(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        gameState.isPaused = !gameState.isPaused;
        const pauseMenu = document.getElementById('pause-menu');
        const settingsMenu = document.getElementById('settings-menu');
        
        if (gameState.isPaused) {
            pauseMenu.style.display = 'flex';
            settingsMenu.style.display = 'none';
        } else {
            pauseMenu.style.display = 'none';
            settingsMenu.style.display = 'none';
        }
    } else if (!gameState.isPaused) {
        if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
        keys[e.key] = true;
    }
}

// Start game when window loads
window.addEventListener('load', initGame);

// Handle ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        gameState.isPaused = !gameState.isPaused;
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
});

// Handle settings button
document.getElementById('settings-button')?.addEventListener('click', function() {
    const settingsMenu = document.getElementById('settings-menu');
    const pauseMenu = document.getElementById('pause-menu');
    if (settingsMenu && pauseMenu) {
        settingsMenu.style.display = 'flex';
        pauseMenu.style.display = 'none';
    }
});

// Handle back to pause button
document.getElementById('back-to-pause')?.addEventListener('click', function() {
    const settingsMenu = document.getElementById('settings-menu');
    const pauseMenu = document.getElementById('pause-menu');
    if (settingsMenu && pauseMenu) {
        settingsMenu.style.display = 'none';
        pauseMenu.style.display = 'flex';
    }
});

// Handle resume button
document.getElementById('resume-button')?.addEventListener('click', function() {
    gameState.isPaused = false;
    const pauseMenu = document.getElementById('pause-menu');
    const settingsMenu = document.getElementById('settings-menu');
    if (pauseMenu && settingsMenu) {
        pauseMenu.style.display = 'none';
        settingsMenu.style.display = 'none';
    }
});

// Handle save settings button
document.getElementById('save-settings')?.addEventListener('click', function() {
    const controlMode = document.getElementById('control-mode').value;
    gameState.settings.controlMode = controlMode;
    localStorage.setItem('gameSettings', JSON.stringify(gameState.settings));
    
    const settingsMenu = document.getElementById('settings-menu');
    const pauseMenu = document.getElementById('pause-menu');
    if (settingsMenu && pauseMenu) {
        settingsMenu.style.display = 'none';
        pauseMenu.style.display = 'flex';
    }
});

// Load settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
        gameState.settings = JSON.parse(savedSettings);
    }
}

// Initialize settings
window.addEventListener('load', loadSettings);

// Handle menu buttons
document.addEventListener('DOMContentLoaded', function() {
    // Resume button
    document.getElementById('resume-button').addEventListener('click', function() {
        gameState.isPaused = false;
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('settings-menu').style.display = 'none';
    });

    // Settings button
    document.getElementById('settings-button').addEventListener('click', function() {
        console.log('Settings clicked');
    });

    // Back to pause button
    document.getElementById('back-to-pause').addEventListener('click', function() {
        console.log('Back button clicked');
    });

    // Save settings button
    document.getElementById('save-settings').addEventListener('click', function() {
        const controlMode = document.getElementById('control-mode').value;
        gameState.settings.controlMode = controlMode;
        localStorage.setItem('gameSettings', JSON.stringify(gameState.settings));
        
        document.getElementById('settings-menu').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'flex';
    });

    // Respawn button
    document.getElementById('respawn-button').addEventListener('click', function() {
        respawnPlayer();
    });
};

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize game
    initGame();
});

// Combat mechanics
function attack(attacker, target) {
    // Calculate damage
    const damage = attacker.damage;
    target.health = Math.max(0, target.health - damage);
    
    // Create floating damage text
    floatingTexts.push({
        x: target.x,
        y: target.y,
        text: damage.toString(),
        color: '#ff0000',
        age: 0
    });
    
    // Create attack effect
    attackEffects.push({
        x: target.x,
        y: target.y,
        radius: 10,
        age: 0
    });
    
    // Check if target died
    if (target.health <= 0) {
        handleTargetDeath(target);
    }
}

// Handle target death
function handleTargetDeath(target) {
    if (target === gameState.player) {
        playerDied();
    } else {
        // Remove enemy from current chunk
        const currentChunk = getCurrentChunk();
        if (currentChunk) {
            currentChunk.enemies = currentChunk.enemies.filter(e => e !== target);
        }
    }
}

function createAttackEffect(startX, startY, endX, endY) {
    const effect = {
        startX,
        startY,
        endX,
        endY,
        progress: 0,
        duration: 200 // milliseconds
    };
    attackEffects.push(effect);
}

// Update attack effects
function updateAttackEffects() {
    const now = Date.now();
    for (let i = attackEffects.length - 1; i >= 0; i--) {
        const effect = attackEffects[i];
        effect.progress += 16; // Assume ~60fps
        if (effect.progress >= effect.duration) {
            attackEffects.splice(i, 1);
        }
    }
}

// Draw attack effects
function drawAttackEffects() {
    ctx.save();
    for (const effect of attackEffects) {
        const progress = effect.progress / effect.duration;
        const x = effect.startX + (effect.endX - effect.startX) * progress;
        const y = effect.startY + (effect.endY - effect.startY) * progress;
        
        ctx.beginPath();
        ctx.arc(x - gameState.camera.x + canvas.width/2, 
                y - gameState.camera.y + canvas.height/2, 
                5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 0, ${1 - progress})`;
        ctx.fill();
    }
    ctx.restore();
}

// Update combat in gameLoop
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
        for (const [id, otherPlayer] of gameState.otherPlayers) {
            const dx = otherPlayer.x - gameState.player.x;
            const dy = otherPlayer.y - gameState.player.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist < closestDist) {
                closest = otherPlayer;
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
            const damage = attack(gameState.player, closest);
            gameState.player.attackCooldown = 500; // 0.5 second cooldown
            
            // If attacking another player, send damage via P2P
            if (closest.id && gameState.otherPlayers.has(closest.id)) {
                sendP2PMessage({
                    type: 'damage',
                    damage: damage,
                    targetId: closest.id
                });
            }
        }
    }
    
    // Update enemy combat
    for (const chunk of gameState.chunks.values()) {
        for (const enemy of chunk.enemies) {
            // Move towards player if in range
            const dx = gameState.player.x - enemy.x;
            const dy = gameState.player.y - enemy.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist < 300) { // Aggro range
                // Move towards player
                const speed = 2;
                enemy.x += (dx / dist) * speed;
                enemy.y += (dy / dist) * speed;
                
                // Attack if close enough
                if (dist < 30 && (!enemy.attackCooldown || enemy.attackCooldown <= 0)) {
                    attack(enemy, gameState.player);
                    enemy.attackCooldown = 1000; // 1 second cooldown
                }
            }
            
            // Update enemy cooldown
            if (enemy.attackCooldown > 0) {
                enemy.attackCooldown -= 16;
            }
        }
    }
    
    // Update attack effects
    updateAttackEffects();
}

// Add combat-related P2P message handling
function handleP2PMessage(message) {
    switch(message.type) {
        case 'damage':
            if (message.targetId === gameState.player.id) {
                // We were hit
                gameState.player.health = Math.max(0, gameState.player.health - message.damage);
                createFloatingText(gameState.player.x, gameState.player.y, `-${message.damage}`);
                updateStats();
                
                // Check for death
                if (gameState.player.health <= 0) {
                    playerDied();
                }
            }
            break;
        case 'position':
            if (gameState.otherPlayers.has(message.id)) {
                const player = gameState.otherPlayers.get(message.id);
                player.x = message.x;
                player.y = message.y;
                player.health = message.health;
            }
            break;
    }
}

// Add interaction with NPCs
function handleNPCInteraction(npc) {
    const dx = gameState.player.x - npc.x;
    const dy = gameState.player.y - npc.y;
    const distance = Math.hypot(dx, dy);
    
    if (distance < 50) { // If player is close enough
        startTrade(npc);
    }
}

// Toggle pause menu
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

// Handle ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        gameState.isPaused = !gameState.isPaused;
        togglePauseMenu();
    }
});

// Handle settings button
document.getElementById('settings-button')?.addEventListener('click', function() {
    const settingsMenu = document.getElementById('settings-menu');
    const pauseMenu = document.getElementById('pause-menu');
    if (settingsMenu && pauseMenu) {
        settingsMenu.style.display = 'flex';
        pauseMenu.style.display = 'none';
    }
});

// Handle back to pause button
document.getElementById('back-to-pause')?.addEventListener('click', function() {
    const settingsMenu = document.getElementById('settings-menu');
    const pauseMenu = document.getElementById('pause-menu');
    if (settingsMenu && pauseMenu) {
        settingsMenu.style.display = 'none';
        pauseMenu.style.display = 'flex';
    }
});

// Handle resume button
document.getElementById('resume-button')?.addEventListener('click', function() {
    gameState.isPaused = false;
    togglePauseMenu();
});

// Handle save settings button
document.getElementById('save-settings')?.addEventListener('click', function() {
    const controlMode = document.getElementById('control-mode').value;
    gameState.settings.controlMode = controlMode;
    localStorage.setItem('gameSettings', JSON.stringify(gameState.settings));
    
    const settingsMenu = document.getElementById('settings-menu');
    const pauseMenu = document.getElementById('pause-menu');
    if (settingsMenu && pauseMenu) {
        settingsMenu.style.display = 'none';
        pauseMenu.style.display = 'flex';
    }
});

// Load settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
        gameState.settings = JSON.parse(savedSettings);
    }
}

// Initialize settings
window.addEventListener('load', loadSettings);

// Handle menu buttons
document.addEventListener('DOMContentLoaded', function() {
    // Resume button
    document.getElementById('resume-button').addEventListener('click', function() {
        gameState.isPaused = false;
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('settings-menu').style.display = 'none';
    });

    // Settings button
    document.getElementById('settings-button').addEventListener('click', function() {
        console.log('Settings clicked');
    });

    // Back to pause button
    document.getElementById('back-to-pause').addEventListener('click', function() {
        console.log('Back button clicked');
    });

    // Save settings button
    document.getElementById('save-settings').addEventListener('click', function() {
        const controlMode = document.getElementById('control-mode').value;
        gameState.settings.controlMode = controlMode;
        localStorage.setItem('gameSettings', JSON.stringify(gameState.settings));
        
        document.getElementById('settings-menu').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'flex';
    });

    // Respawn button
    document.getElementById('respawn-button').addEventListener('click', function() {
        respawnPlayer();
    });
};

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize game
    initGame();
});

// Combat mechanics
function attack(attacker, target) {
    // Calculate damage
    const damage = attacker.damage;
    target.health = Math.max(0, target.health - damage);
    
    // Create floating damage text
    floatingTexts.push({
        x: target.x,
        y: target.y,
        text: damage.toString(),
        color: '#ff0000',
        age: 0
    });
    
    // Create attack effect
    attackEffects.push({
        x: target.x,
        y: target.y,
        radius: 10,
        age: 0
    });
    
    // Check if target died
    if (target.health <= 0) {
        handleTargetDeath(target);
    }
}

// Load settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
        gameState.settings = JSON.parse(savedSettings);
    }
}

// Initialize settings
window.addEventListener('load', loadSettings);

// Helper function to convert world coordinates to screen coordinates
function worldToScreen(x, y) {
    return {
        x: x - gameState.camera.x + canvas.width / 2,
        y: y - gameState.camera.y + canvas.height / 2
    };
}

// Helper function to convert screen coordinates to world coordinates
function screenToWorld(x, y) {
    return {
        x: x + gameState.camera.x - canvas.width / 2,
        y: y + gameState.camera.y - canvas.height / 2
    };
}

// Helper function to get current chunk
function getCurrentChunk() {
    const chunkX = Math.floor(gameState.player.x / CHUNK_SIZE) * CHUNK_SIZE;
    const chunkY = Math.floor(gameState.player.y / CHUNK_SIZE) * CHUNK_SIZE;
    return gameState.chunks.get(getChunkKey(chunkX, chunkY));
}

// Helper function to get chunk key
function getChunkKey(x, y) {
    return `${x},${y}`;
}

// Helper function to update chunks
function updateChunks() {
    const playerChunkX = Math.floor(gameState.player.x / CHUNK_SIZE);
    const playerChunkY = Math.floor(gameState.player.y / CHUNK_SIZE);

    // Generate chunks in render distance
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
        for (let dy = -RENDER_DISTANCE; dy <= RENDER_DISTANCE; dy++) {
            const chunkX = (playerChunkX + dx) * CHUNK_SIZE;
            const chunkY = (playerChunkY + dy) * CHUNK_SIZE;
            const chunkKey = getChunkKey(chunkX, chunkY);

            if (!gameState.chunks.has(chunkKey)) {
                generateChunk(chunkX, chunkY);
            }
        }
    }

    // Remove chunks outside render distance
    for (const [key, chunk] of gameState.chunks) {
        const chunkX = Math.floor(chunk.x / CHUNK_SIZE);
        const chunkY = Math.floor(chunk.y / CHUNK_SIZE);
        
        if (Math.abs(chunkX - playerChunkX) > RENDER_DISTANCE || 
            Math.abs(chunkY - playerChunkY) > RENDER_DISTANCE) {
            gameState.chunks.delete(key);
        }
    }
}

// Helper function to generate chunk
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
            x: x + Math.random() * CHUNK_SIZE,
            y: y + Math.random() * CHUNK_SIZE,
            type: 'merchant',
            inventory: generateNPCInventory(),
            pulseOffset: Math.random() * Math.PI * 2
        });
    }
    
    // Add enemies
    const enemyCount = Math.floor(Math.random() * 3);
    for (let i = 0; i < enemyCount; i++) {
        chunk.enemies.push({
            x: x + Math.random() * CHUNK_SIZE,
            y: y + Math.random() * CHUNK_SIZE,
            health: 50,
            maxHealth: 50,
            damage: 10,
            type: 'enemy'
        });
    }
    
    // Add items
    const itemCount = Math.floor(Math.random() * 2);
    for (let i = 0; i < itemCount; i++) {
        chunk.items.push(generateRandomItem(x + Math.random() * CHUNK_SIZE, y + Math.random() * CHUNK_SIZE));
    }
    
    gameState.chunks.set(getChunkKey(x, y), chunk);
}

// Helper function to generate merchant inventory
function generateNPCInventory() {
    const inventory = [];
    const itemCount = Math.floor(Math.random() * 5) + 3;
    
    for (let i = 0; i < itemCount; i++) {
        inventory.push(generateRandomItem());
    }
    
    return inventory;
}

// Helper function to generate random item
function generateRandomItem(x = 0, y = 0) {
    const types = ['health_potion', 'mana_potion', 'sword', 'shield'];
    return {
        type: types[Math.floor(Math.random() * types.length)],
        x: x,
        y: y
    };
}

// Helper function to get item color
function getItemColor(type) {
    switch (type) {
        case 'health_potion':
            return '#ff0000';
        case 'mana_potion':
            return '#0000ff';
        case 'sword':
            return '#808080';
        case 'shield':
            return '#a0522d';
        default:
            return '#ffffff';
    }
}

// Helper function to update stats
function updateStats() {
    const healthBar = document.querySelector('#health-bar > div');
    const manaBar = document.querySelector('#mana-bar > div');
    
    if (healthBar && manaBar) {
        healthBar.style.width = `${(gameState.player.health / gameState.player.maxHealth) * 100}%`;
        manaBar.style.width = `${(gameState.player.mana / gameState.player.maxMana) * 100}%`;
    }
}

// Helper function to update inventory UI
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

// Helper function to use item
function useItem(index) {
    if (index >= 0 && index < gameState.player.inventory.length) {
        const item = gameState.player.inventory[index];
        
        switch(item.type) {
            case 'health_potion':
                // Heal player
                const healAmount = 30;
                gameState.player.health = Math.min(gameState.player.maxHealth, gameState.player.health + healAmount);
                createFloatingText(gameState.player.x, gameState.player.y, `+${healAmount} HP`);
                gameState.player.inventory.splice(index, 1);
                break;
            
            case 'mana_potion':
                // Restore mana
                const manaAmount = 30;
                gameState.player.mana = Math.min(gameState.player.maxMana, gameState.player.mana + manaAmount);
                createFloatingText(gameState.player.x, gameState.player.y, `+${manaAmount} MP`);
                gameState.player.inventory.splice(index, 1);
                break;
            
            case 'sword':
                // Increase damage
                gameState.player.damage += 5;
                createFloatingText(gameState.player.x, gameState.player.y, '+5 DMG');
                gameState.player.inventory.splice(index, 1);
                break;
            
            case 'shield':
                // Increase max health
                gameState.player.maxHealth += 20;
                gameState.player.health += 20;
                createFloatingText(gameState.player.x, gameState.player.y, '+20 MAX HP');
                gameState.player.inventory.splice(index, 1);
                break;
        }
        
        updateStats();
        updateInventoryUI();
    }
}

// Helper function to add item to inventory
function addItemToInventory(item) {
    if (gameState.player.inventory.length < gameState.player.maxInventory) {
        gameState.player.inventory.push(item);
        updateInventoryUI();
        return true;
    }
    return false;
}

// Helper function to handle NPC interaction
function handleNPCInteraction(npc) {
    if (npc.type === 'merchant') {
        gameState.activeTrade = {
            npc: npc,
            selectedItem: null
        };
        
        document.getElementById('trade-menu').style.display = 'flex';
        updateTradeUI();
    }
}

// Helper function to update trade UI
function updateTradeUI() {
    const tradeInventory = document.getElementById('trade-inventory');
    if (!tradeInventory || !gameState.activeTrade) return;
    
    tradeInventory.innerHTML = '';
    
    gameState.activeTrade.npc.inventory.forEach((item, index) => {
        const slot = document.createElement('div');
        slot.className = 'trade-slot';
        slot.style.backgroundColor = getItemColor(item.type);
        slot.title = item.type;
        
        slot.onclick = () => {
            selectTradeItem(index);
        };
        
        tradeInventory.appendChild(slot);
    });
}

// Helper function to select trade item
function selectTradeItem(index) {
    if (!gameState.activeTrade) return;
    
    const item = gameState.activeTrade.npc.inventory[index];
    gameState.activeTrade.selectedItem = item;
    
    const slots = document.querySelectorAll('.trade-slot');
    slots.forEach((slot, i) => {
        if (i === index) {
            slot.classList.add('selected');
        } else {
            slot.classList.remove('selected');
        }
    });
}

// Helper function to confirm trade
function confirmTrade() {
    if (!gameState.activeTrade || !gameState.activeTrade.selectedItem) return;
    
    const item = gameState.activeTrade.selectedItem;
    if (addItemToInventory(item)) {
        const index = gameState.activeTrade.npc.inventory.indexOf(item);
        if (index > -1) {
            gameState.activeTrade.npc.inventory.splice(index, 1);
        }
    }
    
    closeTrade();
}

// Helper function to close trade
function closeTrade() {
    gameState.activeTrade = null;
    document.getElementById('trade-menu').style.display = 'none';
}

// Helper function to handle player death
function playerDied() {
    gameState.isPaused = true;
    document.getElementById('death-screen').style.display = 'flex';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('settings-menu').style.display = 'none';
    dropInventoryOnDeath();
}

// Helper function to drop inventory on death
function dropInventoryOnDeath() {
    const currentChunk = getCurrentChunk();
    if (!currentChunk) return;
    
    while (gameState.player.inventory.length > 0) {
        const item = gameState.player.inventory.pop();
        if (item) {
            item.x = gameState.player.x + (Math.random() * 40 - 20);
            item.y = gameState.player.y + (Math.random() * 40 - 20);
            currentChunk.items.push(item);
        }
    }
    
    updateInventoryUI();
}

// Helper function to respawn player
function respawnPlayer() {
    gameState.player.health = gameState.player.maxHealth;
    gameState.player.mana = gameState.player.maxMana;
    gameState.player.x = 0;
    gameState.player.y = 0;
    gameState.camera.x = gameState.player.x;
    gameState.camera.y = gameState.player.y;
    gameState.isPaused = false; // Ensure game is unpaused when player respawns
    document.getElementById('death-screen').style.display = 'none';
    
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) {
        deathScreen.style.display = 'none';
    }
    
    // Clear any nearby enemies
    const safeRadius = CHUNK_SIZE / 2;
    for (const chunk of gameState.chunks.values()) {
        chunk.enemies = chunk.enemies.filter(enemy => {
            const dx = enemy.x - gameState.player.x;
            const dy = enemy.y - gameState.player.y;
            return Math.hypot(dx, dy) > safeRadius;
        });
    }
    
    updateStats();
}

// Helper function to update debug overlay
function updateDebugInfo() {
    const debugOverlay = document.getElementById('debug-overlay');
    if (!debugOverlay) return;
    
    // Create debug information
    const info = {
        'Canvas Size': `${canvas.width}x${canvas.height}`,
        'Player Pos': `(${Math.round(gameState.player.x)}, ${Math.round(gameState.player.y)})`,
        'Camera Pos': `(${Math.round(gameState.camera.x)}, ${Math.round(gameState.camera.y)})`,
        'Chunks': gameState.chunks.size,
        'Pause State': gameState.isPaused ? 'PAUSED' : 'Running',
        'Render Count': window._debugRenderCount || 0
    };
    
    // Format debug info as HTML
    let html = '<strong>DEBUG INFO:</strong><br>';
    for (const [key, value] of Object.entries(info)) {
        html += `${key}: ${value}<br>`;
    }
    
    debugOverlay.innerHTML = html;
}

// Helper function to handle menu buttons
document.addEventListener('DOMContentLoaded', function() {
    // Resume button
    document.getElementById('resume-button').addEventListener('click', function() {
        gameState.isPaused = false;
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('settings-menu').style.display = 'none';
    });

    // Settings button
    document.getElementById('settings-button').addEventListener('click', function() {
        console.log('Settings clicked');
    });

    // Back to pause button
    document.getElementById('back-to-pause').addEventListener('click', function() {
        console.log('Back button clicked');
    });

    // Save settings button
    document.getElementById('save-settings').addEventListener('click', function() {
        const controlMode = document.getElementById('control-mode').value;
        gameState.settings.controlMode = controlMode;
        localStorage.setItem('gameSettings', JSON.stringify(gameState.settings));
        
        document.getElementById('settings-menu').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'flex';
    });

    // Respawn button
    document.getElementById('respawn-button').addEventListener('click', function() {
        respawnPlayer();
    });
};

// Helper function to handle menu buttons
document.addEventListener('DOMContentLoaded', function() {
    // Resume button
    document.getElementById('resume-button').addEventListener('click', function() {
        gameState.isPaused = false;
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('settings-menu').style.display = 'none';
    });

    // Settings button
    document.getElementById('settings-button').addEventListener('click', function() {
        console.log('Settings clicked');
    });

    // Back to pause button
    document.getElementById('back-to-pause').addEventListener('click', function() {
        console.log('Back button clicked');
    });

    // Save settings button
    document.getElementById('save-settings').addEventListener('click', function() {
        const controlMode = document.getElementById('control-mode').value;
        gameState.settings.controlMode = controlMode;
        localStorage.setItem('gameSettings', JSON.stringify(gameState.settings));
        
        document.getElementById('settings-menu').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'flex';
    });

    // Respawn button
    document.getElementById('respawn-button').addEventListener('click', function() {
        respawnPlayer();
    });
};

// Basic setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Constants
const CHUNK_SIZE = 512;
const RENDER_DISTANCE = 2;

// Initialize game state
let gameState = {
    player: {
        x: 0,
        y: 0,
        health: 100,
        maxHealth: 100,
        mana: 100,
        maxMana: 100,
        inventory: [],
        maxInventory: 10
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
    settings: {
        controlMode: 'laptop'
    }
};

// Key state
const keys = {};

// Game arrays
const floatingTexts = [];
const attackEffects = [];

function playerAttack() {
    if (gameState.player.attackCooldown > 0) return;
    
    // Set attack cooldown
    gameState.player.attackCooldown = 0.5; // Half second cooldown
    
    // Add attack effect
    attackEffects.push({
        x: gameState.player.x,
        y: gameState.player.y,
        radius: 20,
        age: 0
    });
    
    // Find closest attackable entity
    let closest = null;
    let closestDist = 100; // Attack range
    
    // Check enemies in current and nearby chunks
    const currentChunkX = Math.floor(gameState.player.x / CHUNK_SIZE);
    const currentChunkY = Math.floor(gameState.player.y / CHUNK_SIZE);
    
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const chunkKey = getChunkKey((currentChunkX + dx) * CHUNK_SIZE, (currentChunkY + dy) * CHUNK_SIZE);
            const chunk = gameState.chunks.get(chunkKey);
            if (!chunk || !chunk.enemies) continue;
            
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
    
    // Attack the closest entity
    if (closest) {
        // Deal damage
        closest.health -= gameState.player.damage;
        
        // Show damage text
        createFloatingText(closest.x, closest.y, `-${gameState.player.damage}`, '#ff0000');
        
        // Check if enemy died
        if (closest.health <= 0 && closest.type !== 'player') {
            // Remove enemy from chunk
            const chunkKey = getChunkKey(closest.x, closest.y);
            const chunk = gameState.chunks.get(chunkKey);
            if (chunk && chunk.enemies) {
                chunk.enemies = chunk.enemies.filter(e => e !== closest);
            }
            
            // Chance to drop item
            if (Math.random() < 0.5) {
                const types = ['herb', 'mana', 'damage', 'health'];
                const item = {
                    x: closest.x,
                    y: closest.y,
                    type: types[Math.floor(Math.random() * types.length)]
                };
                
                if (chunk) {
                    if (!chunk.items) chunk.items = [];
                    chunk.items.push(item);
                }
            }
        }
    }
}

// Create floating text helper
function createFloatingText(x, y, text, color = '#00ff00') {
    floatingTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        age: 0
    });
}

function updateDebugInfo() {
    const debugOverlay = document.getElementById('debug-overlay');
    if (!debugOverlay) return;
    
    // Create debug information
    const info = {
        'Canvas Size': `${canvas.width}x${canvas.height}`,
        'Player Pos': `${Math.round(gameState.player.x)}, ${Math.round(gameState.player.y)}`,
        'Camera Pos': `${Math.round(gameState.camera.x)}, ${Math.round(gameState.camera.y)}`,
        'Pause State': gameState.isPaused ? 'PAUSED' : 'Running',
        'Render Count': window._debugRenderCount || 0
    };
    
    // Format debug info as HTML
    let html = '<strong>DEBUG INFO:</strong><br>';
    for (const [key, value] of Object.entries(info)) {
        html += `${key}: ${value}<br>`;
    }
    
    debugOverlay.innerHTML = html;
}

function gameLoop() {
    // Track render count for debugging
    window._debugRenderCount = (window._debugRenderCount || 0) + 1;
    
    if (!gameState.isPaused) {
        update();
    }
    render();
    updateDebugInfo(); // Add debug info update
    requestAnimationFrame(gameLoop);
}

function render() {
    try {
        // Clear canvas with a dark background
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid (simple version to ensure something renders)
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 1;
        const gridSize = 32;
        const offsetX = (-gameState.camera.x % gridSize + gridSize) % gridSize;
        const offsetY = (-gameState.camera.y % gridSize + gridSize) % gridSize;
        
        for (let x = offsetX; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let y = offsetY; y < canvas.height; y += gridSize) {
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
        
        // Draw UI
        drawUI();
    } catch (error) {
        console.error('Render error:', error);
        // Still try to show something if we have an error
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ff0000';
        ctx.font = '20px Arial';
        ctx.fillText('Render Error!', canvas.width/2 - 60, canvas.height/2);
    }
}

// Initialize game state
function initGame() {
    // Hide all menus at game start
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('settings-menu').style.display = 'none';
    document.getElementById('death-screen').style.display = 'none';
    document.getElementById('trade-menu').style.display = 'none';
    
    // Initialize canvas
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Start game loop
    gameLoop();
}
// debug.js
function logDebug(message) {
    console.log(`[DEBUG] ${message}`);
    const debugOverlay = document.getElementById('debug-overlay');
    if (debugOverlay) {
        debugOverlay.innerHTML += `<br>${message}`;
        if (debugOverlay.childNodes.length > 20) {
            debugOverlay.removeChild(debugOverlay.firstChild);
        }
    }
}
// Initialize canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');// Initialize canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 800;
canvas.height = 600;// Declare canvas variables
let canvas;
let ctx;document.addEventListener('DOMContentLoaded', () => {
    logDebug('Initializing game...');
    
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
    canvas.width = 800;
    canvas.height = 600;
    
    logDebug('Canvas initialized successfully');
    logDebug(`Canvas size: ${canvas.width}x${canvas.height}`);
    
    // Start game loop
    gameLoop();
});

// Set canvas size
canvas.width = 800;
canvas.height = 600;

// Initialize game state
const gameState = {
    player: {
        x: 0,
        y: 0,
        health: 100,
        maxHealth: 100,
        mana: 100,
        maxMana: 100,
        inventory: [],
        maxInventory: 10
    },
    camera: {
        x: 0,
        y: 0
    },
    isPaused: false
};

// Start the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    logDebug('Game starting...');
    gameLoop();
});function render() {
    try {
        logDebug('Rendering frame...');
        
        // Clear canvas
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 1;
        const gridSize = 32;
        
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Draw player
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2, 10, 0, Math.PI * 2);
        ctx.fill();
        
        logDebug('Frame rendered successfully');
    } catch (error) {
        console.error('Render error:', error);
        logDebug(`Render error: ${error.message}`);
    }
}function gameLoop() {
    render();
    requestAnimationFrame(gameLoop);
}