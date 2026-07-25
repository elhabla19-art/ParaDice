// ============================================
// COMUNICACIÓN MQTT
// ============================================

import { state } from './config-state.js';
import { showLoading, hideLoading, mostrarMensaje, getPlayerName } from './utils.js';
import { generarMazos, renderBoard, updateVisuals, renderCartasVisibles, renderCartasJugador } from './mazos-tablero.js';
import { calculateScores, actualizarBotonEspecial } from './juego.js';
import { renderLeaderboard } from './leaderboard.js';

// ============================================
// FUNCIONES DE RENDER - IMPORTADAS DINÁMICAMENTE
// ============================================

let renderStatusPanelFn = null;

export function setRenderStatusPanel(fn) {
    renderStatusPanelFn = fn;
}

function renderStatusPanel() {
    if (renderStatusPanelFn) {
        renderStatusPanelFn();
    }
}

// ============================================
// CONECTAR A SALA
// ============================================

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
        renderStatusPanel();
        actualizarBotonEspecial();
        
        state.playersData[state.myId] = {
            name: state.myName,
            score: state.myTotalScore,
            cartasJugador: state.cartasJugador,
            cartasTerminadas: state.cartasTerminadas,
            habilidadesUsadas: state.habilidadesUsadas,
            mazoColores: state.mazoColores,
            mazoEspecialDisponible: state.mazoEspecialDisponible,
            cartasVisibles: state.cartasVisibles,
            cartasRepartidas: state.cartasRepartidas,
            tablero: state.tableroGlobal,
            fichas: state.fichas,
            progresoCartas: state.progresoCarta,
            cartasEspecialesUsadas: state.cartasEspecialesUsadas || 0
        };
        
        joinSuccess(code);
        broadcastScore('join');
    });

    state.mqttClient.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.id === state.myId) return;

            // TICKETS
            if (data.action === 'tickets') {
                state.tickets = data.tickets || {};
                state.bonusTicket = data.bonusTicket || null;
                state.bonusReclamado = data.bonusReclamado || false;
                renderLeaderboard();
                return;
            }

            // MAZO
            if (data.action === 'mazo') {
                state.mazoColores = data.mazoColores || state.mazoColores;
                state.cartasVisibles = data.cartasVisibles || state.cartasVisibles;
                renderCartasVisibles();
                updateVisuals();
                return;
            }

            // TABLERO
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
                renderStatusPanel();
                return;
            }

            // JUGADOR
            state.playersData[data.id] = {
                name: data.name,
                score: data.score || 0,
                cartasJugador: data.cartasJugador || [],
                cartasTerminadas: data.cartasTerminadas || [],
                habilidadesUsadas: data.habilidadesUsadas || {},
                mazoColores: data.mazoColores || [],
                mazoEspecialDisponible: data.mazoEspecialDisponible || [],
                cartasVisibles: data.cartasVisibles || [],
                cartasRepartidas: data.cartasRepartidas || false,
                tablero: data.tablero || state.tableroGlobal,
                fichas: data.fichas || state.fichas,
                progresoCartas: data.progresoCartas || {},
                cartasEspecialesUsadas: data.cartasEspecialesUsadas || 0
            };
            renderLeaderboard();

            if (data.action === 'join') {
                setTimeout(() => {
                    broadcastTablero();
                    broadcastMazo();
                    broadcastTickets();
                }, 500);
                broadcastScore('sync');
            }
            
            if (data.action === 'repartir') {
                state.cartasVisibles = data.cartasVisibles || state.cartasVisibles;
                state.mazoColores = data.mazoColores || state.mazoColores;
                state.cartasRepartidas = data.cartasRepartidas || false;
                renderCartasVisibles();
                renderCartasJugador();
                updateVisuals();
                renderBoard();
                renderStatusPanel();
                actualizarBotonEspecial();
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

// ============================================
// BROADCAST TICKETS
// ============================================

export function broadcastTickets() {
    if (state.mqttClient && state.currentRoom) {
        const topic = `paradice_xyz/room/${state.currentRoom}`;
        const payload = JSON.stringify({
            action: 'tickets',
            id: state.myId,
            tickets: state.tickets,
            bonusTicket: state.bonusTicket,
            bonusReclamado: state.bonusReclamado
        });
        state.mqttClient.publish(topic, payload);
    }
}

// ============================================
// BROADCAST MAZO
// ============================================

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

// ============================================
// BROADCAST SCORE
// ============================================

export function broadcastScore(action = 'sync') {
    if (state.mqttClient && state.currentRoom) {
        const topic = `paradice_xyz/room/${state.currentRoom}`;
        const payload = JSON.stringify({
            action: action,
            id: state.myId,
            name: state.myName,
            score: state.myTotalScore,
            cartasJugador: state.cartasJugador,
            cartasTerminadas: state.cartasTerminadas,
            habilidadesUsadas: state.habilidadesUsadas,
            mazoColores: state.mazoColores,
            mazoEspecialDisponible: state.mazoEspecialDisponible,
            cartasVisibles: state.cartasVisibles,
            cartasRepartidas: state.cartasRepartidas,
            tablero: state.tableroGlobal,
            fichas: state.fichas,
            progresoCartas: state.progresoCarta,
            cartasEspecialesUsadas: state.cartasEspecialesUsadas || 0
        });
        state.mqttClient.publish(topic, payload);
    }
}

// ============================================
// BROADCAST TABLERO
// ============================================

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

// ============================================
// JOIN SUCCESS
// ============================================

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
    renderStatusPanel();
    actualizarBotonEspecial();
}

// ============================================
// FUNCIONES DE LOBBY
// ============================================

export function playSolo() {
    state.myName = getPlayerName();
    document.getElementById('lobbyModal').style.display = 'none';
    state.progresoCarta = {};
    state.myTotalScore = 0;
    state.cartasJugador = Array(5).fill(null);
    state.cartasTerminadas = [];
    state.habilidadesUsadas = {};
    state.cartasEspecialesUsadas = 0;
    state.playersData[state.myId] = {
        name: state.myName,
        score: 0,
        cartasJugador: state.cartasJugador,
        cartasTerminadas: state.cartasTerminadas,
        habilidadesUsadas: state.habilidadesUsadas,
        mazoColores: [],
        mazoEspecialDisponible: [],
        cartasVisibles: [],
        cartasRepartidas: false,
        tablero: state.tableroGlobal,
        fichas: state.fichas,
        progresoCartas: {},
        cartasEspecialesUsadas: 0
    };
    generarMazos();
    renderBoard();
    updateVisuals();
    calculateScores();
    renderStatusPanel();
    actualizarBotonEspecial();
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
        mostrarMensaje('El codigo debe tener 4 letras/numeros.', 'error');
        return;
    }
    connectToRoom(code);
}