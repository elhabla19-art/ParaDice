// ============================================
// COMUNICACIÓN MQTT (CON MODO AUTOMATICO)
// ============================================

import { state, COLORES } from './config-state.js';
import { showLoading, hideLoading, mostrarMensaje, getPlayerName } from './utils.js';
import { generarMazos, renderBoard, updateVisuals, renderCartasVisibles, renderCartasJugador } from './mazos-tablero.js';
import { calculateScores, actualizarBotonEspecial, finalizarJuego } from './juego.js';
import { renderLeaderboard } from './leaderboard.js';
import { renderStatusPanel } from './panel.js';

// ===== DETECTAR MODO AUTOMATICO =====
const urlParams = new URLSearchParams(window.location.search);
const isAutoMode = urlParams.get('auto') === '1';
const AUTO_ROOM_CODE = 'GRIL';

// ============================================
// FUNCIONES DE RENDER - IMPORTADAS DINÁMICAMENTE
// ============================================

let renderStatusPanelFn = null;

export function setRenderStatusPanel(fn) {
    renderStatusPanelFn = fn;
}

// ============================================
// FUNCIÓN PARA RESTAURAR ESTADO LOCAL DESDE PLAYERSDATA
// ============================================

export function forzarRestauracionLocal() {
    const myData = state.playersData[state.myId];
    if (!myData) {
        mostrarMensaje('⚠️ No hay datos del jugador', 'warning');
        return false;
    }
    
    // Verificar si hay datos válidos para restaurar
    const tieneCartas = myData.cartasJugador && myData.cartasJugador.some(c => c !== null);
    const tieneTerminadas = myData.cartasTerminadas && myData.cartasTerminadas.length > 0;
    const tieneProgreso = myData.progresoCartas && Object.keys(myData.progresoCartas).length > 0;
    
    if (!tieneCartas && !tieneTerminadas && !tieneProgreso) {
        mostrarMensaje('ℹ️ No hay datos que restaurar', 'info');
        return false;
    }
    
    // Restaurar cartas del jugador
    if (myData.cartasJugador) {
        state.cartasJugador = myData.cartasJugador.map(c => c ? { ...c } : null);
    }
    
    if (myData.cartasTerminadas) {
        state.cartasTerminadas = myData.cartasTerminadas.map(c => ({ ...c }));
    }
    
    if (myData.habilidadesUsadas) {
        state.habilidadesUsadas = { ...myData.habilidadesUsadas };
    }
    
    if (myData.progresoCartas) {
        state.progresoCarta = { ...myData.progresoCartas };
    }
    
    if (myData.score !== undefined) {
        state.myTotalScore = myData.score;
    }
    
    if (myData.cartasEspecialesUsadas !== undefined) {
        state.cartasEspecialesUsadas = myData.cartasEspecialesUsadas;
    }
    
    if (myData.coloresMeta) {
        state.coloresMeta = [...myData.coloresMeta];
    }
    
    if (myData.tablero) {
        state.tableroGlobal = { ...myData.tablero };
    }
    
    if (myData.fichas) {
        state.fichas = { ...myData.fichas };
    }
    
    if (myData.puntosEspeciales) {
        state.playersData[state.myId].puntosEspeciales = [...(myData.puntosEspeciales || [])];
    }
    
    // Actualizar UI
    renderCartasVisibles();
    renderCartasJugador();
    renderBoard();
    updateVisuals();
    calculateScores();
    renderStatusPanel();
    renderLeaderboard();
    actualizarBotonEspecial();
    
    return true;
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
        
        // Primero intentar restaurar desde playersData (si existe)
        const restaurado = forzarRestauracionLocal();
        
        if (!restaurado) {
            // Si no hay datos, generar estado fresco
            generarMazos();
            state.cartasJugador = Array(5).fill(null);
            state.cartasTerminadas = [];
            state.habilidadesUsadas = {};
            state.progresoCarta = {};
            state.cartasEspecialesUsadas = 0;
            state.myTotalScore = 0;
            state.coloresMeta = [];
            state.resultadosFinales = {};
            state.juegoTerminado = false;
            
            // Resetear puntosEspeciales
            if (state.playersData[state.myId]) {
                state.playersData[state.myId].puntosEspeciales = [];
            }
        }
        
        renderBoard();
        updateVisuals();
        calculateScores();
        renderStatusPanel();
        actualizarBotonEspecial();
        
        // Asegurar que playersData tenga los datos actuales
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
            puntosEspeciales: state.playersData[state.myId]?.puntosEspeciales || [],
            coloresMeta: state.coloresMeta || []
        };
        
        joinSuccess(code);
        
        // Si se restauraron datos, enviar broadcast para sincronizar
        if (restaurado) {
            setTimeout(() => {
                broadcastScore('sync');
                broadcastTablero();
                broadcastMazo();
                broadcastTickets();
                mostrarMensaje('🔄 Datos restaurados y sincronizados', 'success');
            }, 500);
        } else {
            broadcastScore('join');
        }
    });

    state.mqttClient.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            
            // ============================================
            // MENSAJE DE OTRO JUGADOR - ACTUALIZAR playersData
            // ============================================
            if (data.id !== state.myId) {
                // Actualizar datos del otro jugador
                state.playersData[data.id] = {
                    name: data.name || 'Jugador',
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
                    puntosEspeciales: data.puntosEspeciales || [],
                    coloresMeta: data.coloresMeta || []
                };
                
                // Si el otro jugador tiene coloresMeta, actualizar los nuestros
                if (data.coloresMeta && data.coloresMeta.length > 0) {
                    state.coloresMeta = data.coloresMeta;
                }
                
                renderLeaderboard();
                renderStatusPanel();
                
                // Si es un mensaje de tipo 'sync', también actualizar tablero
                if (data.action === 'sync' && data.tablero) {
                    state.tableroGlobal = data.tablero;
                    state.fichas = data.fichas || state.fichas;
                    if (data.coloresMeta) {
                        state.coloresMeta = data.coloresMeta;
                    }
                    renderBoard();
                    updateVisuals();
                }
            }
            
            // ============================================
            // PROCESAR ACCIONES ESPECÍFICAS
            // ============================================
            
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
                if (data.id === state.myId) return;
                
                state.mazoColores = data.mazoColores || state.mazoColores;
                state.cartasVisibles = data.cartasVisibles || state.cartasVisibles;
                renderCartasVisibles();
                updateVisuals();
                return;
            }

            // TABLERO
            if (data.action === 'tablero') {
                if (data.id === state.myId) return;
                
                state.tableroGlobal = data.tablero || state.tableroGlobal;
                if (data.fichas) {
                    state.fichas = data.fichas;
                }
                if (data.coloresMeta) {
                    state.coloresMeta = data.coloresMeta;
                }
                updateVisuals();
                calculateScores();
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
                
                if (data.playersData) {
                    Object.keys(data.playersData).forEach(id => {
                        if (state.playersData[id]) {
                            state.playersData[id].score = data.playersData[id].score || 0;
                        }
                    });
                }
                
                mostrarPodioRemoto();
                renderLeaderboard();
                renderStatusPanel();
                actualizarBotonEspecial();
                return;
            }

            // JOIN - Cuando un jugador se une, pedir su estado completo
            if (data.action === 'join' && data.id !== state.myId) {
                setTimeout(() => {
                    broadcastTablero();
                    broadcastMazo();
                    broadcastTickets();
                    broadcastScore('sync');
                }, 500);
                return;
            }
            
            // REPARTIR
            if (data.action === 'repartir' && data.id !== state.myId) {
                state.cartasVisibles = data.cartasVisibles || state.cartasVisibles;
                state.mazoColores = data.mazoColores || state.mazoColores;
                state.cartasRepartidas = data.cartasRepartidas || false;
                renderCartasVisibles();
                renderCartasJugador();
                updateVisuals();
                renderBoard();
                renderStatusPanel();
                actualizarBotonEspecial();
                return;
            }
            
            // SYNC - Sincronización completa de un jugador
            if (data.action === 'sync' && data.id !== state.myId) {
                renderCartasVisibles();
                renderCartasJugador();
                renderBoard();
                updateVisuals();
                calculateScores();
                renderLeaderboard();
                renderStatusPanel();
                actualizarBotonEspecial();
                return;
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
    
    const jugadores = Object.keys(state.playersData).map(id => ({
        id: id,
        nombre: state.playersData[id].name || 'Jugador',
        score: state.playersData[id].score || 0,
        esLocal: id === state.myId
    }));
    
    jugadores.sort((a, b) => b.score - a.score);
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
// FUNCIONES DE LOBBY - MODIFICADAS CON MODO AUTOMATICO
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
    
    const roomInput = document.getElementById('roomCodeInput');
    if (roomInput) {
        roomInput.value = '';
        roomInput.placeholder = 'ABCD';
        roomInput.readOnly = false;
        roomInput.style.opacity = '1';
        roomInput.style.color = 'white';
        roomInput.focus();
    }
    
    // Si estamos en modo automatico, precargar el codigo
    if (isAutoMode) {
        const roomInput = document.getElementById('roomCodeInput');
        if (roomInput) {
            roomInput.value = AUTO_ROOM_CODE;
            roomInput.readOnly = true;
            roomInput.style.opacity = '0.7';
            roomInput.style.color = '#4CAF50';
        }
    }
}

export function backToLobby() {
    document.getElementById('joinModal').style.display = 'none';
    document.getElementById('lobbyModal').style.display = 'flex';
    
    // Limpiar el campo al volver
    const roomInput = document.getElementById('roomCodeInput');
    if (roomInput) {
        roomInput.value = '';
        roomInput.placeholder = 'ABCD';
        roomInput.readOnly = false;
        roomInput.style.opacity = '1';
        roomInput.style.color = 'white';
    }
}

export function createRoom() {
    state.myName = getPlayerName();
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    connectToRoom(code);
}

export function joinRoom() {
    state.myName = getPlayerName();
    let code;
    
    if (isAutoMode) {
        code = AUTO_ROOM_CODE;
    } else {
        code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
        if (code.length !== 4) {
            mostrarMensaje('El codigo debe tener 4 letras/numeros.', 'error');
            return;
        }
    }
    
    // Limpiar después de usar
    document.getElementById('roomCodeInput').value = '';
    
    connectToRoom(code);
}

// ============================================
// EXPONER FUNCIONES GLOBALES
// ============================================

window.forzarRestauracionLocal = forzarRestauracionLocal;
window.isAutoMode = isAutoMode;
window.AUTO_ROOM_CODE = AUTO_ROOM_CODE;