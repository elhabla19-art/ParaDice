// ============================================
// UTILIDADES
// ============================================

import { COLORES_HEX, state } from './config-state.js';

// ----- MENSAJES -----
export function mostrarMensaje(texto, tipo = 'info') {
    const colores = {
        success: '#4caf50',
        error: '#d32f2f',
        warning: '#f39c12',
        info: '#2196f3'
    };
    
    const msg = document.createElement('div');
    msg.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${colores[tipo] || colores.info};
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        z-index: 9999;
        font-weight: bold;
        animation: slideDown 0.5s ease;
    `;
    msg.textContent = texto;
    document.body.appendChild(msg);
    
    setTimeout(() => {
        if (msg.parentNode) msg.remove();
    }, 3000);
}

// ----- LOADING -----
export function showLoading(texto) {
    const el = document.getElementById('loadingText');
    const modal = document.getElementById('loadingModal');
    if (el) el.textContent = texto;
    if (modal) modal.style.display = 'flex';
}

export function hideLoading() {
    const modal = document.getElementById('loadingModal');
    if (modal) modal.style.display = 'none';
}

// ----- NOMBRES -----
export function getPlayerName() {
    const input = document.getElementById('playerName');
    const nombre = input ? input.value.trim() : '';
    return nombre || 'Jugador ' + Math.floor(Math.random() * 100);
}

// ----- COLORES -----
export function getColorHex(color) {
    return COLORES_HEX[color] || '#666';
}

export function getColorName(color) {
    const names = {
        celeste: 'Celeste',
        lima: 'Lima',
        naranja: 'Naranja',
        purpura: 'Purpura',
        rosa: 'Rosa'
    };
    return names[color] || color;
}

// ----- ARRAYS -----
export function mezclarArray(array) {
    const copia = [...array];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

// ----- IDS -----
export function generarId() {
    return Math.random().toString(36).substr(2, 9);
}

// ----- VALIDACIÓN -----
export function esCodigoValido(codigo) {
    return /^[A-Z0-9]{4}$/.test(codigo);
}

// ----- DOM -----
export function $(selector) {
    return document.querySelector(selector);
}

export function $$(selector) {
    return document.querySelectorAll(selector);
}