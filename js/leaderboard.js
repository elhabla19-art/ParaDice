// ============================================
// LEADERBOARD - LISTA DE JUGADORES
// ============================================

import { COLORES, state, TICKETS, PUNTAJES } from './config-state.js';
import { abrirZoomLeaderboard } from './zoom.js';
import { getCartasCompletadasPorColor } from './juego.js';

// RENDERIZAR LEADERBOARD
export function renderLeaderboard() {
    const list = document.getElementById('playersList');
    if (!list) return;
    list.innerHTML = '';
    
    const playersArr = Object.keys(state.playersData).map(id => ({
        id: id,
        ...state.playersData[id]
    })).sort((a, b) => (b.score || 0) - (a.score || 0));

    playersArr.forEach(p => {
        const isMe = p.id === state.myId;
        const card = document.createElement('div');
        card.className = 'player-card ' + (isMe ? 'me' : '');
        
        // ----- TICKETS Y PUNTOS EXTRA EN UNA LÍNEA -----
        let ticketsHtml = '<div class="mini-tickets">';
        let tieneTickets = false;
        
        COLORES.forEach(color => {
            if (state.tickets[color] === p.id) {
                tieneTickets = true;
                const colorHex = {
                    celeste: '#4fc3f7',
                    lima: '#aed581',
                    naranja: '#ffb74d',
                    purpura: '#ce93d8',
                    rosa: '#f06292'
                }[color] || '#666';
                ticketsHtml += `
                    <span class="mini-ticket" style="border-color: ${colorHex};">
                        <span class="dot" style="background: ${colorHex};"></span>
                        ${TICKETS[color].nombre} (+${TICKETS[color].puntaje}pts)
                    </span>
                `;
            }
        });
        
        if (state.bonusTicket === p.id) {
            tieneTickets = true;
            ticketsHtml += `
                <span class="mini-ticket bonus">
                    🌟 Bonus (+${TICKETS.bonus.puntaje}pts)
                </span>
            `;
        }
        
        // ----- PUNTOS EXTRA DE CARTAS ESPECIALES (SOLO TAGS INDIVIDUALES) -----
        if (p.puntosEspeciales && p.puntosEspeciales.length > 0) {
            tieneTickets = true;
            p.puntosEspeciales.forEach(puntos => {
                ticketsHtml += `
                    <span class="mini-ticket puntos-extra" style="border-color: #555; background: rgba(85,85,85,0.15);">
                        +${puntos} pts
                    </span>
                `;
            });
        }
        
        // ----- ELIMINADO: Tag "Especiales: X" -----
        
        if (!tieneTickets) {
            ticketsHtml += '<span class="mini-ticket vacio">Sin tickets</span>';
        }
        ticketsHtml += '</div>';
        
        // ----- CARTAS EN MANO (5 cuadros con casillas) -----
        const pCartas = p.cartasJugador || [];
        const pProgreso = p.progresoCartas || {};
        
        let cartasHtml = '<div class="mini-cartas-mano">';
        for (let i = 0; i < 5; i++) {
            const carta = pCartas[i] || null;
            const colorHex = carta ? {
                celeste: '#4fc3f7',
                lima: '#aed581',
                naranja: '#ffb74d',
                purpura: '#ce93d8',
                rosa: '#f06292'
            }[carta.color] : '#444';
            
            const progreso = carta ? (pProgreso[`${carta.color}-${carta.numero}`] || 0) : 0;
            const tieneCarta = carta !== null;
            
            cartasHtml += `
                <div class="mini-carta-mano" style="background: ${tieneCarta ? colorHex + '22' : '#2a2a2a'}; border: 2px solid ${tieneCarta ? colorHex : '#444'};">
                    <div class="mini-carta-casillas">
                        ${[1, 2, 3].map(i => `
                            <span class="mini-casilla ${(tieneCarta && i <= progreso) ? 'llena' : ''}"></span>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        cartasHtml += '</div>';
        
        // ----- TAGS DE COLORES EN UNA LÍNEA CON "TODAS" AL FINAL -----
        let statsHtml = '<div class="player-stats-line">';
        let totalCartas = 0;
        
        COLORES.forEach(color => {
            const completadas = getCartasCompletadasPorColor(p.id, color);
            const total = completadas.length;
            
            // Calcular puntaje de este color
            let puntajeColor = 0;
            completadas.forEach(num => {
                puntajeColor += PUNTAJES[color][num - 1] || 0;
            });
            totalCartas += puntajeColor;
            
            // Contar habilidades disponibles
            const cartasTerminadas = p.cartasTerminadas || [];
            const cartasColor = cartasTerminadas.filter(c => c.color === color);
            const disponibles = cartasColor.filter(c => {
                const usada = p.habilidadesUsadas ? p.habilidadesUsadas[c.id] : true;
                return !usada;
            });
            
            const colorHex = {
                celeste: '#4fc3f7',
                lima: '#aed581',
                naranja: '#ffb74d',
                purpura: '#ce93d8',
                rosa: '#f06292'
            }[color] || '#666';
            
            statsHtml += `
                <span class="stat-color" style="color: ${colorHex};">
                    ● ${total} (${puntajeColor}pts) ${disponibles.length} hab.
                </span>
            `;
        });
        
        // Tag "Todas" en gris al final
        statsHtml += `
            <span class="stat-todas" style="color: #888;">
                📊 Todas: ${totalCartas}pts
            </span>
        `;
        statsHtml += '</div>';

        // ----- PUNTAJE TOTAL -----
        const puntajeTotal = (p.score || 0);

        card.innerHTML = `
            <div class="player-card-header">
                <span>${p.name}${isMe ? ' (Tú)' : ''}</span>
                <span>${puntajeTotal} pts</span>
            </div>
            ${ticketsHtml}
            ${cartasHtml}
            ${statsHtml}
        `;
        
        list.appendChild(card);
    });
}

// TOGGLE LEADERBOARD
export function toggleLeaderboard() {
    const content = document.getElementById('leaderboardContent');
    const icon = document.getElementById('toggleIcon');
    if (!content || !icon) return;
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▲';
    } else {
        content.style.display = 'none';
        icon.textContent = '▼';
    }
}

// ABRIR ZOOM DESDE LEADERBOARD
export function abrirZoomLeaderboardDesdeCard(playerId, cartaIndex) {
    const player = state.playersData[playerId];
    if (!player || !player.cartasJugador || !player.cartasJugador[cartaIndex]) {
        return;
    }
    const carta = player.cartasJugador[cartaIndex];
    abrirZoomLeaderboard(carta, player.name, playerId);
}