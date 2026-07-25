// ============================================
// PANEL DE ESTADO - RENDERIZADO
// ============================================

import { state, COLORES } from './config-state.js';

// ============================================
// FUNCIÓN PRINCIPAL PARA RENDERIZAR EL PANEL
// ============================================

export function renderStatusPanel() {
    const container = document.getElementById('status-panel-content');
    if (!container) return;
    
    const colorHex = {
        celeste: '#4fc3f7',
        lima: '#aed581',
        naranja: '#ffb74d',
        purpura: '#ce93d8',
        rosa: '#f06292'
    };
    
    const PUNTAJES = {
        celeste: [15, 15, 10, 15, 20, 20, 20, 10, 20],
        lima: [20, 10, 15, 20, 10, 10, 20, 15, 15],
        naranja: [15, 15, 10, 10, 20, 20, 20, 15, 10],
        purpura: [10, 20, 15, 20, 20, 15, 10, 15, 10],
        rosa: [15, 15, 10, 10, 10, 20, 20, 15, 20]
    };
    
    // Obtener datos del jugador actual
    const playerData = state.playersData[state.myId];
    const puntosEspeciales = playerData?.puntosEspeciales || [];
    
    // Calcular puntajes por color
    let totalCartas = 0;
    let puntajesPorColor = {};
    COLORES.forEach((color) => {
        let puntajeColor = 0;
        if (playerData && playerData.progresoCartas) {
            for (let i = 1; i <= 9; i++) {
                const key = `${color}-${i}`;
                if (playerData.progresoCartas[key] === 3) {
                    puntajeColor += PUNTAJES[color][i - 1] || 0;
                }
            }
        }
        totalCartas += puntajeColor;
        puntajesPorColor[color] = puntajeColor;
    });
    
    // Construir HTML con grid de 4 columnas
    let html = `
        <div class="status-row">
            <div class="status-colors">
                <span class="status-item-color" style="color: ${colorHex.celeste};">${puntajesPorColor.celeste}pts</span>
            </div>
            <div class="status-colors">
                <span class="status-item-color" style="color: ${colorHex.lima};">${puntajesPorColor.lima}pts</span>
            </div>
            <div class="status-colors">
                <span class="status-item-color" style="color: ${colorHex.naranja};">${puntajesPorColor.naranja}pts</span>
            </div>
            <div class="status-colors status-tickets-col">
    `;
    
    // Tickets - solo puntos de colores
    let tieneTickets = false;
    COLORES.forEach(color => {
        if (state.tickets[color] === state.myId) {
            tieneTickets = true;
            html += `<span class="status-ticket-dot" style="background: ${colorHex[color]};"></span>`;
        }
    });
    if (state.bonusTicket === state.myId) {
        tieneTickets = true;
        html += `<span class="status-ticket-dot bonus-dot" style="background: #ffd700;"></span>`;
    }
    if (!tieneTickets) {
        html += `<span class="status-sin-tickets">Sin tickets</span>`;
    }
    
    html += `
            </div>
        </div>
        <div class="status-row">
            <div class="status-colors">
                <span class="status-item-color" style="color: ${colorHex.purpura};">${puntajesPorColor.purpura}pts</span>
            </div>
            <div class="status-colors">
                <span class="status-item-color" style="color: ${colorHex.rosa};">${puntajesPorColor.rosa}pts</span>
            </div>
            <div class="status-colors">
                <span class="status-item-todas">Todas: ${totalCartas}pts</span>
            </div>
            <div class="status-colors status-extras-col">
    `;
    
    // Puntos extra - solo números con +
    if (puntosEspeciales.length > 0) {
        puntosEspeciales.forEach(puntos => {
            html += `<span class="status-extra">+${puntos}</span>`;
        });
    } else {
        html += `<span class="status-sin-extras">Sin extras</span>`;
    }
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// ============================================
// FUNCIÓN PARA ACTUALIZAR SOLO TICKETS Y EXTRAS
// ============================================

export function updateStatusTicketsAndExtras() {
    // Esta función puede ser útil si solo quieres actualizar tickets/extras sin recalcular todo
    renderStatusPanel();
}

// ============================================
// EXPORTAR POR DEFECTO
// ============================================

export default renderStatusPanel;