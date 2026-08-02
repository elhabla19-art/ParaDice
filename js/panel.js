// ============================================
// PANEL DE ESTADO - RENDERIZADO
// ============================================

import { state, COLORES, TICKETS, PUNTAJES } from './config-state.js';

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
    
    const playerData = state.playersData[state.myId];
    const puntosEspeciales = playerData?.puntosEspeciales || [];
    const coloresMeta = state.coloresMeta || [];
    const primerColor = coloresMeta[0] || null;
    const resultadosFinales = state.resultadosFinales || {};
    
    // Calcular puntajes por color (SOLO CARTAS, sin tickets)
    let totalCartas = 0;
    let puntajesPorColor = {};
    
    COLORES.forEach((color) => {
        let puntajeColor = 0;
        if (playerData && playerData.progresoCartas) {
            for (let i = 1; i <= 9; i++) {
                const key = `${color}-${i}`;
                const data = playerData.progresoCartas[key];
                if (data && data.completada === true) {
                    puntajeColor += PUNTAJES[color][i - 1] || 0;
                }
            }
        }
        
        // Si hay resultados finales (segundo color en meta), usar esos valores
        if (resultadosFinales[color]) {
            const data = resultadosFinales[color];
            if (data.esPrimero) {
                puntajeColor = 0;
            } else if (data.esDoble) {
                puntajeColor = puntajeColor * 2;
            }
        } else if (color === primerColor) {
            puntajeColor = 0;
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
    
    // Tickets
    let tieneTickets = false;
    COLORES.forEach(color => {
        if (state.tickets[color] === state.myId) {
            tieneTickets = true;
            html += `<span class="status-ticket-dot" style="background: ${colorHex[color]};" title="Ticket ${color} (+${TICKETS[color]?.puntaje || 0}pts)"></span>`;
        }
    });
    if (state.bonusTicket === state.myId) {
        tieneTickets = true;
        html += `<span class="status-ticket-dot bonus-dot" style="background: #ffd700;" title="Bonus Ticket (+${TICKETS.bonus.puntaje}pts)"></span>`;
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
    
    // Puntos extra
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
    
    // Si hay un color con x2, mostrar indicador
    let colorXDoble = null;
    COLORES.forEach(color => {
        if (resultadosFinales[color] && resultadosFinales[color].esDoble) {
            colorXDoble = color;
        }
    });
    
    if (colorXDoble) {
        const nombreColor = {
            celeste: 'Celeste',
            lima: 'Lima',
            naranja: 'Naranja',
            purpura: 'Púrpura',
            rosa: 'Rosa'
        }[colorXDoble] || colorXDoble;
        html += `
            <div style="margin-top: 4px; padding: 4px 8px; background: rgba(255,215,0,0.15); border-radius: 4px; border: 1px solid #ffd70033; text-align: center; font-size: 0.65rem; color: #ffd700;">
                ⭐ ${nombreColor} x2 (más atrás)
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ============================================
// FUNCIÓN PARA ACTUALIZAR SOLO TICKETS Y EXTRAS
// ============================================

export function updateStatusTicketsAndExtras() {
    renderStatusPanel();
}

// ============================================
// EXPORTAR POR DEFECTO
// ============================================

export default renderStatusPanel;