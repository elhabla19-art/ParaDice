// ============================================
// COMUNICACIÓN MQTT
// ============================================

import { state } from './config-state.js';
import { showLoading, hideLoading, mostrarMensaje, getPlayerName } from './utils.js';
import { generarMazos, renderBoard, updateVisuals, renderCartasVisibles, renderCartasJugador } from './mazos-tablero.js';
import { calculateScores } from './juego.js';
import { renderLeaderboard } from './leaderboard.js';

// CONECTAR A SALA
export function connectToRoom(code) {
    showLoading('Conectando con la sala...');
    
    state.mqttClient = mqtt.connect('wss://broker.hivemq.com:8884/mqtt');

    state.mqttClient.on('connect', () => {
        state.currentRoom = code;
        const topic = `paradice_xyz/room/${code}`;
        state.mqttClient.subscribe(topic);
        
        generarMazos();
        renderBoard();
        updateVisuals();
        calculateScores();
        
        state.playersData[state.myId] = {
            name: state.myName,
            score: state.myTotalScore,
            cartasJugador: state.cartasJugador,
            mazoColores: state.mazoColores,
            cartasVisibles: state.cartasVisibles,
            cartasRepartidas: state.cartasRepartidas,
            tablero: state.tableroGlobal,
            fichas: state.fichas,
            progresoCartas: state.progresoCarta
        };
        
        joinSuccess(code);
        broadcastScore('join');
    });

    state.mqttClient.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.id === state.myId) return;

            // ACTUALIZAR MAZO Y VISIBLES (cuando alguien toma una carta)
            if (data.action === 'mazo') {
                state.mazoColores = data.mazoColores || state.mazoColores;
                state.cartasVisibles = data.cartasVisibles || state.cartasVisibles;
                renderCartasVisibles();
                updateVisuals();
                return;
            }

            // ACTUALIZAR TABLERO
            if (data.action === 'tablero' && data.tablero) {
                state.tableroGlobal = data.tablero;
                if (data.fichas) {
                    state.fichas = data.fichas;
                }
                updateVisuals();
                calculateScores();
                renderCartasJugador();
                renderBoard();
                renderLeaderboard();
                return;
            }

            // ACTUALIZAR JUGADOR
            state.playersData[data.id] = {
                name: data.name,
                score: data.score || 0,
                cartasJugador: data.cartasJugador || [],
                mazoColores: data.mazoColores || [],
                cartasVisibles: data.cartasVisibles || [],
                cartasRepartidas: data.cartasRepartidas || false,
                tablero: data.tablero || state.tableroGlobal,
                fichas: data.fichas || state.fichas,
                progresoCartas: data.progresoCartas || {}
            };
            renderLeaderboard();

            // NUEVO JUGADOR - enviar estado completo
            if (data.action === 'join') {
                setTimeout(() => {
                    broadcastTablero();
                    broadcastMazo();
                }, 500);
                broadcastScore('sync');
            }
            
            // REPARTIR CARTAS
            if (data.action === 'repartir') {
                state.cartasVisibles = data.cartasVisibles || state.cartasVisibles;
                state.mazoColores = data.mazoColores || state.mazoColores;
                state.cartasRepartidas = data.cartasRepartidas || false;
                
                renderCartasVisibles();
                renderCartasJugador();
                updateVisuals();
                renderBoard();
            }
        } catch(e) {
            console.error('Mensaje invalido', e);
        }
    });

    state.mqttClient.on('error', (err) => {
        hideLoading();
        mostrarMensaje('Error de red. Revisa tu internet.', 'error');
    });
}

// BROADCAST MAZO (sincronizar mazo y visibles)
export function broadcastMazo() {
    if (state.mqttClient && state.currentRoom) {
        const topic = `paradice_xyz/room/${state.currentRoom}`;
        const payload = JSON.stringify({
            action: 'mazo',
            id: state.myId,
            mazoColores: state.mazoColores,
            cartasVisibles: state.cartasVisibles
        });
        state.mqttClient.publish(topic, payload);
    }
}

// BROADCAST SCORE
export function broadcastScore(action = 'sync') {
    if (state.mqttClient && state.currentRoom) {
        const topic = `paradice_xyz/room/${state.currentRoom}`;
        const payload = JSON.stringify({
            action: action,
            id: state.myId,
            name: state.myName,
            score: state.myTotalScore,
            cartasJugador: state.cartasJugador,
            mazoColores: state.mazoColores,
            cartasVisibles: state.cartasVisibles,
            cartasRepartidas: state.cartasRepartidas,
            tablero: state.tableroGlobal,
            fichas: state.fichas,
            progresoCartas: state.progresoCarta
        });
        state.mqttClient.publish(topic, payload);
    }
}

// BROADCAST TABLERO
export function broadcastTablero() {
    if (state.mqttClient && state.currentRoom) {
        const topic = `paradice_xyz/room/${state.currentRoom}`;
        const payload = JSON.stringify({
            action: 'tablero',
            id: state.myId,
            tablero: state.tableroGlobal,
            fichas: state.fichas
        });
        state.mqttClient.publish(topic, payload);
    }
}

// JOIN SUCCESS
function joinSuccess(code) {
    hideLoading();
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('joinModal').style.display = 'none';
    
    const info = document.getElementById('roomInfoDisplay');
    if (info) {
        info.style.display = 'inline-block';
        info.textContent = 'SALA: ' + code;
    }
    
    document.getElementById('leaderboardPanel').style.display = 'flex';
    renderLeaderboard();
}

// FUNCIONES DE LOBBY
export function playSolo() {
    state.myName = getPlayerName();
    document.getElementById('lobbyModal').style.display = 'none';
    state.progresoCarta = {};
    state.myTotalScore = 0;
    state.cartasJugador = Array(4).fill(null);
    state.playersData[state.myId] = {
        name: state.myName,
        score: 0,
        cartasJugador: state.cartasJugador,
        mazoColores: [],
        cartasVisibles: [],
        cartasRepartidas: false,
        tablero: state.tableroGlobal,
        fichas: state.fichas,
        progresoCartas: {}
    };
    generarMazos();
    renderBoard();
    updateVisuals();
    calculateScores();
    document.getElementById('leaderboardPanel').style.display = 'flex';
    renderLeaderboard();
}

export function showJoinModal() {
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('joinModal').style.display = 'flex';
}

export function backToLobby() {
    document.getElementById('joinModal').style.display = 'none';
    document.getElementById('lobbyModal').style.display = 'flex';
}

export function createRoom() {
    state.myName = getPlayerName();
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    connectToRoom(code);
}

export function joinRoom() {
    state.myName = getPlayerName();
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (code.length !== 4) {
        mostrarMensaje('El código debe tener 4 letras/números.', 'error');
        return;
    }
    connectToRoom(code);
}