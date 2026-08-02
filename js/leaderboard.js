// ============================================
// LEADERBOARD - LISTA DE JUGADORES
// ============================================

import { COLORES, state, TICKETS, PUNTAJES } from './config-state.js';
import { abrirZoomLeaderboard } from './zoom.js';
import { getCartasCompletadasPorColor } from './juego.js';
import { broadcastScore, broadcastTablero, broadcastTickets, broadcastMazo, forzarRestauracionLocal } from './mqtt.js';
import { calculateScores } from './juego.js';
import { renderBoard, updateVisuals, renderCartasVisibles, renderCartasJugador } from './mazos-tablero.js';
import { renderStatusPanel } from './panel.js';
import { mostrarMensaje } from './utils.js';
import { abrirCompletasDeJugador } from './completas.js';

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
                    Bonus (+${TICKETS.bonus.puntaje}pts)
                </span>
            `;
        }
        
        // ----- PUNTOS EXTRA DE CARTAS ESPECIALES -----
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
        
        if (!tieneTickets) {
            ticketsHtml += '<span class="mini-ticket vacio">Sin tickets</span>';
        }
        ticketsHtml += '</div>';
        
        // ----- CARTAS EN MANO (5 cuadros con casillas - CLICKEABLES) -----
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
            
            // Obtener progreso de la carta usando el nuevo formato
            let progresoData = { marcadas: [], completada: false };
            if (carta) {
                const key = `${carta.color}-${carta.numero}`;
                progresoData = pProgreso[key] || { marcadas: [], completada: false };
            }
            const marcadas = progresoData.marcadas || [];
            
            const tieneCarta = carta !== null;
            const esClickeable = tieneCarta && p.id !== state.myId;
            
            cartasHtml += `
                <div class="mini-carta-mano" 
                     style="background: ${tieneCarta ? colorHex + '22' : '#2a2a2a'}; border: 2px solid ${tieneCarta ? colorHex : '#444'}; ${esClickeable ? 'cursor: pointer;' : ''}"
                     onclick="${esClickeable ? `window.abrirZoomLeaderboardDesdeCard('${p.id}', ${i})` : ''}">
                    <div class="mini-carta-casillas">
                        ${[1, 2, 3].map(j => {
                            const estaMarcada = marcadas.includes(j);
                            return `
                                <span class="mini-casilla ${(tieneCarta && estaMarcada) ? 'llena' : ''}"></span>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        cartasHtml += '</div>';
        
        // ----- TAGS DE COLORES EN UNA LÍNEA CON "TODAS" AL FINAL -----
        let statsHtml = '<div class="player-stats-line">';
        let totalCartas = 0;
        
        const coloresMeta = state.coloresMeta || [];
        const primerColor = coloresMeta[0] || null;
        const resultadosFinales = state.resultadosFinales || {};
        
        COLORES.forEach(color => {
            const completadas = getCartasCompletadasPorColor(p.id, color);
            const total = completadas.length;
            
            // Calcular puntaje base de este color (SOLO CARTAS, sin tickets)
            let puntajeBase = 0;
            completadas.forEach(num => {
                puntajeBase += PUNTAJES[color][num - 1] || 0;
            });
            
            // Determinar puntaje a mostrar (SOLO CARTAS, sin tickets)
            let puntajeMostrar = puntajeBase;
            let decoracion = '';
            
            // Verificar si hay resultados finales (segundo color en meta)
            if (resultadosFinales[color]) {
                const data = resultadosFinales[color];
                if (data.esPrimero) {
                    // Primer color en meta -> 0 pts (solo tachado)
                    puntajeMostrar = 0;
                    decoracion = 'text-decoration: line-through;';
                } else if (data.esDoble) {
                    // Color más atrás -> x2 (SOLO CARTAS, sin ticket)
                    puntajeMostrar = puntajeBase * 2;
                } else {
                    // Resto -> normal (SOLO CARTAS)
                    puntajeMostrar = puntajeBase;
                }
            } else if (color === primerColor) {
                // Primer color en meta -> 0 pts (solo tachado)
                puntajeMostrar = 0;
                decoracion = 'text-decoration: line-through;';
            }
            
            totalCartas += puntajeMostrar;
            
            // Color HEX original (sin cambios)
            const colorHex = {
                celeste: '#4fc3f7',
                lima: '#aed581',
                naranja: '#ffb74d',
                purpura: '#ce93d8',
                rosa: '#f06292'
            }[color] || '#666';
            
            // Contar habilidades disponibles
            const cartasTerminadas = p.cartasTerminadas || [];
            const cartasColor = cartasTerminadas.filter(c => c.color === color);
            const disponibles = cartasColor.filter(c => {
                const usada = p.habilidadesUsadas ? p.habilidadesUsadas[c.id] : true;
                return !usada;
            });
            
            statsHtml += `
                <span class="stat-color" style="color: ${colorHex}; ${decoracion} cursor: pointer;" 
                      onclick="window.abrirCompletasDeJugador('${p.id}', '${color}')"
                      title="Ver completas de ${color}">
                    ● ${total} (${puntajeMostrar}pts) ${disponibles.length}h
                </span>
            `;
        });
        
        // Tag "Todas" en gris al final
        statsHtml += `
            <span class="stat-todas" style="color: #888;">
                Todas: ${totalCartas}pts
            </span>
        `;
        statsHtml += '</div>';

        // ----- PUNTAJE TOTAL -----
        // Calcular manualmente: Todas + Tickets + Extras
        let totalTickets = 0;
        COLORES.forEach(color => {
            if (state.tickets[color] === p.id) {
                totalTickets += TICKETS[color].puntaje || 0;
            }
        });
        if (state.bonusTicket === p.id) {
            totalTickets += TICKETS.bonus.puntaje || 0;
        }

        let totalExtras = 0;
        if (p.puntosEspeciales && p.puntosEspeciales.length > 0) {
            totalExtras = p.puntosEspeciales.reduce((sum, pts) => sum + pts, 0);
        }

        const puntajeTotal = totalCartas + totalTickets + totalExtras;

        card.innerHTML = `
            <div class="player-card-header">
                <span>${p.name}${isMe ? ' (Tu)' : ''}</span>
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

// ============================================
// REFRESCAR SINCRONIZACION (MEJORADO)
// ============================================

export function refrescarSincronizacion() {
    // Mostrar feedback visual
    const btn = document.getElementById('btnRefrescar');
    if (btn) btn.classList.add('refrescando');
    
    // Si está en sala
    if (state.currentRoom) {
        // PRIMERO: Intentar restaurar estado local desde playersData
        const restaurado = forzarRestauracionLocal();
        
        if (restaurado) {
            // Si se restauraron datos, enviar broadcast para sincronizar
            setTimeout(() => {
                broadcastScore('sync');
                broadcastTablero();
                broadcastTickets();
                broadcastMazo();
                
                // Refrescar toda la UI
                renderBoard();
                updateVisuals();
                renderCartasVisibles();
                renderCartasJugador();
                renderStatusPanel();
                renderLeaderboard();
                calculateScores();
                
                setTimeout(() => {
                    if (btn) btn.classList.remove('refrescando');
                }, 600);
                
                mostrarMensaje('🔄 Estado restaurado y sincronizado', 'success');
            }, 300);
        } else {
            // Si no hay datos para restaurar, hacer sincronización normal
            broadcastScore('sync');
            broadcastTablero();
            broadcastTickets();
            broadcastMazo();
            
            // Recalcular puntajes locales
            calculateScores();
            
            // Refrescar toda la UI
            renderBoard();
            updateVisuals();
            renderCartasVisibles();
            renderCartasJugador();
            renderStatusPanel();
            renderLeaderboard();
            
            setTimeout(() => {
                if (btn) btn.classList.remove('refrescando');
            }, 600);
            
            mostrarMensaje('Sincronización completada', 'info');
        }
    } else {
        // Modo solo: solo refrescar UI local
        calculateScores();
        renderBoard();
        updateVisuals();
        renderCartasVisibles();
        renderCartasJugador();
        renderStatusPanel();
        renderLeaderboard();
        
        setTimeout(() => {
            if (btn) btn.classList.remove('refrescando');
        }, 600);
        
        mostrarMensaje('Vista actualizada', 'info');
    }
}

// EXPONER FUNCIONES GLOBALES
window.abrirCompletasDeJugador = abrirCompletasDeJugador;
window.refrescarSincronizacion = refrescarSincronizacion;