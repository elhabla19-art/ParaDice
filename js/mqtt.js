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
                state.myTotalScore = data.myTotalScore || 0;
                
                // Actualizar el score del jugador local
                if (state.playersData[state.myId]) {
                    state.playersData[state.myId].score = state.myTotalScore;
                }
                
                mostrarPodioRemoto(data.resultadosFinales, data.myTotalScore);
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
// MOSTRAR PODIO REMOTO
// ============================================

function mostrarPodioRemoto(resultados, totalPuntaje) {
    const modal = document.getElementById('podioModal');
    const content = document.getElementById('podioContent');
    if (!modal || !content) return;
    
    const colorHex = {
        celeste: '#4fc3f7',
        lima: '#aed581',
        naranja: '#ffb74d',
        purpura: '#ce93d8',
        rosa: '#f06292'
    };
    
    const colorNombre = {
        celeste: 'Celeste',
        lima: 'Lima',
        naranja: 'Naranja',
        purpura: 'Púrpura',
        rosa: 'Rosa'
    };
    
    const coloresOrdenados = COLORES.slice().sort((a, b) => {
        return (resultados[b]?.puntaje || 0) - (resultados[a]?.puntaje || 0);
    });
    
    let html = `
        <div style="text-align: center; margin-bottom: 15px;">
            <div style="font-size: 2.5rem;">🏆</div>
            <h2 style="color: #ffd700; margin-bottom: 4px;">¡JUEGO TERMINADO!</h2>
            <p style="color: #aaa; font-size: 0.9rem;">Puntaje total: <strong style="color: #fff; font-size: 1.2rem;">${totalPuntaje} pts</strong></p>
            <p style="color: #888; font-size: 0.7rem;">Resultados de ${state.playersData[state.myId]?.name || 'Jugador'}</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 15px;">
    `;
    
    coloresOrdenados.forEach((color, index) => {
        const data = resultados[color];
        const hex = colorHex[color] || '#888';
        const nombre = colorNombre[color] || color;
        const puntaje = data?.puntaje || 0;
        const posicion = data?.posicion || 0;
        const cartas = data?.cartasCompletadas || 0;
        
        let badge = '';
        if (data?.esPrimero) badge = '🥇 1º en meta (0pts cartas)';
        else if (data?.esSegundo) badge = '🥈 2º en meta';
        else if (data?.esDoble) badge = '⭐ ¡DOBLE! (más atrás)';
        
        html += `
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 6px; border-left: 3px solid ${hex};">
                <span style="font-size: 1.1rem;">${index + 1}</span>
                <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${hex};"></span>
                <span style="flex: 1; font-weight: bold; color: #fff; font-size: 0.9rem;">${nombre}</span>
                <span style="color: #888; font-size: 0.7rem;">Ficha: ${posicion + 1}/6 | Cartas: ${cartas}</span>
                ${badge ? `<span style="font-size: 0.65rem; color: #ffd700; background: rgba(255,215,0,0.15); padding: 2px 8px; border-radius: 10px;">${badge}</span>` : ''}
                <span style="font-weight: bold; color: #fff; font-size: 1rem; min-width: 40px; text-align: right;">${puntaje} pts</span>
            </div>
        `;
    });
    
    html += `
        </div>
        <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
            <button onclick="window.cerrarPodio()" 
                    style="background: #555; color: white; border: none; padding: 8px 30px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; cursor: pointer;">
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

export function broadcastJuegoTerminado(resultados) {
    if (state.mqttClient && state.currentRoom) {
        const topic = `paradice_xyz/room/${state.currentRoom}`;
        const payload = JSON.stringify({
            action: 'juego_terminado',
            id: state.myId,
            juegoTerminado: true,
            coloresMeta: state.coloresMeta,
            resultadosFinales: resultados,
            myTotalScore: state.myTotalScore
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