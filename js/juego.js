// ============================================
// LÓGICA DEL JUEGO
// ============================================

import { COLORES, state, PUNTAJES } from './config-state.js';
import { mostrarMensaje } from './utils.js';
import { renderCartasVisibles, renderCartasJugador, updateVisuals, renderBoard } from './mazos-tablero.js';
import { cerrarZoom, abrirZoomJugador } from './zoom.js';
import { broadcastScore, broadcastTablero, broadcastMazo } from './mqtt.js';

// Obtener puntaje de una carta
export function getPuntajeCarta(carta) {
    if (!carta || !carta.color || !carta.numero) return 0;
    const puntajes = PUNTAJES[carta.color];
    if (!puntajes) return 0;
    return puntajes[carta.numero - 1] || 0;
}

// COMPLETAR CARTA (MARCAR CASILLA)
export function completarCarta(carta, casillaNumero) {
    const key = `${carta.color}-${carta.numero}`;
    if (!state.progresoCarta[key]) {
        state.progresoCarta[key] = 0;
    }
    
    if (casillaNumero === state.progresoCarta[key] + 1) {
        state.progresoCarta[key]++;
        const nuevoProgreso = state.progresoCarta[key];
        
        if (nuevoProgreso === 3) {
            if (!state.fichas[carta.color]) {
                state.fichas[carta.color] = 0;
            }
            
            if (state.fichas[carta.color] < 5) {
                state.fichas[carta.color]++;
            }
            
            const casillaAnterior = state.fichas[carta.color] - 1;
            if (casillaAnterior >= 0 && casillaAnterior < 6) {
                if (!state.tableroGlobal[carta.color]) {
                    state.tableroGlobal[carta.color] = Array(6).fill(false);
                }
                state.tableroGlobal[carta.color][casillaAnterior] = true;
            }
            
            const puntaje = getPuntajeCarta(carta);
            state.myTotalScore += puntaje;
            
            // Eliminar la carta completada de la mano del jugador
            const cartaIndex = state.cartasJugador.findIndex(c => c && c.id === carta.id);
            if (cartaIndex !== -1) {
                state.cartasJugador[cartaIndex] = null;
            }
            
            mostrarMensaje(
                `🎉 ¡Carta ${carta.color} N°${carta.numero} completada! (+${puntaje} pts)`, 
                'success'
            );
            
            if (state.currentRoom) {
                broadcastTablero();
            }
        }
        
        updateVisuals();
        calculateScores();
        renderCartasJugador();
        renderBoard();
        
        cerrarZoom();
        setTimeout(() => {
            const cartaActualizada = state.cartasJugador.find(c => c && c.id === carta.id);
            if (cartaActualizada) {
                abrirZoomJugador(cartaActualizada);
            }
        }, 200);
        
        if (state.currentRoom) {
            broadcastScore('sync');
        }
    } else {
        mostrarMensaje(`Debes marcar en orden: primero ${state.progresoCarta[key] + 1}`, 'error');
    }
}

// AGREGAR CARTA VISIBLE A LA MANO DEL JUGADOR
export function agregarCartaAJugador(indexVisible) {
    const carta = state.cartasVisibles[indexVisible];
    if (!carta) {
        mostrarMensaje('Esta casilla está vacía', 'warning');
        return;
    }
    
    // Verificar espacio en la mano del jugador
    const emptyIndex = state.cartasJugador.findIndex(c => c === null);
    if (emptyIndex === -1) {
        mostrarMensaje('No tienes espacio en tu mano (máximo 4 cartas)', 'warning');
        return;
    }
    
    // 1. Agregar la carta a la mano del jugador
    state.cartasJugador[emptyIndex] = carta;
    
    // 2. Eliminar la carta de las visibles
    state.cartasVisibles[indexVisible] = null;
    
    // 3. Reponer del mazo (si hay cartas disponibles)
    if (state.mazoColores.length > 0) {
        const nuevaCarta = state.mazoColores.pop();
        state.cartasVisibles[indexVisible] = nuevaCarta;
        mostrarMensaje(`🔄 Nueva carta visible: ${nuevaCarta.color} ${nuevaCarta.numero}`, 'info');
    } else {
        mostrarMensaje('⚠️ No quedan cartas en el mazo para reponer', 'warning');
    }
    
    // 4. Inicializar progreso de la carta
    const key = `${carta.color}-${carta.numero}`;
    state.progresoCarta[key] = 0;
    
    // 5. Actualizar UI
    renderCartasVisibles();
    renderCartasJugador();
    updateVisuals();
    
    if (state.currentRoom) {
        broadcastMazo(); // Sincronizar mazo y visibles
        broadcastScore('sync');
    }
    
    mostrarMensaje(`✅ Carta ${carta.color} ${carta.numero} agregada a tu mano`, 'success');
}

// CALCULAR PUNTAJE
export function calculateScores() {
    const scoreTotal = document.getElementById('score-total');
    if (scoreTotal) {
        scoreTotal.textContent = state.myTotalScore;
    }

    if (state.currentRoom) {
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
    }
}

// REPARTIR CARTAS - SOLO MUESTRA 4 VISIBLES
export function repartirCartas() {
    if (state.cartasRepartidas) {
        mostrarMensaje('Ya se repartieron las cartas', 'warning');
        return;
    }
    
    // Verificar que haya al menos 4 cartas
    if (state.mazoColores.length < 4) {
        mostrarMensaje('No hay suficientes cartas en el mazo (mínimo 4)', 'error');
        return;
    }
    
    // 1. Limpiar cartas anteriores
    state.cartasJugador = Array(4).fill(null);
    state.cartasVisibles = Array(4).fill(null);
    state.progresoCarta = {};
    
    // 2. Mostrar 4 cartas visibles (desde el mazo global)
    for (let i = 0; i < 4; i++) {
        if (state.mazoColores.length > 0) {
            state.cartasVisibles[i] = state.mazoColores.pop();
        }
    }
    
    state.cartasRepartidas = true;
    
    // 3. Reiniciar fichas y tablero
    COLORES.forEach(color => {
        state.tableroGlobal[color] = Array(6).fill(false);
        state.fichas[color] = 0;
    });
    state.myTotalScore = 0;
    
    renderCartasVisibles();
    renderCartasJugador();
    updateVisuals();
    renderBoard();
    calculateScores();
    
    if (state.currentRoom) {
        broadcastMazo();
        broadcastTablero();
        broadcastScore('repartir');
    }
    
    console.log(`✅ Cartas visibles mostradas. Quedan ${state.mazoColores.length} cartas en el mazo`);
    mostrarMensaje(`🃏 4 cartas visibles disponibles. Quedan ${state.mazoColores.length} en el mazo`, 'info');
}

// REINICIAR TABLERO
export function reiniciarTablero() {
    COLORES.forEach(color => {
        state.tableroGlobal[color] = Array(6).fill(false);
        state.fichas[color] = 0;
    });
    state.progresoCarta = {};
    state.myTotalScore = 0;
    updateVisuals();
    calculateScores();
    renderCartasJugador();
    renderBoard();
    if (state.currentRoom) {
        broadcastTablero();
    }
    mostrarMensaje('Tablero reiniciado', 'info');
}

// LIMPIAR MANO DEL JUGADOR (opcional)
export function limpiarMano() {
    state.cartasJugador = Array(4).fill(null);
    renderCartasJugador();
    if (state.currentRoom) {
        broadcastScore('sync');
    }
    mostrarMensaje('Mano limpiada', 'info');
}