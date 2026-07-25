// ============================================
// COMUNICACIÓN MQTT
// ============================================

import { state, COLORES } from './config-state.js';
import { showLoading, hideLoading, mostrarMensaje, getPlayerName } from './utils.js';
import { generarMazos, renderBoard, updateVisuals, renderCartasVisibles, renderCartasJugador } from './mazos-tablero.js';
import { calculateScores, actualizarBotonEspecial, finalizarJuego } from './juego.js';
import { renderLeaderboard } from './leaderboard.js';
import { renderStatusPanel } from './panel.js';

// ============================================
// FUNCIONES DE RENDER - IMPORTADAS DINÁMICAMENTE
// ============================================

let renderStatusPanelFn = null;

export function setRenderStatusPanel(fn) {
    renderStatusPanelFn = fn;
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
            cartasEspecialesUsadas: state.cartasEspecialesUsadas || 0,
            puntosEspeciales: []
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
                renderStatusPanel();
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
                if (data.coloresMeta) {
                    state.coloresMeta = data.coloresMeta;
                }
                updateVisuals();
                calculateScores();
                renderCartasJugador();
                renderBoard();
                renderLeaderboard();
                renderStatusPanel();
                return;
            }

            // JUEGO TERMINADO
            if (data.action === 'juego_terminado') {
                state.juegoTerminado = true;
                state.coloresMeta = data.coloresMeta || [];
                state.resultadosFinales = data.resultadosFinales || {};
                
                // Actualizar playersData con los scores recibidos
                if (data.playersData) {
                    Object.keys(data.playersData).forEach(id => {
                        if (state.playersData[id]) {
                            state.playersData[id].score = data.playersData[id].score || 0;
                        }
                    });
                }
                
                // Mostrar podio remoto con TOP 3
                mostrarPodioRemoto();
                renderLeaderboard();
                renderStatusPanel();
                actualizarBotonEspecial();
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
                cartasEspecialesUsadas: data.cartasEspecialesUsadas || 0,
                puntosEspeciales: data.puntosEspeciales || []
            };
            renderLeaderboard();
            renderStatusPanel();

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
// MOSTRAR PODIO REMOTO (TOP 3)
// ============================================

function mostrarPodioRemoto() {
    const modal = document.getElementById('podioModal');
    const content = document.getElementById('podioContent');
    if (!modal || !content) return;
    
    // Obtener todos los jugadores y ordenar por score (mayor a menor)
    const jugadores = Object.keys(state.playersData).map(id => ({
        id: id,
        nombre: state.playersData[id].name || 'Jugador',
        score: state.playersData[id].score || 0,
        esLocal: id === state.myId
    }));
    
    jugadores.sort((a, b) => b.score - a.score);
    
    // Tomar TOP 3
    const top3 = jugadores.slice(0, 3);
    
    const medallas = ['🥇', '🥈', '🥉'];
    
    let html = `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 3rem;">🏆</div>
            <h2 style="color: #ffd700; margin-bottom: 4px;">JUEGO TERMINADO</h2>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
    `;
    
    top3.forEach((jugador, index) => {
        const esLocal = jugador.esLocal ? ' (Tú)' : '';
        html += `
            <div style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                <span style="font-size: 1.8rem; min-width: 45px; text-align: center;">${medallas[index] || `${index+1}.`}</span>
                <span style="flex: 1; font-weight: bold; color: #fff; font-size: 1.1rem;">${jugador.nombre}${esLocal}</span>
                <span style="font-weight: bold; color: #ffd700; font-size: 1.2rem; min-width: 60px; text-align: right;">${jugador.score} pts</span>
            </div>
        `;
    });
    
    // Si hay más de 3 jugadores, mostrar posición del jugador local si no está en TOP 3
    const localEnTop3 = top3.some(j => j.esLocal);
    if (!localEnTop3 && jugadores.length > 3) {
        const posLocal = jugadores.findIndex(j => j.esLocal) + 1;
        const local = jugadores.find(j => j.esLocal);
        if (local) {
            html += `
                <div style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); padding: 8px 16px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.1); margin-top: 4px;">
                    <span style="font-size: 1rem; min-width: 45px; text-align: center; color: #888;">#${posLocal}</span>
                    <span style="flex: 1; color: #888; font-size: 0.9rem;">${local.nombre} (Tú)</span>
                    <span style="color: #666; font-size: 1rem; min-width: 60px; text-align: right;">${local.score} pts</span>
                </div>
            `;
        }
    }
    
    html += `
        </div>
        <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
            <button onclick="window.cerrarPodio()" 
                    style="background: #555; color: white; border: none; padding: 10px 35px; border-radius: 6px; font-size: 1rem; font-weight: bold; cursor: pointer;">
                Cerrar
            </button>
        </div>
    `;
    
    content.innerHTML = html;
    modal.style.display = 'flex';
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
            cartasEspecialesUsadas: state.cartasEspecialesUsadas || 0,
            puntosEspeciales: state.playersData[state.myId]?.puntosEspeciales || [],
            coloresMeta: state.coloresMeta || []
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
            fichas: state.fichas,
            coloresMeta: state.coloresMeta || []
        });
        state.mqttClient.publish(topic, payload);
    }
}

// ============================================
// BROADCAST JUEGO TERMINADO
// ============================================

export function broadcastJuegoTerminado() {
    if (state.mqttClient && state.currentRoom) {
        const topic = `paradice_xyz/room/${state.currentRoom}`;
        
        // Crear copia de playersData solo con los scores
        const playersScores = {};
        Object.keys(state.playersData).forEach(id => {
            playersScores[id] = {
                score: state.playersData[id].score || 0,
                name: state.playersData[id].name || 'Jugador'
            };
        });
        
        const payload = JSON.stringify({
            action: 'juego_terminado',
            id: state.myId,
            juegoTerminado: true,
            coloresMeta: state.coloresMeta,
            resultadosFinales: state.resultadosFinales || {},
            playersData: playersScores
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
    state.juegoTerminado = false;
    state.coloresMeta = [];
    state.resultadosFinales = {};
    
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
        cartasEspecialesUsadas: 0,
        puntosEspeciales: []
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