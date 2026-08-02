// ============================================
// ZOOM
// ============================================

import { state, HABILIDADES } from './config-state.js';
import { getColorName } from './utils.js';
import { completarCarta, agregarCartaAJugador, getPuntajeCarta, usarHabilidad, isHabilidadUsada } from './juego.js';
import { pushMovimiento, eliminarMovimientosDeCarta, limpiarPilaMovimientos, intentarDeshacer, desmarcarCasilla, esUltimoMovimiento, hayMovimientos, peekMovimiento } from './deshacer.js';
import { renderCartasJugador, renderBoard } from './mazos-tablero.js';
import { renderStatusPanel } from './panel.js';
import { renderLeaderboard } from './leaderboard.js';
import { mostrarMensaje } from './utils.js';

// ============================================
// CREAR CASILLAS (con lógica de deshacer)
// ============================================

function crearCasillas(container, progresoData, carta) {
    container.innerHTML = '';
    
    // Obtener datos del progreso
    const marcadas = progresoData?.marcadas || [];
    const completada = progresoData?.completada || false;
    const key = `${carta.color}-${carta.numero}`;
    
    // Ajustar container
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';
    container.style.alignItems = 'center';
    container.style.minWidth = '45px';
    container.style.justifyContent = 'center';
    container.style.padding = '4px';
    
    for (let i = 1; i <= 3; i++) {
        const estaMarcada = marcadas.includes(i);
        const div = document.createElement('div');
        div.textContent = estaMarcada ? `${i} ✓` : i;
        div.style.cssText = `
            width: 45px; height: 45px;
            background: ${estaMarcada ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.1)'};
            border: 2px solid ${estaMarcada ? '#4caf50' : 'rgba(255,255,255,0.2)'};
            border-radius: 6px;
            display: flex; justify-content: center; align-items: center;
            font-size: 0.9rem; font-weight: bold;
            color: ${estaMarcada ? '#4caf50' : '#fff'};
            cursor: ${completada ? 'default' : 'pointer'};
            transition: all 0.2s;
        `;
        
        if (completada) {
            div.onclick = null;
            div.style.cursor = 'default';
            div.style.opacity = '0.6';
            container.appendChild(div);
            continue;
        }
        
        div.onclick = () => {
            if (state.juegoTerminado) {
                mostrarMensaje('El juego ya terminó. Reinicia para jugar de nuevo.', 'warning');
                return;
            }
            
            if (estaMarcada) {
                if (esUltimoMovimiento(key, i)) {
                    const deshecho = intentarDeshacer(key, i);
                    if (deshecho) {
                        desmarcarCasilla(key, i);
                        actualizarZoomJugador(carta);
                        renderCartasJugador();
                        renderBoard();
                        renderStatusPanel();
                        renderLeaderboard();
                        mostrarMensaje(`↩️ Deshecho: ${carta.color} N°${carta.numero} - Casilla ${i}`, 'info');
                    }
                } else {
                    const ultimo = peekMovimiento();
                    if (ultimo) {
                        mostrarMensaje(`Solo puedes deshacer el último movimiento (${ultimo.color} N°${ultimo.numero} - Casilla ${ultimo.casilla})`, 'warning');
                    } else {
                        mostrarMensaje('No hay movimientos para deshacer', 'warning');
                    }
                }
                return;
            }
            
            if (progresoData.completada) {
                mostrarMensaje('Esta carta ya está completada', 'warning');
                return;
            }
            
            completarCarta(carta, i);
        };
        
        if (!estaMarcada && !completada) {
            div.onmouseenter = () => { 
                div.style.background = 'rgba(255,255,255,0.2)'; 
                div.style.borderColor = '#4caf50'; 
                div.style.transform = 'scale(1.05)'; 
            };
            div.onmouseleave = () => { 
                div.style.background = 'rgba(255,255,255,0.1)'; 
                div.style.borderColor = 'rgba(255,255,255,0.2)'; 
                div.style.transform = 'scale(1)'; 
            };
        } else if (estaMarcada && !completada) {
            div.onmouseenter = () => { 
                div.style.background = 'rgba(255,100,100,0.2)'; 
                div.style.borderColor = '#ff6b6b'; 
                div.style.transform = 'scale(1.05)'; 
            };
            div.onmouseleave = () => { 
                div.style.background = 'rgba(76,175,80,0.3)'; 
                div.style.borderColor = '#4caf50'; 
                div.style.transform = 'scale(1)'; 
            };
        }
        
        container.appendChild(div);
    }
}

// ============================================
// ABRIR ZOOM
// ============================================

function abrirZoomBase(carta, esJugador) {
    const modal = document.getElementById('zoomModal');
    const img = document.getElementById('zoomImage');
    const text = document.getElementById('zoomText');
    const casillas = document.getElementById('zoomCasillas');
    if (!modal || !img || !text || !casillas) return null;
    
    // Limpiar contenido anterior
    casillas.innerHTML = '';
    casillas.style.display = 'flex';
    casillas.style.flexDirection = 'column';
    casillas.style.gap = '4px';
    casillas.style.alignItems = 'center';
    casillas.style.justifyContent = 'center';
    casillas.style.minWidth = '45px';
    casillas.style.padding = '4px';
    
    img.src = carta.imagen || '';
    img.onerror = () => { img.style.display = 'none'; };
    img.style.display = 'block';
    img.style.maxWidth = '280px';
    img.style.maxHeight = '400px';
    img.style.width = 'auto';
    img.style.height = 'auto';
    
    const puntaje = getPuntajeCarta(carta);
    text.textContent = `${carta.color ? getColorName(carta.color) : 'Especial'} N°${carta.numero} (${puntaje} pts)`;
    
    modal.style.display = 'flex';
    state.cartaSeleccionada = carta;
    
    return { modal, casillas };
}

// ============================================
// ZOOM: VISIBLE (SOLO IMAGEN + BOTÓN AGREGAR)
// ============================================

export function abrirZoomVisible(carta, indexVisible) {
    const result = abrirZoomBase(carta, false);
    if (!result) return;
    const { casillas } = result;
    
    // Mostrar solo puntaje y botón, sin casillas
    const pts = document.createElement('div');
    pts.textContent = `⭐ ${getPuntajeCarta(carta)} pts`;
    pts.style.cssText = `
        color:#ffd700; 
        font-size:0.9rem; 
        font-weight:bold; 
        text-align:center; 
        margin-bottom: 8px;
        width:100%;
    `;
    casillas.appendChild(pts);
    
    const btn = document.createElement('button');
    btn.textContent = 'Agregar a Mi Mano';
    btn.style.cssText = `
        background:#4caf50; 
        color:white; 
        border:none; 
        padding:10px 20px; 
        border-radius:6px; 
        font-size:0.9rem; 
        font-weight:bold; 
        cursor:pointer; 
        width:100%; 
        margin-top:4px;
    `;
    btn.onclick = () => agregarCartaAJugador(indexVisible);
    casillas.appendChild(btn);
}

// ============================================
// ZOOM: JUGADOR
// ============================================

export function abrirZoomJugador(carta) {
    const result = abrirZoomBase(carta, true);
    if (!result) return;
    const { casillas } = result;
    const key = `${carta.color}-${carta.numero}`;
    const progresoData = state.progresoCarta[key] || { marcadas: [], completada: false };
    crearCasillas(casillas, progresoData, carta);
}

export function actualizarZoomJugador(carta) {
    const casillas = document.getElementById('zoomCasillas');
    if (!casillas) return;
    const key = `${carta.color}-${carta.numero}`;
    const progresoData = state.progresoCarta[key] || { marcadas: [], completada: false };
    crearCasillas(casillas, progresoData, carta);
}

// ============================================
// ZOOM: TERMINADA (SOLO CARTA - SIN TEXTO)
// ============================================

export function abrirZoomTerminada(carta) {
    const modal = document.getElementById('zoomModal');
    const img = document.getElementById('zoomImage');
    const text = document.getElementById('zoomText');
    const casillas = document.getElementById('zoomCasillas');
    if (!modal || !img || !text || !casillas) return;
    
    // Limpiar contenido anterior
    casillas.innerHTML = '';
    casillas.style.display = 'none'; // Ocultar casillas completamente
    
    img.src = carta.imagen || '';
    img.onerror = () => { img.style.display = 'none'; };
    img.style.display = 'block';
    img.style.maxWidth = '350px';
    img.style.maxHeight = '500px';
    img.style.width = 'auto';
    img.style.height = 'auto';
    
    text.textContent = `${carta.color ? getColorName(carta.color) : 'Especial'} N°${carta.numero}`;
    
    modal.style.display = 'flex';
    state.cartaSeleccionada = carta;
}

// ============================================
// ZOOM: LEADERBOARD (OTROS JUGADORES)
// ============================================

export function abrirZoomLeaderboard(carta, playerName, jugadorId) {
    const result = abrirZoomBase(carta, false);
    if (!result) return;
    const { casillas } = result;
    
    // Mostrar nombre del jugador
    const nombreJugador = document.createElement('div');
    nombreJugador.textContent = `👤 ${playerName}`;
    nombreJugador.style.cssText = `
        color:#4fc3f7; 
        font-size:0.9rem; 
        font-weight:bold; 
        text-align:center; 
        margin-bottom:8px; 
        width:100%;
    `;
    casillas.appendChild(nombreJugador);
    
    // Mostrar progreso de la carta
    const pData = state.playersData[jugadorId];
    const progresoData = pData?.progresoCartas?.[`${carta.color}-${carta.numero}`] || { marcadas: [], completada: false };
    const marcadas = progresoData.marcadas || [];
    const completada = progresoData.completada || false;
    
    for (let i = 1; i <= 3; i++) {
        const estaMarcada = marcadas.includes(i);
        const div = document.createElement('div');
        div.textContent = estaMarcada ? `${i} ✓` : i;
        div.style.cssText = `
            width: 45px; height: 45px;
            background: ${estaMarcada ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.1)'};
            border: 2px solid ${estaMarcada ? '#4caf50' : 'rgba(255,255,255,0.2)'};
            border-radius: 6px;
            display: flex; justify-content: center; align-items: center;
            font-size: 0.9rem; font-weight: bold;
            color: ${estaMarcada ? '#4caf50' : '#fff'};
            cursor: default;
        `;
        casillas.appendChild(div);
    }
    
    // Indicador de solo vista
    const msg = document.createElement('div');
    msg.textContent = '🔒 Solo vista';
    msg.style.cssText = `
        color:#666; 
        font-size:0.7rem; 
        text-align:center; 
        margin-top:6px; 
        font-style:italic; 
        border-top:1px solid rgba(255,255,255,0.05); 
        padding-top:6px; 
        width:100%;
    `;
    casillas.appendChild(msg);
}

// ============================================
// CERRAR ZOOM
// ============================================

export function cerrarZoom() {
    const modal = document.getElementById('zoomModal');
    const casillas = document.getElementById('zoomCasillas');
    if (modal) modal.style.display = 'none';
    if (casillas) {
        casillas.innerHTML = '';
        casillas.style.display = 'flex'; // Restaurar display
    }
    state.cartaSeleccionada = null;
    
    // Restaurar historial si estaba activo
    if (window._historialState && window._historialState.activo) {
        const estado = window._historialState;
        if (estado.modo === 'local') {
            window.verHistorial(estado.color);
        } else if (estado.modo === 'remoto') {
            window.verHistorialDeJugador(estado.jugadorId, estado.color);
        }
        // Limpiar estado después de restaurar
        window._historialState = { activo: false, color: null, jugadorId: null, modo: null };
    }
}

// ============================================
// USAR HABILIDAD DESDE ZOOM
// ============================================

export function usarHabilidadDesdeZoom(cartaId) {
    const carta = state.cartasTerminadas.find(c => c.id === cartaId);
    if (carta) {
        cerrarZoom();
        usarHabilidad(carta);
    }
}

// ============================================
// EXPONER GLOBAL
// ============================================

window.usarHabilidadDesdeZoom = usarHabilidadDesdeZoom;