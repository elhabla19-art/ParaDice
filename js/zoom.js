// ============================================
// ZOOM
// ============================================

import { state, HABILIDADES } from './config-state.js';
import { getColorName } from './utils.js';
import { completarCarta, agregarCartaAJugador, getPuntajeCarta, usarHabilidad, isHabilidadUsada } from './juego.js';

// ============================================
// CREAR CASILLAS (función auxiliar)
// ============================================

function crearCasillas(container, progreso, completada, carta) {
    container.innerHTML = '';
    
    for (let i = 1; i <= 3; i++) {
        const estaMarcada = i <= progreso;
        const div = document.createElement('div');
        div.textContent = estaMarcada ? `${i} ✓` : i;
        div.style.cssText = `
            width: 50px; height: 50px;
            background: ${estaMarcada ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.1)'};
            border: 2px solid ${estaMarcada ? '#4caf50' : 'rgba(255,255,255,0.2)'};
            border-radius: 8px;
            display: flex; justify-content: center; align-items: center;
            font-size: 1.2rem; font-weight: bold;
            color: ${estaMarcada ? '#4caf50' : '#fff'};
            cursor: ${estaMarcada || completada ? 'default' : 'pointer'};
            transition: all 0.2s;
        `;
        
        if (!estaMarcada && !completada) {
            div.onmouseenter = () => { div.style.background = 'rgba(255,255,255,0.2)'; div.style.borderColor = '#4caf50'; div.style.transform = 'scale(1.05)'; };
            div.onmouseleave = () => { div.style.background = 'rgba(255,255,255,0.1)'; div.style.borderColor = 'rgba(255,255,255,0.2)'; div.style.transform = 'scale(1)'; };
            div.onclick = () => completarCarta(carta, i);
        }
        container.appendChild(div);
    }
    
    const info = document.createElement('div');
    info.textContent = completada ? '✓ Completada' : `${progreso}/3`;
    info.style.cssText = `text-align:center; color:${completada ? '#4caf50' : '#666'}; font-size:${completada ? '1rem' : '0.7rem'}; font-weight:${completada ? 'bold' : 'normal'}; margin-top:5px;`;
    container.appendChild(info);
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
    
    img.src = carta.imagen || '';
    img.onerror = () => { img.style.display = 'none'; };
    img.style.display = 'block';
    
    const puntaje = getPuntajeCarta(carta);
    text.textContent = `${carta.color ? getColorName(carta.color) : 'Especial'} N°${carta.numero} (${puntaje} pts)`;
    
    casillas.innerHTML = '';
    modal.style.display = 'flex';
    state.cartaSeleccionada = carta;
    
    return { modal, casillas };
}

// ============================================
// ZOOM: VISIBLE
// ============================================

export function abrirZoomVisible(carta, indexVisible) {
    const result = abrirZoomBase(carta, false);
    if (!result) return;
    const { casillas } = result;
    
    for (let i = 1; i <= 3; i++) {
        const div = document.createElement('div');
        div.textContent = i;
        div.style.cssText = `width:50px; height:50px; background:rgba(255,255,255,0.1); border:2px solid rgba(255,255,255,0.2); border-radius:8px; display:flex; justify-content:center; align-items:center; font-size:1.2rem; font-weight:bold; color:#fff; cursor:default;`;
        casillas.appendChild(div);
    }
    
    const pts = document.createElement('div');
    pts.textContent = `⭐ ${getPuntajeCarta(carta)} pts`;
    pts.style.cssText = `color:#ffd700; font-size:0.8rem; font-weight:bold; text-align:center; margin-top:2px;`;
    casillas.appendChild(pts);
    
    const btn = document.createElement('button');
    btn.textContent = 'Agregar a Mi Mano';
    btn.style.cssText = `background:#4caf50; color:white; border:none; padding:10px 25px; border-radius:8px; font-size:1rem; font-weight:bold; cursor:pointer; width:100%; margin-top:10px;`;
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
    const progreso = state.progresoCarta[key] || 0;
    crearCasillas(casillas, progreso, progreso === 3, carta);
}

export function actualizarZoomJugador(carta) {
    const casillas = document.getElementById('zoomCasillas');
    if (!casillas) return;
    const key = `${carta.color}-${carta.numero}`;
    const progreso = state.progresoCarta[key] || 0;
    crearCasillas(casillas, progreso, progreso === 3, carta);
}

// ============================================
// ZOOM: TERMINADA
// ============================================

export function abrirZoomTerminada(carta) {
    const result = abrirZoomBase(carta, false);
    if (!result) return;
    const { casillas } = result;
    
    for (let i = 1; i <= 3; i++) {
        const div = document.createElement('div');
        div.textContent = `${i} ✓`;
        div.style.cssText = `width:50px; height:50px; background:rgba(76,175,80,0.3); border:2px solid #4caf50; border-radius:8px; display:flex; justify-content:center; align-items:center; font-size:1.2rem; font-weight:bold; color:#4caf50; cursor:default;`;
        casillas.appendChild(div);
    }
    
    const habilidad = HABILIDADES[carta.color];
    const usada = isHabilidadUsada(carta);
    const info = document.createElement('div');
    info.style.cssText = `text-align:center; margin-top:10px; width:100%; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px;`;
    info.innerHTML = habilidad ? `
        <div style="font-size:1.5rem;">${habilidad.icono}</div>
        <div style="font-weight:bold; color:${habilidad.color};">${habilidad.nombre}</div>
        <div style="font-size:0.8rem; color:#aaa;">${habilidad.descripcion}</div>
        <div style="font-size:0.8rem; margin-top:4px; color:${usada ? '#666' : '#4caf50'}; font-weight:bold;">${usada ? '✓ Usada' : '✨ Disponible'}</div>
        ${!usada ? `<button onclick="window.usarHabilidadDesdeZoom('${carta.id}')" style="margin-top:8px; background:#4caf50; color:white; border:none; padding:6px 20px; border-radius:6px; font-size:0.8rem; font-weight:bold; cursor:pointer;">Usar Habilidad</button>` : ''}
    ` : `<div style="color:#888;">Sin habilidad especial</div>`;
    casillas.appendChild(info);
}

// ============================================
// ZOOM: LEADERBOARD
// ============================================

export function abrirZoomLeaderboard(carta, playerName, jugadorId) {
    const result = abrirZoomBase(carta, false);
    if (!result) return;
    const { casillas } = result;
    
    const pData = state.playersData[jugadorId];
    const progreso = pData?.progresoCartas?.[`${carta.color}-${carta.numero}`] || 0;
    
    for (let i = 1; i <= 3; i++) {
        const esta = i <= progreso;
        const div = document.createElement('div');
        div.textContent = esta ? `${i} ✓` : i;
        div.style.cssText = `width:50px; height:50px; background:${esta ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.1)'}; border:2px solid ${esta ? '#4caf50' : 'rgba(255,255,255,0.2)'}; border-radius:8px; display:flex; justify-content:center; align-items:center; font-size:1.2rem; font-weight:bold; color:${esta ? '#4caf50' : '#fff'}; cursor:default;`;
        casillas.appendChild(div);
    }
    
    const info = document.createElement('div');
    info.textContent = progreso === 3 ? '✓ Completada' : `${progreso}/3`;
    info.style.cssText = `text-align:center; color:${progreso === 3 ? '#4caf50' : '#666'}; font-size:${progreso === 3 ? '1rem' : '0.7rem'}; font-weight:${progreso === 3 ? 'bold' : 'normal'}; margin-top:5px;`;
    casillas.appendChild(info);
    
    const msg = document.createElement('div');
    msg.textContent = 'Solo vista';
    msg.style.cssText = `color:#666; font-size:0.7rem; text-align:center; margin-top:5px; font-style:italic;`;
    casillas.appendChild(msg);
}

// ============================================
// CERRAR ZOOM
// ============================================

export function cerrarZoom() {
    const modal = document.getElementById('zoomModal');
    const casillas = document.getElementById('zoomCasillas');
    if (modal) modal.style.display = 'none';
    if (casillas) casillas.innerHTML = '';
    state.cartaSeleccionada = null;
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