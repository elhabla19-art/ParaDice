// ============================================
// LÓGICA DEL JUEGO
// ============================================

import { COLORES, state, PUNTAJES, TICKETS, HABILIDADES } from './config-state.js';
import { mostrarMensaje } from './utils.js';
import { renderCartasVisibles, renderCartasJugador, updateVisuals, renderBoard } from './mazos-tablero.js';
import { cerrarZoom, actualizarZoomJugador } from './zoom.js';
import { broadcastScore, broadcastTablero, broadcastMazo, broadcastTickets } from './mqtt.js';
import { renderLeaderboard } from './leaderboard.js';
import { renderStatusPanel } from './main.js';

// ============================================
// FUNCIONES DE PUNTAJE Y HABILIDADES
// ============================================

export function getPuntajeCarta(carta) {
    if (!carta || !carta.color || !carta.numero) return 0;
    const puntajes = PUNTAJES[carta.color];
    if (!puntajes) return 0;
    return puntajes[carta.numero - 1] || 0;
}

export function getHabilidadCarta(carta) {
    if (!carta || !carta.color) return null;
    return HABILIDADES[carta.color] || null;
}

export function isHabilidadUsada(carta) {
    if (!carta || !carta.id) return true;
    return state.habilidadesUsadas[carta.id] === true;
}

// ============================================
// CONTAR HABILIDADES LIMA USADAS
// ============================================

export function contarHabilidadesLimaUsadas() {
    const cartasLima = state.cartasTerminadas.filter(c => c.color === 'lima');
    const usadas = cartasLima.filter(c => state.habilidadesUsadas[c.id] === true);
    return usadas.length;
}

export function contarCartasEspecialesUsadas() {
    return state.cartasEspecialesUsadas || 0;
}

// ============================================
// VERIFICAR SI MAZO ESPECIAL ESTÁ DISPONIBLE
// ============================================

export function isMazoEspecialDisponible() {
    const habilidadesLima = contarHabilidadesLimaUsadas();
    const especialesUsadas = contarCartasEspecialesUsadas();
    const disponibles = habilidadesLima > especialesUsadas;
    return disponibles && state.mazoEspecialDisponible.length > 0;
}

// ============================================
// CONTAR CARTAS COMPLETADAS
// ============================================

function contarCartasCompletadasPorColor(jugadorId, color) {
    const player = state.playersData[jugadorId];
    if (!player || !player.progresoCartas) return 0;
    
    let completadas = 0;
    for (let i = 1; i <= 9; i++) {
        const key = `${color}-${i}`;
        if (player.progresoCartas[key] === 3) {
            completadas++;
        }
    }
    return completadas;
}

export function getCartasCompletadasPorColor(jugadorId, color) {
    const player = state.playersData[jugadorId];
    if (!player || !player.progresoCartas) return [];
    
    const completadas = [];
    for (let i = 1; i <= 9; i++) {
        const key = `${color}-${i}`;
        if (player.progresoCartas[key] === 3) {
            completadas.push(i);
        }
    }
    return completadas;
}

// ============================================
// TICKETS
// ============================================

function verificarTicketsColor() {
    COLORES.forEach(color => {
        let maxCartas = 0;
        let duenio = null;
        let empate = false;
        
        Object.keys(state.playersData).forEach(jugadorId => {
            const completadas = contarCartasCompletadasPorColor(jugadorId, color);
            if (completadas >= 2 && completadas > maxCartas) {
                maxCartas = completadas;
                duenio = jugadorId;
                empate = false;
            } else if (completadas >= 2 && completadas === maxCartas && maxCartas > 0) {
                empate = true;
            }
        });
        
        if (empate || maxCartas < 2) {
            if (state.tickets[color] !== null) {
                state.tickets[color] = null;
            }
        } else if (duenio !== null) {
            if (state.tickets[color] !== duenio) {
                const nombreJugador = state.playersData[duenio]?.name || 'Jugador';
                state.tickets[color] = duenio;
                mostrarMensaje(`Ticket ${TICKETS[color].nombre} obtenido por ${nombreJugador}`, 'success');
            }
        }
    });
}

function verificarTicketBonus(jugadorId) {
    if (state.bonusReclamado) return false;
    
    const player = state.playersData[jugadorId];
    if (!player || !player.progresoCartas) return false;
    
    let coloresCompletos = 0;
    COLORES.forEach(color => {
        for (let i = 1; i <= 9; i++) {
            const key = `${color}-${i}`;
            if (player.progresoCartas[key] === 3) {
                coloresCompletos++;
                break;
            }
        }
    });
    
    if (coloresCompletos >= 5) {
        state.bonusTicket = jugadorId;
        state.bonusReclamado = true;
        const nombreJugador = state.playersData[jugadorId]?.name || 'Jugador';
        mostrarMensaje(`Ticket BONUS (+${TICKETS.bonus.puntaje} pts) obtenido por ${nombreJugador}`, 'success');
        return true;
    }
    return false;
}

function actualizarPuntajesConTickets() {
    verificarTicketsColor();
    
    Object.keys(state.playersData).forEach(jugadorId => {
        let puntaje = 0;
        const player = state.playersData[jugadorId];
        if (!player || !player.progresoCartas) return;
        
        COLORES.forEach(color => {
            for (let i = 1; i <= 9; i++) {
                const key = `${color}-${i}`;
                if (player.progresoCartas[key] === 3) {
                    puntaje += PUNTAJES[color][i - 1] || 0;
                }
            }
        });
        
        COLORES.forEach(color => {
            if (state.tickets[color] === jugadorId) {
                puntaje += TICKETS[color].puntaje;
            }
        });
        
        if (state.bonusTicket === jugadorId) {
            puntaje += TICKETS.bonus.puntaje;
        }
        
        if (jugadorId === state.myId) {
            state.myTotalScore = puntaje;
        }
        player.score = puntaje;
    });
}

// ============================================
// COMPLETAR CARTA
// ============================================

export function completarCarta(carta, casillaNumero) {
    const key = `${carta.color}-${carta.numero}`;
    if (!state.progresoCarta[key]) {
        state.progresoCarta[key] = 0;
    }
    
    if (casillaNumero === state.progresoCarta[key] + 1) {
        state.progresoCarta[key]++;
        const nuevoProgreso = state.progresoCarta[key];
        
        if (nuevoProgreso === 3) {
            // Avanzar ficha
            if (!state.fichas[carta.color]) {
                state.fichas[carta.color] = 0;
            }
            if (state.fichas[carta.color] < 5) {
                state.fichas[carta.color]++;
            }
            
            // MOVER CARTA A TERMINADAS
            const cartaIndex = state.cartasJugador.findIndex(c => c && c.id === carta.id);
            if (cartaIndex !== -1) {
                state.cartasJugador[cartaIndex] = null;
                state.cartasTerminadas.push(carta);
                state.habilidadesUsadas[carta.id] = false;
            }
            
            const puntaje = getPuntajeCarta(carta);
            mostrarMensaje(`Carta ${carta.color} N°${carta.numero} completada! (+${puntaje} pts)`, 'success');
            
            const completadasColor = contarCartasCompletadasPorColor(state.myId, carta.color);
            if (completadasColor >= 2) {
                verificarTicketsColor();
            }
            verificarTicketBonus(state.myId);
            actualizarPuntajesConTickets();
            
            if (state.currentRoom) {
                broadcastTickets();
                broadcastTablero();
            }
            
            // Cerrar zoom SOLO cuando se completa la carta
            cerrarZoom();
        } else {
            // Actualizar zoom sin cerrarlo
            actualizarZoomJugador(carta);
        }
        
        updateVisuals();
        renderCartasJugador();
        renderBoard();
        renderLeaderboard();
        renderStatusPanel();
        actualizarBotonEspecial();
        
        if (state.currentRoom) {
            broadcastScore('sync');
        }
    } else {
        mostrarMensaje(`Debes marcar en orden: primero ${state.progresoCarta[key] + 1}`, 'error');
    }
}

// ============================================
// ACTUALIZAR BOTÓN ESPECIAL
// ============================================

export function actualizarBotonEspecial() {
    const btn = document.querySelector('.btn-especial');
    if (!btn) return;
    
    if (isMazoEspecialDisponible()) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        const disponibles = contarHabilidadesLimaUsadas() - contarCartasEspecialesUsadas();
        btn.title = `Cartas Especiales disponibles: ${disponibles}`;
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
        const habLima = contarHabilidadesLimaUsadas();
        const espUsadas = contarCartasEspecialesUsadas();
        if (habLima === 0) {
            btn.title = 'Necesitas activar una habilidad Lima primero';
        } else if (espUsadas >= habLima) {
            btn.title = 'Ya usaste todas tus Cartas Especiales disponibles';
        } else {
            btn.title = 'No hay Cartas Especiales disponibles';
        }
    }
}

// ============================================
// AGREGAR CARTA VISIBLE A LA MANO
// ============================================

export function agregarCartaAJugador(indexVisible) {
    const carta = state.cartasVisibles[indexVisible];
    if (!carta) {
        mostrarMensaje('Esta casilla esta vacia', 'warning');
        return;
    }
    
    const emptyIndex = state.cartasJugador.findIndex(c => c === null);
    if (emptyIndex === -1) {
        mostrarMensaje('Mano llena (maximo 5 cartas). Completa una carta para liberar espacio.', 'warning');
        return;
    }
    
    state.cartasJugador[emptyIndex] = carta;
    state.cartasVisibles[indexVisible] = null;
    
    if (state.mazoColores.length > 0) {
        const nuevaCarta = state.mazoColores.pop();
        state.cartasVisibles[indexVisible] = nuevaCarta;
        mostrarMensaje(`Nueva carta visible: ${nuevaCarta.color} ${nuevaCarta.numero}`, 'info');
    } else {
        mostrarMensaje('No quedan cartas en el mazo', 'warning');
    }
    
    const key = `${carta.color}-${carta.numero}`;
    state.progresoCarta[key] = 0;
    
    cerrarZoom();
    renderCartasVisibles();
    renderCartasJugador();
    updateVisuals();
    
    if (state.currentRoom) {
        broadcastMazo();
        broadcastScore('sync');
    }
    
    mostrarMensaje(`Carta ${carta.color} ${carta.numero} agregada a tu mano`, 'success');
}

// ============================================
// USAR HABILIDAD
// ============================================

export function usarHabilidad(carta) {
    if (!carta) {
        mostrarMensaje('Carta no valida', 'error');
        return;
    }
    
    if (state.habilidadesUsadas[carta.id] === true) {
        mostrarMensaje('Esta carta ya uso su habilidad', 'warning');
        return;
    }
    
    const habilidad = getHabilidadCarta(carta);
    if (!habilidad) {
        mostrarMensaje('Esta carta no tiene habilidad especial', 'warning');
        return;
    }
    
    state.habilidadesUsadas[carta.id] = true;
    mostrarModalHabilidad(carta, habilidad);
    renderCartasJugador();
    renderStatusPanel();
    actualizarBotonEspecial();
    if (state.currentRoom) {
        broadcastScore('sync');
    }
}

function mostrarModalHabilidad(carta, habilidad) {
    const modal = document.getElementById('habilidadModal');
    const content = document.getElementById('habilidadContent');
    
    if (!modal || !content) return;
    
    const colorMap = {
        celeste: '#4fc3f7',
        lima: '#aed581',
        naranja: '#ffb74d',
        purpura: '#ce93d8',
        rosa: '#f06292'
    };
    const color = colorMap[carta.color] || '#888';
    
    // Contar cuántas habilidades Lima se han usado
    const habLima = contarHabilidadesLimaUsadas();
    const espUsadas = contarCartasEspecialesUsadas();
    const disponibles = habLima - espUsadas;
    
    let infoExtra = '';
    if (carta.color === 'lima') {
        infoExtra = `
            <div style="margin-top: 8px; padding: 6px; background: rgba(255,215,0,0.1); border-radius: 4px; border: 1px solid #ffd70033;">
                <span style="color: #ffd700; font-size: 0.75rem;">Cartas Especiales disponibles: ${disponibles}</span>
            </div>
        `;
    }
    
    content.innerHTML = `
        <div style="text-align: center; padding: 10px;">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">${habilidad.icono}</div>
            <h2 style="color: ${color}; margin-bottom: 6px; font-size: 1.3rem;">${habilidad.nombre}</h2>
            <p style="color: #ccc; margin-bottom: 12px; font-size: 0.95rem;">${habilidad.descripcion}</p>
            <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; margin-bottom: 12px; border: 1px solid ${color}33;">
                <span style="color: #888; font-size: 0.7rem;">Carta: </span>
                <span style="color: white; font-weight: bold;">${carta.color} ${carta.numero}</span>
            </div>
            ${infoExtra}
            <button onclick="window.cerrarHabilidad()" 
                    style="background: ${color}; color: #121212; border: none; padding: 8px 25px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; cursor: pointer; transition: all 0.2s;">
                Entendido
            </button>
        </div>
    `;
    
    modal.style.display = 'flex';
}

export function cerrarHabilidad() {
    const modal = document.getElementById('habilidadModal');
    if (modal) modal.style.display = 'none';
}

// ============================================
// MAZO ESPECIAL
// ============================================

export function usarCartaEspecial() {
    if (!isMazoEspecialDisponible()) {
        const habLima = contarHabilidadesLimaUsadas();
        const espUsadas = contarCartasEspecialesUsadas();
        if (habLima === 0) {
            mostrarMensaje('Necesitas activar una habilidad Lima primero', 'warning');
        } else if (espUsadas >= habLima) {
            mostrarMensaje('Ya usaste todas tus Cartas Especiales disponibles', 'warning');
        } else {
            mostrarMensaje('No hay Cartas Especiales disponibles', 'warning');
        }
        return;
    }
    
    if (state.mazoEspecialDisponible.length === 0) {
        mostrarMensaje('No hay cartas especiales disponibles', 'warning');
        return;
    }
    
    const carta = state.mazoEspecialDisponible.pop();
    state.cartaEspecialActual = carta;
    
    mostrarCartaEspecial(carta);
}

function mostrarCartaEspecial(carta) {
    const modal = document.getElementById('especialModal');
    const content = document.getElementById('especialContent');
    
    if (!modal || !content) return;
    
    const numCarta = carta.id.split('-')[1];
    const imagenPath = `Imagenes/Especial/Especial${numCarta}.png`;
    
    const efectosInternos = ['puntos', 'mover_ficha', 'recuperar_habilidad'];
    const esEfectoInterno = efectosInternos.includes(carta.tipo);
    
    // Mostrar cuántas especiales quedan
    const habLima = contarHabilidadesLimaUsadas();
    const espUsadas = contarCartasEspecialesUsadas() + 1;
    const restantes = habLima - espUsadas;
    
    content.innerHTML = `
        <div style="text-align: center; padding: 10px;">
            <div style="font-size: 2rem; margin-bottom: 5px;">${carta.icono || '🃏'}</div>
            <img src="${imagenPath}" alt="Carta Especial ${numCarta}" 
                 style="max-width: 200px; max-height: 280px; border-radius: 8px; margin: 10px auto; display: block;"
                 onerror="this.style.display='none'; this.parentElement.querySelector('.fallback-text').style.display='block';">
            <div class="fallback-text" style="display: none; color: #888; font-size: 0.9rem; padding: 20px;">
                ${carta.descripcion}
            </div>
            <div style="margin-top: 10px; color: #aaa; font-size: 0.85rem;">
                ${carta.descripcion}
            </div>
            <div style="margin-top: 4px; color: #ffd700; font-size: 0.7rem;">
                ⭐ Restantes: ${restantes}
            </div>
            ${esEfectoInterno ? `
                <button onclick="window.ejecutarEfectoEspecial()" 
                        style="margin-top: 12px; background: #4caf50; border: none; color: white; padding: 8px 25px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; cursor: pointer; transition: all 0.2s;">
                    Usar Efecto
                </button>
            ` : `
                <div style="margin-top: 12px; color: #ffd700; font-size: 0.85rem;">
                    ⚡ Efecto automático
                </div>
                <button onclick="window.ejecutarEfectoEspecial()" 
                        style="margin-top: 8px; background: #ff9800; border: none; color: white; padding: 8px 25px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; cursor: pointer; transition: all 0.2s;">
                    Continuar
                </button>
            `}
        </div>
    `;
    
    modal.style.display = 'flex';
}

// ============================================
// EJECUTAR EFECTO ESPECIAL
// ============================================

export function ejecutarEfectoEspecial() {
    const carta = state.cartaEspecialActual;
    if (!carta) return;
    
    // Marcar que se usó una carta especial
    if (!state.cartasEspecialesUsadas) {
        state.cartasEspecialesUsadas = 0;
    }
    state.cartasEspecialesUsadas++;
    
    cerrarEspecial();
    
    switch(carta.tipo) {
        case 'puntos':
            ejecutarPuntos(carta.puntos);
            break;
        case 'mover_ficha':
            ejecutarMoverFicha();
            break;
        case 'recuperar_habilidad':
            ejecutarRecuperarHabilidad();
            break;
        case 'turno_extra':
            mostrarMensaje('⏭️ Turno Extra - Se desarrolla fuera de la página', 'info');
            break;
        case 'tomar_dado':
            mostrarMensaje('🎲 Tomar Dado - Se desarrolla fuera de la página', 'info');
            break;
        default:
            mostrarMensaje('Efecto de carta especial no implementado', 'warning');
    }
    
    state.cartaEspecialActual = null;
    actualizarBotonEspecial();
    updateVisuals();
    renderBoard();
    renderStatusPanel();
    
    if (state.currentRoom) {
        broadcastScore('sync');
        broadcastTablero();
    }
}

// ============================================
// EJECUTAR: PUNTOS
// ============================================

function ejecutarPuntos(puntos) {
    // Mostrar mensaje con el puntaje extra
    mostrarMensaje(`✨ +${puntos} puntos extra!`, 'success');
    
    // Actualizar puntaje total del jugador
    state.myTotalScore += puntos;
    
    // Actualizar el score en playersData
    if (state.currentRoom) {
        state.playersData[state.myId].score = state.myTotalScore;
    }
    
    // Actualizar visuales
    calculateScores();
    renderCartasJugador();
    renderLeaderboard();
    renderStatusPanel();
    
    // Broadcast si está en sala
    if (state.currentRoom) {
        broadcastScore('sync');
    }
}

// ============================================
// EJECUTAR: MOVER FICHA
// ============================================

function ejecutarMoverFicha() {
    state.modoEspecial = 'mover_ficha';
    
    const modal = document.getElementById('especialModal');
    const content = document.getElementById('especialContent');
    
    if (!modal || !content) return;
    
    let buttonsHtml = '<div style="display:flex; flex-direction:column; gap:6px; margin-top:10px;">';
    COLORES.forEach(color => {
        const colorHex = {
            celeste: '#4fc3f7',
            lima: '#aed581',
            naranja: '#ffb74d',
            purpura: '#ce93d8',
            rosa: '#f06292'
        }[color] || '#888';
        const fichaPos = state.fichas[color] || 0;
        const puedeAdelante = fichaPos < 5;
        const puedeAtras = fichaPos > 0;
        
        buttonsHtml += `
            <div style="display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.05); padding:6px 10px; border-radius:4px; border:1px solid ${colorHex}44;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${colorHex};"></span>
                <span style="flex:1; color:#fff; font-weight:bold; text-transform:capitalize; font-size:0.85rem;">${color}</span>
                <span style="color:#888; font-size:0.65rem;">${fichaPos + 1}/6</span>
                <button onclick="window.moverFicha('${color}', -1)" ${!puedeAtras ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''} 
                        style="background:#ff6b6b; border:none; color:white; padding:2px 10px; border-radius:3px; cursor:pointer; font-weight:bold; font-size:0.8rem;">
                    ◄
                </button>
                <button onclick="window.moverFicha('${color}', 1)" ${!puedeAdelante ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}
                        style="background:#4caf50; border:none; color:white; padding:2px 10px; border-radius:3px; cursor:pointer; font-weight:bold; font-size:0.8rem;">
                    ►
                </button>
            </div>
        `;
    });
    buttonsHtml += '</div>';
    buttonsHtml += `
        <div style="margin-top:10px; text-align:center;">
            <button onclick="window.cerrarEspecial(); state.modoEspecial=null;" style="background:#555; border:none; color:white; padding:4px 16px; border-radius:4px; cursor:pointer; font-size:0.75rem;">
                Cancelar
            </button>
        </div>
    `;
    
    content.innerHTML = `
        <h3 style="color:#fff; margin-bottom:4px; font-size:1.1rem;">↕️ Mover Ficha</h3>
        <p style="color:#aaa; font-size:0.8rem; margin-bottom:8px;">Elige un color y dirección para mover la ficha</p>
        ${buttonsHtml}
    `;
    
    modal.style.display = 'flex';
}

export function moverFicha(color, direccion) {
    const fichaPos = state.fichas[color] || 0;
    const nuevaPos = fichaPos + direccion;
    
    if (nuevaPos < 0 || nuevaPos > 5) {
        mostrarMensaje('No puedes mover la ficha más allá de los límites', 'warning');
        return;
    }
    
    state.fichas[color] = nuevaPos;
    mostrarMensaje(`Ficha de ${color} movida a casilla ${nuevaPos + 1}`, 'success');
    
    cerrarEspecial();
    state.modoEspecial = null;
    renderBoard();
    updateVisuals();
    renderStatusPanel();
    
    if (state.currentRoom) {
        broadcastTablero();
        broadcastScore('sync');
    }
}

// ============================================
// EJECUTAR: RECUPERAR HABILIDAD
// ============================================

function ejecutarRecuperarHabilidad() {
    state.modoEspecial = 'recuperar_habilidad';
    
    const cartasConHabilidadUsada = state.cartasTerminadas.filter(c => 
        state.habilidadesUsadas[c.id] === true && HABILIDADES[c.color]
    );
    
    if (cartasConHabilidadUsada.length === 0) {
        mostrarMensaje('No hay habilidades usadas para recuperar', 'warning');
        state.modoEspecial = null;
        return;
    }
    
    const modal = document.getElementById('especialModal');
    const content = document.getElementById('especialContent');
    
    if (!modal || !content) return;
    
    let buttonsHtml = '<div style="display:flex; flex-direction:column; gap:4px; margin-top:8px;">';
    cartasConHabilidadUsada.forEach(carta => {
        const habilidad = HABILIDADES[carta.color];
        const colorHex = {
            celeste: '#4fc3f7',
            lima: '#aed581',
            naranja: '#ffb74d',
            purpura: '#ce93d8',
            rosa: '#f06292'
        }[carta.color] || '#888';
        
        buttonsHtml += `
            <button onclick="window.recuperarHabilidad('${carta.id}')" 
                    style="background:${colorHex}22; border:1px solid ${colorHex}; color:#fff; padding:6px 10px; border-radius:4px; cursor:pointer; text-align:left; display:flex; align-items:center; gap:8px; font-size:0.85rem;">
                <span style="font-size:1rem;">${habilidad.icono}</span>
                <span>${carta.color} ${carta.numero} - ${habilidad.nombre}</span>
            </button>
        `;
    });
    buttonsHtml += '</div>';
    buttonsHtml += `
        <div style="margin-top:10px; text-align:center;">
            <button onclick="window.cerrarEspecial(); state.modoEspecial=null;" style="background:#555; border:none; color:white; padding:4px 16px; border-radius:4px; cursor:pointer; font-size:0.75rem;">
                Cancelar
            </button>
        </div>
    `;
    
    content.innerHTML = `
        <h3 style="color:#fff; margin-bottom:4px; font-size:1.1rem;">🔄 Recuperar Habilidad</h3>
        <p style="color:#aaa; font-size:0.8rem; margin-bottom:8px;">Selecciona una habilidad usada para recuperarla</p>
        ${buttonsHtml}
    `;
    
    modal.style.display = 'flex';
}

export function recuperarHabilidad(cartaId) {
    const carta = state.cartasTerminadas.find(c => c.id === cartaId);
    if (!carta) {
        mostrarMensaje('Carta no encontrada', 'error');
        return;
    }
    
    if (state.habilidadesUsadas[carta.id] !== true) {
        mostrarMensaje('Esta habilidad no está usada', 'warning');
        return;
    }
    
    state.habilidadesUsadas[carta.id] = false;
    const habilidad = HABILIDADES[carta.color];
    mostrarMensaje(`✅ Habilidad ${habilidad.nombre} recuperada para ${carta.color} ${carta.numero}`, 'success');
    
    cerrarEspecial();
    state.modoEspecial = null;
    renderCartasJugador();
    renderStatusPanel();
    actualizarBotonEspecial();
    
    if (state.currentRoom) {
        broadcastScore('sync');
    }
}

export function cerrarEspecial() {
    const modal = document.getElementById('especialModal');
    if (modal) modal.style.display = 'none';
    state.modoEspecial = null;
}

// ============================================
// CALCULAR PUNTAJE
// ============================================

export function calculateScores() {
    // 1. Calcular puntaje de cartas de color (sin extras)
    if (Object.keys(state.playersData).length > 0) {
        actualizarPuntajesConTickets();
    }
    
    // 2. Asegurar que el puntaje total incluya los extras de especiales
    const playerData = state.playersData[state.myId];
    if (playerData) {
        state.myTotalScore = playerData.score || 0;
    }
    
    // 3. Actualizar UI
    const scoreTotal = document.getElementById('score-total');
    if (scoreTotal) {
        scoreTotal.textContent = state.myTotalScore;
    }
    
    const mazoRestantes = document.getElementById('mazo-restantes');
    if (mazoRestantes) {
        mazoRestantes.textContent = state.mazoColores.length;
    }
    
    const mazoEspecialRestantes = document.getElementById('mazo-especial-restantes');
    if (mazoEspecialRestantes) {
        mazoEspecialRestantes.textContent = state.mazoEspecialDisponible.length;
    }

    const cartasInfo = document.getElementById('cartas-info');
    if (cartasInfo) {
        const manoCount = state.cartasJugador.filter(c => c !== null).length;
        cartasInfo.textContent = `Mano: ${manoCount}/5 | Terminadas: ${state.cartasTerminadas.length}`;
    }

    // 4. Actualizar playersData con el puntaje correcto
    if (state.currentRoom) {
        state.playersData[state.myId] = {
            name: state.myName,
            score: state.myTotalScore,
            cartasJugador: state.cartasJugador,
            cartasTerminadas: state.cartasTerminadas,
            habilidadesUsadas: state.habilidadesUsadas,
            mazoColores: state.mazoColores,
            mazoEspecialDisponible: state.mazoEspecialDisponible,
            cartasVisibles: state.cartasVisibles,
            cartasRepartidas: state.cartasRepartidas,
            tablero: state.tableroGlobal,
            fichas: state.fichas,
            progresoCartas: state.progresoCarta,
            cartasEspecialesUsadas: state.cartasEspecialesUsadas || 0
        };
    }
}

// ============================================
// REPARTIR CARTAS
// ============================================

export function repartirCartas() {
    if (state.cartasRepartidas) {
        mostrarMensaje('Ya se repartieron las cartas', 'warning');
        return;
    }
    
    if (state.mazoColores.length < 4) {
        mostrarMensaje('No hay suficientes cartas en el mazo (minimo 4)', 'error');
        return;
    }
    
    state.cartasJugador = Array(5).fill(null);
    state.cartasTerminadas = [];
    state.cartasVisibles = Array(4).fill(null);
    state.progresoCarta = {};
    state.habilidadesUsadas = {};
    state.cartasEspecialesUsadas = 0;
    
    for (let i = 0; i < 4; i++) {
        if (state.mazoColores.length > 0) {
            state.cartasVisibles[i] = state.mazoColores.pop();
        }
    }
    
    state.cartasRepartidas = true;
    
    COLORES.forEach(color => {
        state.tableroGlobal[color] = Array(6).fill(false);
        state.fichas[color] = 0;
        state.tickets[color] = null;
    });
    state.bonusTicket = null;
    state.bonusReclamado = false;
    state.myTotalScore = 0;
    
    renderCartasVisibles();
    renderCartasJugador();
    updateVisuals();
    renderBoard();
    calculateScores();
    renderStatusPanel();
    actualizarBotonEspecial();
    
    if (state.currentRoom) {
        broadcastMazo();
        broadcastTablero();
        broadcastTickets();
        broadcastScore('repartir');
    }
    
    console.log(`Cartas visibles mostradas. Quedan ${state.mazoColores.length} cartas en el mazo`);
    mostrarMensaje(`4 cartas visibles disponibles. Quedan ${state.mazoColores.length} en el mazo`, 'info');
}

// ============================================
// REINICIAR Y LIMPIAR
// ============================================

export function reiniciarTablero() {
    COLORES.forEach(color => {
        state.tableroGlobal[color] = Array(6).fill(false);
        state.fichas[color] = 0;
        state.tickets[color] = null;
    });
    state.bonusTicket = null;
    state.bonusReclamado = false;
    state.progresoCarta = {};
    state.cartasTerminadas = [];
    state.habilidadesUsadas = {};
    state.cartasJugador = Array(5).fill(null);
    state.cartasEspecialesUsadas = 0;
    state.myTotalScore = 0;
    updateVisuals();
    calculateScores();
    renderCartasJugador();
    renderBoard();
    renderStatusPanel();
    actualizarBotonEspecial();
    if (state.currentRoom) {
        broadcastTablero();
        broadcastTickets();
    }
    mostrarMensaje('Tablero reiniciado', 'info');
}

export function limpiarMano() {
    state.cartasJugador = Array(5).fill(null);
    renderCartasJugador();
    if (state.currentRoom) {
        broadcastScore('sync');
    }
    mostrarMensaje('Mano limpiada', 'info');
}