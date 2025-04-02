// P2P WebRTC connection for multiplayer
class P2PServer {
    constructor() {
        this.peerId = Math.floor(Math.random() * 1000000).toString();
        this.peers = {};
        this.lastUpdate = Date.now();
        this.initializeLocalStorage();
        this.startPeerDiscovery();
    }

    initializeLocalStorage() {
        // Initialize or clear old peer data
        const now = Date.now();
        const peers = JSON.parse(localStorage.getItem('peers') || '{}');
        
        // Remove stale peers (older than 5 seconds)
        for (const [id, data] of Object.entries(peers)) {
            if (now - data.timestamp > 5000) {
                delete peers[id];
            }
        }
        
        localStorage.setItem('peers', JSON.stringify(peers));
    }

    startPeerDiscovery() {
        // Register this peer
        this.updatePeerData({
            x: gameState.player.x,
            y: gameState.player.y,
            health: gameState.player.health,
            maxHealth: gameState.player.maxHealth
        });

        // Start checking for other peers
        setInterval(() => {
            this.checkForPeers();
        }, 100); // Increased frequency for smoother updates
    }

    updatePeerData(data) {
        const now = Date.now();
        const peers = JSON.parse(localStorage.getItem('peers') || '{}');
        
        peers[this.peerId] = {
            ...data,
            timestamp: now
        };
        
        localStorage.setItem('peers', JSON.stringify(peers));
        this.lastUpdate = now;
    }

    checkForPeers() {
        const now = Date.now();
        const peers = JSON.parse(localStorage.getItem('peers') || '{}');
        const activePeers = {};
        
        // Update game state with peer data
        for (const [id, data] of Object.entries(peers)) {
            if (id !== this.peerId && now - data.timestamp < 5000) {
                activePeers[id] = data;
                
                // Update or create other player in game state
                if (!gameState.otherPlayers.has(id)) {
                    gameState.otherPlayers.set(id, {
                        x: data.x,
                        y: data.y,
                        health: data.health,
                        maxHealth: data.maxHealth
                    });
                } else {
                    const player = gameState.otherPlayers.get(id);
                    player.x = data.x;
                    player.y = data.y;
                    player.health = data.health;
                }
            }
        }
        
        // Remove disconnected peers
        for (const [id, peer] of gameState.otherPlayers) {
            if (!activePeers[id]) {
                gameState.otherPlayers.delete(id);
            }
        }
        
        this.peers = activePeers;
    }

    broadcast(type, data) {
        const message = {
            type,
            data,
            timestamp: Date.now(),
            senderId: this.peerId
        };
        
        const peers = JSON.parse(localStorage.getItem('peers') || '{}');
        peers[this.peerId].messages = peers[this.peerId].messages || [];
        peers[this.peerId].messages.push(message);
        
        // Keep only last 10 messages
        if (peers[this.peerId].messages.length > 10) {
            peers[this.peerId].messages.shift();
        }
        
        localStorage.setItem('peers', JSON.stringify(peers));
    }

    handleMessage(message) {
        if (message.senderId === this.peerId) return;
        
        switch (message.type) {
            case 'attack':
                handleP2PMessage(message);
                break;
        }
    }

    updatePosition(x, y) {
        this.broadcast('position', {
            x,
            y,
            health: gameState.player.health
        });
    }
}
