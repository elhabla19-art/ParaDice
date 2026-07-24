// ============================================
// LÓGICA DEL JUEGO
// ============================================

import { COLORES, state } from './config-state.js';
import { mostrarMensaje } from './utils.js';
import { renderCartasVisibles, renderCartasJugador, updateVisuals, renderBoard } from './mazos-tablero.js';
import { cerrarZoom, abrirZoomJugador } from './zoom.js';
import { broadcastScore, broadcastTablero } from './mqtt.js';

// ----- COMPLETAR CARTA (MARCAR CASILLA) -----
export function completarCarta(carta, casillaNumero) {
    const key = `${carta.color}-${carta.numero}`;
    if (!state.progresoCarta[key]) {
        state.progresoCarta[key] = 0;
    }
    
    // Solo se puede marcar si es la siguiente en orden
    if (casillaNumero === state.progresoCarta[key] + 1) {
        state.progresoCarta[key]++;
        const nuevoProgreso = state.progresoCarta[key];
        
        // Si se completó la carta (3/3), marcar UNA casilla en el tablero
        if (nuevoProgreso === 3) {
            const casillaIndex = (carta.numero - 1) % 6;
            if (!state.tableroGlobal[carta.color]) {
                state.tableroGlobal[carta.color] = Array(6).fill(false);
            }
            state.tableroGlobal[carta.color][casillaIndex] = true;
            
            mostrarMensaje(`🎉 ¡Carta ${carta.color} N°${carta.numero} completada!`, 'success');
            
            if (state.currentRoom) {
                broadcastTablero();
            }
        }
        
        // Actualizar todo
        updateVisuals();
        calculateScores();
        renderCartasJugador();
        
        // Reabrir zoom
        cerrarZoom();
        setTimeout(() => {
            abrirZoomJugador(carta);
        }, 200);
        
        if (state.currentRoom) {
            broadcastScore('sync');
        }
    } else {
        mostrarMensaje(`Debes marcar en orden: primero ${state.progresoCarta[key] + 1}`, 'error');
    }
}

// ----- AGREGAR CARTA VISIBLE A TUS CARTAS -----
export function agregarCartaAJugador(indexVisible) {
    const carta = state.cartasVisibles[indexVisible];
    if (!carta) return;
    
    const emptyIndex = state.cartasJugador.findIndex(c => c === null);
    if (emptyIndex === -1) {
        mostrarMensaje('No tienes espacio en Tus Cartas', 'warning');
        return;
    }
    
    state.cartasJugador[emptyIndex] = carta;
    state.cartasVisibles[indexVisible] = null;
    
    const key = `${carta.color}-${carta.numero}`;
    state.progresoCarta[key] = 0;
    
    cerrarZoom();
    renderCartasVisibles();
    renderCartasJugador();
    updateVisuals();
    
    if (state.currentRoom) {
        broadcastScore('sync');
    }
    
    mostrarMensaje('✅ Carta agregada a Tus Cartas', 'success');
}

// ----- CALCULAR PUNTAJE -----
export function calculateScores() {
    let totalScore = 0;
    
    COLORES.forEach(color => {
        if (state.tableroGlobal[color]) {
            const count = state.tableroGlobal[color].filter(v => v).length;
            totalScore += count * 2;
        }
    });
    
    state.myTotalScore = totalScore;

    const scoreTotal = document.getElementById('score-total');
    if (scoreTotal) {
        scoreTotal.textContent = totalScore;
    }

    if (state.currentRoom) {
        state.playersData[state.myId] = {
            name: state.myName,
            score: state.myTotalScore,
            cartasJugador: state.cartasJugador,
            mazoColores: state.mazoColores,
            cartasRepartidas: state.cartasRepartidas,
            tablero: state.tableroGlobal,
            progresoCartas: state.progresoCarta
        };
        // Leaderboard se actualiza desde main via callback
    }
}

// ----- REPARTIR CARTAS -----
export function repartirCartas() {
    if (state.cartasRepartidas) {
        mostrarMensaje('Ya se repartieron las cartas', 'warning');
        return;
    }
    
    if (state.mazoColores.length < 5) {
        mostrarMensaje('No hay suficientes cartas en el mazo', 'error');
        return;
    }
    
    const jugadores = Object.keys(state.playersData);
    if (jugadores.length === 0 || (jugadores.length === 1 && jugadores[0] === state.myId)) {
        const cartaJugador = state.mazoColores.pop();
        state.cartasJugador[0] = cartaJugador;
        const key = `${cartaJugador.color}-${cartaJugador.numero}`;
        state.progresoCarta[key] = 0;
    } else {
        jugadores.forEach((id, index) => {
            if (index < 4 && state.mazoColores.length > 0) {
                const carta = state.mazoColores.pop();
                if (id === state.myId) {
                    state.cartasJugador[index] = carta;
                    const key = `${carta.color}-${carta.numero}`;
                    state.progresoCarta[key] = 0;
                }
                if (!state.playersData[id]) {
                    state.playersData[id] = { name: 'Jugador', cartasJugador: [] };
                }
                if (!state.playersData[id].cartasJugador) {
                    state.playersData[id].cartasJugador = [];
                }
                state.playersData[id].cartasJugador[index] = carta;
            }
        });
    }
    
    const nuevasVisibles = [];
    for (let i = 0; i < 4; i++) {
        nuevasVisibles.push(state.mazoColores.pop());
    }
    state.cartasVisibles = nuevasVisibles;
    state.cartasRepartidas = true;
    
    COLORES.forEach(color => {
        state.tableroGlobal[color] = Array(6).fill(false);
    });
    
    renderCartasVisibles();
    renderCartasJugador();
    updateVisuals();
    calculateScores();
    
    if (state.currentRoom) {
        broadcastTablero();
        broadcastScore('repartir');
    }
    
    console.log('Cartas repartidas correctamente');
}

// ----- REINICIAR TABLERO -----
export function reiniciarTablero() {
    COLORES.forEach(color => {
        state.tableroGlobal[color] = Array(6).fill(false);
    });
    state.progresoCarta = {};
    updateVisuals();
    calculateScores();
    renderCartasJugador();
    if (state.currentRoom) {
        broadcastTablero();
    }
    mostrarMensaje('Tablero reiniciado', 'info');
}