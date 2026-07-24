// ============================================
// LEADERBOARD - LISTA DE JUGADORES
// ============================================

import { COLORES, state } from './config-state.js';
import { abrirZoomLeaderboard } from './zoom.js';
import { getPuntajeCarta } from './juego.js';

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
        
        let cartasHtml = '<div class="mini-cartas-jugador">';
        const pCartas = p.cartasJugador || [];
        const pProgreso = p.progresoCartas || {};
        
        if (pCartas.length === 0 || pCartas.every(c => c === null)) {
            cartasHtml += '<span class="mini-carta vacia">Sin cartas</span>';
        } else {
            pCartas.forEach((carta, idx) => {
                if (carta) {
                    const key = `${carta.color}-${carta.numero}`;
                    const progreso = pProgreso[key] || 0;
                    const isCompleta = progreso === 3;
                    const puntaje = getPuntajeCarta(carta);
                    
                    const colorAbr = carta.color ? carta.color.substring(0, 2) : 'E';
                    
                    cartasHtml += `
                        <div class="mini-carta-jugador" 
                             onclick="window.abrirZoomLeaderboardDesdeCard('${p.id}', ${idx})"
                             style="cursor:pointer; border: 1px solid ${isCompleta ? '#4caf50' : '#555'}; 
                                    padding: 4px 6px; border-radius: 4px; background: rgba(255,255,255,0.05);
                                    min-width: 40px; text-align: center;">
                            <div style="font-size:0.65rem; font-weight:bold;">${colorAbr}${carta.numero || ''}</div>
                            <div style="display:flex; gap:2px; justify-content:center; margin-top:2px;">
                                ${[1, 2, 3].map(i => `
                                    <span style="
                                        display:inline-block;
                                        width:12px;
                                        height:12px;
                                        border-radius:2px;
                                        background: ${i <= progreso ? '#4caf50' : 'rgba(255,255,255,0.2)'};
                                        border: 1px solid ${i <= progreso ? '#4caf50' : 'rgba(255,255,255,0.1)'};
                                        font-size:6px;
                                        text-align:center;
                                        color:${i <= progreso ? 'white' : 'transparent'};
                                    ">${i <= progreso ? '✓' : ''}</span>
                                `).join('')}
                            </div>
                            <div style="font-size:0.5rem; color:${isCompleta ? '#ffd700' : '#888'}; margin-top:1px;">
                                ${isCompleta ? '⭐' + puntaje : progreso + '/3'}
                            </div>
                        </div>
                    `;
                } else {
                    cartasHtml += '<span class="mini-carta vacia">-</span>';
                }
            });
        }
        cartasHtml += '</div>';

        card.innerHTML = `
            <div class="player-card-header">
                <span>${p.name}${isMe ? ' (Tu)' : ''}</span>
                <span>${p.score || 0} pts</span>
            </div>
            <div class="mini-info">
                <span>Mazo: ${p.mazoColores ? p.mazoColores.length : 0}</span>
                <span>${p.cartasRepartidas ? 'Repartido' : 'Esperando'}</span>
            </div>
            ${cartasHtml}
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