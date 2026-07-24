// ============================================
// ZOOM - 3 VISTAS
// ============================================

import { state } from './config-state.js';
import { getColorName } from './utils.js';
import { completarCarta, agregarCartaAJugador, getPuntajeCarta } from './juego.js';

// ZOOM PARA CARTAS VISIBLES
export function abrirZoomVisible(carta, indexVisible) {
    const modal = document.getElementById('zoomModal');
    const img = document.getElementById('zoomImage');
    const text = document.getElementById('zoomText');
    const casillasContainer = document.getElementById('zoomCasillas');
    
    if (!modal || !img || !text || !casillasContainer) return;
    
    state.zoomModo = 'visible';
    state.cartaSeleccionada = carta;
    
    img.src = carta.imagen || '';
    img.alt = `Carta ${carta.color || 'Especial'} ${carta.numero || ''}`;
    img.onerror = function() {
        this.style.display = 'none';
        text.textContent = `${carta.color ? getColorName(carta.color) : 'Especial'} - Número ${carta.numero || ''}`;
    };
    img.style.display = 'block';
    
    const puntaje = getPuntajeCarta(carta);
    text.textContent = `${carta.color ? getColorName(carta.color) : 'Especial'} - Número ${carta.numero || ''} (${puntaje} pts)`;
    
    casillasContainer.innerHTML = '';
    
    // Mostrar casillas 1, 2, 3
    for (let i = 1; i <= 3; i++) {
        const casillaDiv = document.createElement('div');
        casillaDiv.textContent = i;
        casillaDiv.style.cssText = `
            width: 50px;
            height: 50px;
            background: rgba(255,255,255,0.1);
            border: 2px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 1.2rem;
            font-weight: bold;
            color: #fff;
            cursor: default;
        `;
        casillasContainer.appendChild(casillaDiv);
    }
    
    // Mostrar puntaje
    const puntajeDiv = document.createElement('div');
    puntajeDiv.textContent = `⭐ ${puntaje} pts`;
    puntajeDiv.style.cssText = `
        color: #ffd700;
        font-size: 0.8rem;
        font-weight: bold;
        text-align: center;
        margin-top: 2px;
    `;
    casillasContainer.appendChild(puntajeDiv);
    
    // Botón Agregar
    const btnAgregar = document.createElement('button');
    btnAgregar.textContent = '➕ Agregar a Tus Cartas';
    btnAgregar.style.cssText = `
        background: #4caf50;
        color: white;
        border: none;
        padding: 10px 25px;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        width: 100%;
        margin-top: 10px;
    `;
    btnAgregar.onmouseenter = function() {
        this.style.transform = 'scale(1.05)';
        this.style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.3)';
    };
    btnAgregar.onmouseleave = function() {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = 'none';
    };
    btnAgregar.onclick = function() {
        agregarCartaAJugador(indexVisible);
    };
    casillasContainer.appendChild(btnAgregar);
    
    modal.style.display = 'flex';
}

// ZOOM PARA CARTAS DEL JUGADOR
export function abrirZoomJugador(carta) {
    const modal = document.getElementById('zoomModal');
    const img = document.getElementById('zoomImage');
    const text = document.getElementById('zoomText');
    const casillasContainer = document.getElementById('zoomCasillas');
    
    if (!modal || !img || !text || !casillasContainer) return;
    
    state.zoomModo = 'jugador';
    state.cartaSeleccionada = carta;
    
    img.src = carta.imagen || '';
    img.alt = `Carta ${carta.color || 'Especial'} ${carta.numero || ''}`;
    img.onerror = function() {
        this.style.display = 'none';
        text.textContent = `${carta.color ? getColorName(carta.color) : 'Especial'} - Número ${carta.numero || ''}`;
    };
    img.style.display = 'block';
    
    const puntaje = getPuntajeCarta(carta);
    text.textContent = `${carta.color ? getColorName(carta.color) : 'Especial'} - Número ${carta.numero || ''} (${puntaje} pts)`;
    
    casillasContainer.innerHTML = '';
    
    const key = `${carta.color}-${carta.numero}`;
    const progreso = state.progresoCarta[key] || 0;
    const completada = progreso === 3;
    
    // Mostrar casillas 1, 2, 3
    for (let i = 1; i <= 3; i++) {
        const estaMarcada = i <= progreso;
        
        const casillaDiv = document.createElement('div');
        casillaDiv.textContent = estaMarcada ? `${i} ✓` : i;
        casillaDiv.style.cssText = `
            width: 50px;
            height: 50px;
            background: ${estaMarcada ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.1)'};
            border: 2px solid ${estaMarcada ? '#4caf50' : 'rgba(255,255,255,0.2)'};
            border-radius: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 1.2rem;
            font-weight: bold;
            color: ${estaMarcada ? '#4caf50' : '#fff'};
            cursor: ${estaMarcada || completada ? 'default' : 'pointer'};
            transition: all 0.2s;
        `;
        
        if (!estaMarcada && !completada) {
            casillaDiv.onmouseenter = function() {
                this.style.background = 'rgba(255,255,255,0.2)';
                this.style.borderColor = '#4caf50';
                this.style.transform = 'scale(1.05)';
            };
            casillaDiv.onmouseleave = function() {
                this.style.background = 'rgba(255,255,255,0.1)';
                this.style.borderColor = 'rgba(255,255,255,0.2)';
                this.style.transform = 'scale(1)';
            };
            casillaDiv.onclick = function() {
                completarCarta(carta, i);
            };
        }
        
        casillasContainer.appendChild(casillaDiv);
    }
    
    // Estado
    const infoDiv = document.createElement('div');
    infoDiv.textContent = progreso === 3 ? '✓ Carta completada (+' + puntaje + ' pts)' : `${progreso}/3`;
    infoDiv.style.cssText = `
        text-align: center;
        color: ${progreso === 3 ? '#4caf50' : '#666'};
        font-size: ${progreso === 3 ? '1rem' : '0.7rem'};
        font-weight: ${progreso === 3 ? 'bold' : 'normal'};
        margin-top: 5px;
    `;
    casillasContainer.appendChild(infoDiv);
    
    if (progreso === 3) {
        const msg = document.createElement('div');
        msg.textContent = `⭐ Puntaje: +${puntaje} pts`;
        msg.style.cssText = `
            color: #ffd700;
            font-size: 0.8rem;
            text-align: center;
            font-weight: bold;
        `;
        casillasContainer.appendChild(msg);
    }
    
    modal.style.display = 'flex';
}

// ZOOM PARA LEADERBOARD (SOLO VISTA)
export function abrirZoomLeaderboard(carta, playerName, jugadorId) {
    const modal = document.getElementById('zoomModal');
    const img = document.getElementById('zoomImage');
    const text = document.getElementById('zoomText');
    const casillasContainer = document.getElementById('zoomCasillas');
    
    if (!modal || !img || !text || !casillasContainer) return;
    
    state.zoomModo = 'leaderboard';
    state.cartaSeleccionada = carta;
    
    img.src = carta.imagen || '';
    img.alt = `Carta ${carta.color || 'Especial'} ${carta.numero || ''}`;
    img.onerror = function() {
        this.style.display = 'none';
        text.textContent = `${carta.color ? getColorName(carta.color) : 'Especial'} - Número ${carta.numero || ''}`;
    };
    img.style.display = 'block';
    
    const puntaje = getPuntajeCarta(carta);
    text.textContent = `${playerName} - ${carta.color ? getColorName(carta.color) : 'Especial'} N°${carta.numero || ''} (${puntaje} pts)`;
    
    casillasContainer.innerHTML = '';
    
    // Obtener progreso del jugador
    const playerData = state.playersData[jugadorId];
    const pProgreso = playerData && playerData.progresoCartas ? 
        playerData.progresoCartas[`${carta.color}-${carta.numero}`] || 0 : 0;
    
    // Mostrar casillas 1, 2, 3
    for (let i = 1; i <= 3; i++) {
        const estaMarcada = i <= pProgreso;
        
        const casillaDiv = document.createElement('div');
        casillaDiv.textContent = estaMarcada ? `${i} ✓` : i;
        casillaDiv.style.cssText = `
            width: 50px;
            height: 50px;
            background: ${estaMarcada ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.1)'};
            border: 2px solid ${estaMarcada ? '#4caf50' : 'rgba(255,255,255,0.2)'};
            border-radius: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 1.2rem;
            font-weight: bold;
            color: ${estaMarcada ? '#4caf50' : '#fff'};
            cursor: default;
        `;
        casillasContainer.appendChild(casillaDiv);
    }
    
    // Estado
    const infoDiv = document.createElement('div');
    infoDiv.textContent = pProgreso === 3 ? '✓ Completada (+' + puntaje + ' pts)' : `${pProgreso}/3`;
    infoDiv.style.cssText = `
        text-align: center;
        color: ${pProgreso === 3 ? '#4caf50' : '#666'};
        font-size: ${pProgreso === 3 ? '1rem' : '0.7rem'};
        font-weight: ${pProgreso === 3 ? 'bold' : 'normal'};
        margin-top: 5px;
    `;
    casillasContainer.appendChild(infoDiv);
    
    // Mensaje de solo lectura
    const msg = document.createElement('div');
    msg.textContent = '👁️ Solo vista';
    msg.style.cssText = `
        color: #666;
        font-size: 0.7rem;
        text-align: center;
        margin-top: 5px;
        font-style: italic;
    `;
    casillasContainer.appendChild(msg);
    
    modal.style.display = 'flex';
}

// CERRAR ZOOM
export function cerrarZoom() {
    const modal = document.getElementById('zoomModal');
    const casillasContainer = document.getElementById('zoomCasillas');
    if (modal) modal.style.display = 'none';
    if (casillasContainer) casillasContainer.innerHTML = '';
    state.cartaSeleccionada = null;
}