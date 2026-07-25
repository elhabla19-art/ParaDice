// ============================================
// LÓGICA DEL JUEGO
// ============================================

import { COLORES, state, PUNTAJES, TICKETS, HABILIDADES, initState } from './config-state.js';
import { mostrarMensaje } from './utils.js';
import { renderCartasVisibles, renderCartasJugador, updateVisuals, renderBoard, generarMazos } from './mazos-tablero.js';
import { cerrarZoom, actualizarZoomJugador } from './zoom.js';
import { broadcastScore, broadcastTablero, broadcastMazo, broadcastTickets, broadcastJuegoTerminado } from './mqtt.js';
import { renderLeaderboard } from './leaderboard.js';
import { renderStatusPanel } from './panel.js';

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
        const data = player.progresoCartas[key];
        if (data && data.completada === true) {
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
        const data = player.progresoCartas[key];
        if (data && data.completada === true) {
            completadas.push(i);
        }
    }
    return completadas;
}

// ============================================
// OBTENER PUNTAJE DE CARTAS DE UN COLOR (sin tickets)
// ============================================

function getPuntajeCartasColor(jugadorId, color) {
    const player = state.playersData[jugadorId];
    if (!player || !player.progresoCartas) return 0;
    
    let puntaje = 0;
    for (let i = 1; i <= 9; i++) {
        const key = `${color}-${i}`;
        const data = player.progresoCartas[key];
        if (data && data.completada === true) {
            puntaje += PUNTAJES[color][i - 1] || 0;
        }
    }
    return puntaje;
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
    // Si ya se reclamó el bonus, no hacer nada
    if (state.bonusReclamado) return false;
    
    const player = state.playersData[jugadorId];
    if (!player || !player.progresoCartas) return false;
    
    // Contar cuántos COLORES DIFERENTES tienen al menos 1 carta completada
    let coloresCompletos = 0;
    COLORES.forEach(color => {
        let tieneCartaCompletada = false;
        for (let i = 1; i <= 9; i++) {
            const key = `${color}-${i}`;
            const data = player.progresoCartas[key];
            if (data && data.completada === true) {
                tieneCartaCompletada = true;
                break; // Solo necesitamos saber si tiene al menos 1 carta de este color
            }
        }
        if (tieneCartaCompletada) {
            coloresCompletos++;
        }
    });
    
    // Necesita los 5 colores para obtener el bonus
    if (coloresCompletos >= 5) {
        state.bonusTicket = jugadorId;
        state.bonusReclamado = true;
        const nombreJugador = state.playersData[jugadorId]?.name || 'Jugador';
        mostrarMensaje(`🎟️ Ticket BONUS (+${TICKETS.bonus.puntaje} pts) obtenido por ${nombreJugador}`, 'success');
        
        // Broadcast inmediato
        if (state.currentRoom) {
            broadcastTickets();
        }
        
        // Recalcular scores
        calculateScores();
        renderLeaderboard();
        renderStatusPanel();
        
        return true;
    }
    return false;
}

function actualizarPuntajesConTickets() {
    verificarTicketsColor();
    
    const primerColor = state.coloresMeta?.[0] || null;
    
    Object.keys(state.playersData).forEach(jugadorId => {
        let puntaje = 0;
        const player = state.playersData[jugadorId];
        if (!player || !player.progresoCartas) return;
        
        // 1. Sumar puntajes de cartas
        COLORES.forEach(color => {
            for (let i = 1; i <= 9; i++) {
                const key = `${color}-${i}`;
                const data = player.progresoCartas[key];
                if (data && data.completada === true) {
                    if (color !== primerColor || !primerColor) {
                        puntaje += PUNTAJES[color][i - 1] || 0;
                    }
                }
            }
        });
        
        // 2. Sumar tickets de color
        COLORES.forEach(color => {
            if (state.tickets[color] === jugadorId) {
                puntaje += TICKETS[color].puntaje;
            }
        });
        
        // 3. BONUS TICKET - SOLO si el jugador es el dueño del bonus
        if (state.bonusTicket === jugadorId) {
            puntaje += TICKETS.bonus.puntaje;
        }
        
        // 4. Sumar puntos de cartas especiales
        if (player.puntosEspeciales && player.puntosEspeciales.length > 0) {
            const totalPuntosEspeciales = player.puntosEspeciales.reduce((sum, pts) => sum + pts, 0);
            puntaje += totalPuntosEspeciales;
        }
        
        if (jugadorId === state.myId) {
            state.myTotalScore = puntaje;
        }
        player.score = puntaje;
    });
}

// ============================================
// ACTUALIZAR PUNTAJES EN VIVO (CUANDO UN COLOR LLEGA A META)
// ============================================

function actualizarPuntajesEnVivo() {
    const playerData = state.playersData[state.myId];
    const primerColor = state.coloresMeta?.[0] || null;
    
    let puntajeTotal = 0;
    
    if (playerData && playerData.progresoCartas) {
        COLORES.forEach(color => {
            let puntajeColor = 0;
            for (let i = 1; i <= 9; i++) {
                const key = `${color}-${i}`;
                const data = playerData.progresoCartas[key];
                if (data && data.completada === true) {
                    puntajeColor += PUNTAJES[color][i - 1] || 0;
                }
            }
            if (color === primerColor) {
                puntajeColor = 0;
            }
            puntajeTotal += puntajeColor;
        });
        
        COLORES.forEach(color => {
            if (state.tickets[color] === state.myId) {
                puntajeTotal += TICKETS[color].puntaje;
            }
        });
        
        // BONUS TICKET
        if (state.bonusTicket === state.myId) {
            puntajeTotal += TICKETS.bonus.puntaje;
        }
        
        if (playerData.puntosEspeciales && playerData.puntosEspeciales.length > 0) {
            const totalEspeciales = playerData.puntosEspeciales.reduce((sum, pts) => sum + pts, 0);
            puntajeTotal += totalEspeciales;
        }
    }
    
    state.myTotalScore = puntajeTotal;
    if (playerData) {
        playerData.score = puntajeTotal;
    }
    
    renderStatusPanel();
    renderLeaderboard();
    
    const scoreTotal = document.getElementById('score-total');
    if (scoreTotal) {
        scoreTotal.textContent = state.myTotalScore;
    }
}

// ============================================
// ACTUALIZAR PUNTAJES CON DOBLE (CUANDO EL SEGUNDO COLOR LLEGA A META)
// ============================================

function actualizarPuntajesConDoble() {
    const playerData = state.playersData[state.myId];
    const coloresMeta = state.coloresMeta;
    const primerColor = coloresMeta[0];
    const segundoColor = coloresMeta[1];
    
    // Encontrar el color más atrás
    let colorMasAtras = null;
    let casillaMasBaja = Infinity;
    let coloresEnEmpate = [];
    
    COLORES.forEach(color => {
        if (coloresMeta.includes(color)) return;
        const posicion = state.fichas[color] || 0;
        if (posicion < casillaMasBaja) {
            casillaMasBaja = posicion;
            colorMasAtras = color;
            coloresEnEmpate = [color];
        } else if (posicion === casillaMasBaja) {
            coloresEnEmpate.push(color);
        }
    });
    
    if (coloresEnEmpate.length > 1) {
        let minCartas = Infinity;
        coloresEnEmpate.forEach(color => {
            const cartas = contarCartasCompletadasPorColor(state.myId, color);
            if (cartas < minCartas) {
                minCartas = cartas;
                colorMasAtras = color;
            }
        });
    }
    
    let puntajeTotal = 0;
    let puntajesPorColor = {};
    
    COLORES.forEach(color => {
        let puntajeCartas = 0;
        for (let i = 1; i <= 9; i++) {
            const key = `${color}-${i}`;
            const data = playerData?.progresoCartas?.[key];
            if (data && data.completada === true) {
                puntajeCartas += PUNTAJES[color][i - 1] || 0;
            }
        }
        
        let puntajeFinal = 0;
        let esPrimero = false;
        let esSegundo = false;
        let esDoble = false;
        
        if (color === primerColor) {
            puntajeFinal = 0;
            esPrimero = true;
        } else if (color === segundoColor) {
            puntajeFinal = puntajeCartas;
            esSegundo = true;
        } else if (color === colorMasAtras) {
            puntajeFinal = puntajeCartas * 2;
            esDoble = true;
        } else {
            puntajeFinal = puntajeCartas;
        }
        
        // SUMAR TICKET DE COLOR (si aplica)
        if (state.tickets[color] === state.myId) {
            puntajeFinal += TICKETS[color].puntaje;
        }
        
        puntajesPorColor[color] = {
            puntaje: puntajeFinal,
            puntajeCartas: puntajeCartas,
            esPrimero,
            esSegundo,
            esDoble
        };
        puntajeTotal += puntajeFinal;
    });
    
    // SUMAR BONUS TICKET
    if (state.bonusTicket === state.myId) {
        puntajeTotal += TICKETS.bonus.puntaje;
    }
    
    // Sumar puntos de cartas especiales
    if (playerData && playerData.puntosEspeciales && playerData.puntosEspeciales.length > 0) {
        const totalEspeciales = playerData.puntosEspeciales.reduce((sum, pts) => sum + pts, 0);
        puntajeTotal += totalEspeciales;
    }
    
    state.myTotalScore = puntajeTotal;
    if (playerData) {
        playerData.score = puntajeTotal;
    }
    
    state.resultadosFinales = puntajesPorColor;
    
    renderStatusPanel();
    renderLeaderboard();
    
    const scoreTotal = document.getElementById('score-total');
    if (scoreTotal) {
        scoreTotal.textContent = state.myTotalScore;
    }
}

// ============================================
// FINALIZAR JUEGO
// ============================================

export function finalizarJuego() {
    if (state.juegoTerminado) return;
    state.juegoTerminado = true;
    
    // Si no hay resultados finales calculados, calcularlos ahora
    if (Object.keys(state.resultadosFinales).length === 0) {
        const resultados = calcularPuntajesFinales();
        state.resultadosFinales = resultados;
    }
    
    // Asegurar que el score final esté actualizado
    let totalPuntaje = 0;
    COLORES.forEach(color => {
        totalPuntaje += state.resultadosFinales[color]?.puntaje || 0;
    });
    
    const playerData = state.playersData[state.myId];
    if (playerData && playerData.puntosEspeciales && playerData.puntosEspeciales.length > 0) {
        const totalEspeciales = playerData.puntosEspeciales.reduce((sum, pts) => sum + pts, 0);
        totalPuntaje += totalEspeciales;
    }
    
    state.myTotalScore = totalPuntaje;
    if (playerData) {
        playerData.score = totalPuntaje;
    }
    
    // Mostrar modal de podio
    mostrarPodio(state.resultadosFinales);
    
    // Broadcast si está en sala
    if (state.currentRoom) {
        broadcastJuegoTerminado(state.resultadosFinales);
    }
}

function calcularPuntajesFinales() {
    const resultados = {};
    const coloresMeta = state.coloresMeta;
    const primerColor = coloresMeta[0];
    const segundoColor = coloresMeta[1];
    
    // Encontrar el color más atrás (casilla más baja) entre los que NO llegaron a 6
    let colorMasAtras = null;
    let casillaMasBaja = Infinity;
    let coloresEnEmpate = [];
    
    COLORES.forEach(color => {
        if (coloresMeta.includes(color)) return; // Saltar colores que llegaron a 6
        
        const posicion = state.fichas[color] || 0;
        if (posicion < casillaMasBaja) {
            casillaMasBaja = posicion;
            colorMasAtras = color;
            coloresEnEmpate = [color];
        } else if (posicion === casillaMasBaja) {
            coloresEnEmpate.push(color);
        }
    });
    
    // Si hay empate en la casilla más baja, el que tiene menos cartas completadas gana el doble
    if (coloresEnEmpate.length > 1) {
        let minCartas = Infinity;
        coloresEnEmpate.forEach(color => {
            const cartas = contarCartasCompletadasPorColor(state.myId, color);
            if (cartas < minCartas) {
                minCartas = cartas;
                colorMasAtras = color;
            }
        });
        // Si hay empate en cartas también, se queda el primero (no debería pasar normalmente)
    }
    
    // Calcular puntajes para cada color
    COLORES.forEach(color => {
        const puntajeCartas = getPuntajeCartasColor(state.myId, color);
        const tieneTicket = state.tickets[color] === state.myId;
        const puntajeTicket = tieneTicket ? TICKETS[color].puntaje : 0;
        
        let puntajeFinal = 0;
        let esPrimero = false;
        let esSegundo = false;
        let esDoble = false;
        
        if (color === primerColor) {
            // Primer color en llegar a 6 → NO puntúa cartas, solo ticket
            puntajeFinal = puntajeTicket;
            esPrimero = true;
        } else if (color === segundoColor) {
            // Segundo color → puntaje normal
            puntajeFinal = puntajeCartas + puntajeTicket;
            esSegundo = true;
        } else if (color === colorMasAtras) {
            // Color más atrás → puntaje doble (solo cartas, no ticket)
            puntajeFinal = (puntajeCartas * 2) + puntajeTicket;
            esDoble = true;
        } else {
            // Resto → puntaje normal
            puntajeFinal = puntajeCartas + puntajeTicket;
        }
        
        resultados[color] = {
            puntaje: puntajeFinal,
            puntajeCartas: puntajeCartas,
            puntajeTicket: puntajeTicket,
            posicion: state.fichas[color] || 0,
            cartasCompletadas: contarCartasCompletadasPorColor(state.myId, color),
            esPrimero,
            esSegundo,
            esDoble,
            multiplicador: esDoble ? 2 : 1
        };
    });
    
    return resultados;
}

function mostrarPodio(resultados) {
    // Calcular puntaje total del jugador sumando todos los colores
    let totalPuntaje = 0;
    COLORES.forEach(color => {
        totalPuntaje += resultados[color]?.puntaje || 0;
    });
    
    // También sumar puntos de cartas especiales si no se incluyeron
    const playerData = state.playersData[state.myId];
    if (playerData && playerData.puntosEspeciales && playerData.puntosEspeciales.length > 0) {
        const totalEspeciales = playerData.puntosEspeciales.reduce((sum, pts) => sum + pts, 0);
        totalPuntaje += totalEspeciales;
    }
    
    // Actualizar score final
    state.myTotalScore = totalPuntaje;
    if (playerData) {
        playerData.score = totalPuntaje;
    }
    
    // Construir HTML del podio
    const modal = document.getElementById('podioModal');
    const content = document.getElementById('podioContent');
    if (!modal || !content) return;
    
    const colorHex = {
        celeste: '#4fc3f7',
        lima: '#aed581',
        naranja: '#ffb74d',
        purpura: '#ce93d8',
        rosa: '#f06292'
    };
    
    const colorNombre = {
        celeste: 'Celeste',
        lima: 'Lima',
        naranja: 'Naranja',
        purpura: 'Púrpura',
        rosa: 'Rosa'
    };
    
    // Ordenar colores por puntaje (mayor a menor)
    const coloresOrdenados = COLORES.slice().sort((a, b) => {
        return (resultados[b]?.puntaje || 0) - (resultados[a]?.puntaje || 0);
    });
    
    let html = `
        <div style="text-align: center; margin-bottom: 15px;">
            <div style="font-size: 2.5rem;">🏆</div>
            <h2 style="color: #ffd700; margin-bottom: 4px;">¡JUEGO TERMINADO!</h2>
            <p style="color: #aaa; font-size: 0.9rem;">Puntaje total: <strong style="color: #fff; font-size: 1.2rem;">${totalPuntaje} pts</strong></p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 15px;">
    `;
    
    coloresOrdenados.forEach((color, index) => {
        const data = resultados[color];
        const hex = colorHex[color] || '#888';
        const nombre = colorNombre[color] || color;
        const puntaje = data?.puntaje || 0;
        const posicion = data?.posicion || 0;
        const cartas = data?.cartasCompletadas || 0;
        
        let badge = '';
        if (data?.esPrimero) badge = '🥇 1º en meta (0pts cartas)';
        else if (data?.esSegundo) badge = '🥈 2º en meta';
        else if (data?.esDoble) badge = '⭐ ¡DOBLE! (más atrás)';
        
        html += `
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 6px; border-left: 3px solid ${hex};">
                <span style="font-size: 1.1rem;">${index + 1}</span>
                <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${hex};"></span>
                <span style="flex: 1; font-weight: bold; color: #fff; font-size: 0.9rem;">${nombre}</span>
                <span style="color: #888; font-size: 0.7rem;">Ficha: ${posicion + 1}/6 | Cartas: ${cartas}</span>
                ${badge ? `<span style="font-size: 0.65rem; color: #ffd700; background: rgba(255,215,0,0.15); padding: 2px 8px; border-radius: 10px;">${badge}</span>` : ''}
                <span style="font-weight: bold; color: #fff; font-size: 1rem; min-width: 40px; text-align: right;">${puntaje} pts</span>
            </div>
        `;
    });
    
    html += `
        </div>
        <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
            <button onclick="window.cerrarPodio()" 
                    style="background: #555; color: white; border: none; padding: 8px 30px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; cursor: pointer;">
                Cerrar
            </button>
        </div>
    `;
    
    content.innerHTML = html;
    modal.style.display = 'flex';
}

export function cerrarPodio() {
    const modal = document.getElementById('podioModal');
    if (modal) modal.style.display = 'none';
}

// ============================================
// COMPLETAR CARTA
// ============================================

export function completarCarta(carta, casillaNumero) {
    // Si el juego terminó, no permitir más acciones
    if (state.juegoTerminado) {
        mostrarMensaje('El juego ya terminó. Reinicia para jugar de nuevo.', 'warning');
        return;
    }
    
    const key = `${carta.color}-${carta.numero}`;
    
    // Inicializar como objeto con casillas marcadas
    if (!state.progresoCarta[key]) {
        state.progresoCarta[key] = { marcadas: [], completada: false };
    }
    
    const progreso = state.progresoCarta[key];
    
    // Verificar si la carta ya está completada
    if (progreso.completada) {
        mostrarMensaje(`Esta carta ya está completada`, 'warning');
        return;
    }
    
    // Verificar si esta casilla ya fue marcada
    if (progreso.marcadas.includes(casillaNumero)) {
        mostrarMensaje(`La casilla ${casillaNumero} ya está marcada`, 'warning');
        return;
    }
    
    // Marcar la casilla
    progreso.marcadas.push(casillaNumero);
    const totalMarcadas = progreso.marcadas.length;
    
    // Verificar si se completaron las 3 casillas
    if (totalMarcadas === 3) {
        progreso.completada = true;
        
        // Verificar si la ficha ya está en la meta (casilla 6)
        const posicionActual = state.fichas[carta.color] || 0;
        
        // Avanzar ficha SOLO si no está en la meta
        if (posicionActual < 5) {
            if (!state.fichas[carta.color]) {
                state.fichas[carta.color] = 0;
            }
            if (state.fichas[carta.color] < 5) {
                state.fichas[carta.color]++;
            }
            
            // Verificar si la ficha llegó a la meta (casilla 6)
            const nuevaPosicion = state.fichas[carta.color] || 0;
            if (nuevaPosicion === 5) { // 5 = casilla 6 (0-index)
                // Registrar el color en coloresMeta si no está ya
                if (!state.coloresMeta.includes(carta.color)) {
                    state.coloresMeta.push(carta.color);
                    
                    // Si es el PRIMER color en llegar a meta
                    if (state.coloresMeta.length === 1) {
                        mostrarMensaje(`🎉 ¡${carta.color} llegó a la META! (1/2)`, 'success');
                        mostrarMensaje(`⚠️ Las cartas de ${carta.color} ahora valen 0 pts (solo ticket)`, 'warning');
                        
                        // MOVER CARTA A TERMINADAS
                        const cartaIndex = state.cartasJugador.findIndex(c => c && c.id === carta.id);
                        if (cartaIndex !== -1) {
                            state.cartasJugador[cartaIndex] = null;
                            state.cartasTerminadas.push(carta);
                            state.habilidadesUsadas[carta.id] = false;
                        }
                        
                        // ACTUALIZAR PUNTAJES EN VIVO - Este color ahora vale 0
                        actualizarPuntajesEnVivo();
                        
                        // Broadcast para sincronizar con otros jugadores
                        if (state.currentRoom) {
                            broadcastScore('sync');
                            broadcastTablero();
                        }
                        
                        // Actualizar UI (sin llamar a calculateScores que sobrescribiría)
                        updateVisuals();
                        renderCartasJugador();
                        renderBoard();
                        renderLeaderboard();
                        renderStatusPanel();
                        actualizarBotonEspecial();
                        
                        // Cerrar zoom
                        cerrarZoom();
                        
                        return; // Salir para no ejecutar el resto
                        
                    } else if (state.coloresMeta.length === 2) {
                        mostrarMensaje(`🎉 ¡${carta.color} llegó a la META! (2/2) - Calculando resultados...`, 'success');
                        
                        // MOVER CARTA A TERMINADAS
                        const cartaIndex = state.cartasJugador.findIndex(c => c && c.id === carta.id);
                        if (cartaIndex !== -1) {
                            state.cartasJugador[cartaIndex] = null;
                            state.cartasTerminadas.push(carta);
                            state.habilidadesUsadas[carta.id] = false;
                        }
                        
                        // ACTUALIZAR PUNTAJES CON DOBLE (antes de mostrar el podio)
                        actualizarPuntajesConDoble();
                        
                        // Broadcast para sincronizar
                        if (state.currentRoom) {
                            broadcastScore('sync');
                            broadcastTablero();
                        }
                        
                        // Actualizar UI
                        updateVisuals();
                        renderCartasJugador();
                        renderBoard();
                        renderLeaderboard();
                        renderStatusPanel();
                        actualizarBotonEspecial();
                        cerrarZoom();
                        
                        // FINALIZAR EL JUEGO (mostrar podio) después de 800ms
                        setTimeout(() => {
                            finalizarJuego();
                        }, 800);
                        
                        return; // Salir para no ejecutar el resto
                    }
                }
            }
        } else {
            mostrarMensaje(`La ficha de ${carta.color} ya está en la META (no avanza más)`, 'info');
        }
        
        // MOVER CARTA A TERMINADAS (si no se movió en los casos anteriores)
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
}

// ============================================
// ACTUALIZAR BOTÓN ESPECIAL
// ============================================

export function actualizarBotonEspecial() {
    const btn = document.querySelector('.btn-especial');
    if (!btn) return;
    
    // Si el juego terminó, deshabilitar botón
    if (state.juegoTerminado) {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
        btn.title = 'El juego ha terminado';
        return;
    }
    
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
    // Si el juego terminó, no permitir más acciones
    if (state.juegoTerminado) {
        mostrarMensaje('El juego ya terminó. Reinicia para jugar de nuevo.', 'warning');
        return;
    }
    
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
    state.progresoCarta[key] = { marcadas: [], completada: false };
    
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
    if (state.juegoTerminado) {
        mostrarMensaje('El juego ya terminó.', 'warning');
        return;
    }
    
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
    if (state.juegoTerminado) {
        mostrarMensaje('El juego ya terminó.', 'warning');
        return;
    }
    
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
    if (state.juegoTerminado) {
        mostrarMensaje('El juego ya terminó.', 'warning');
        cerrarEspecial();
        return;
    }
    
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
    
    // Agregar el punto al array de puntosEspeciales del jugador
    if (!state.playersData[state.myId].puntosEspeciales) {
        state.playersData[state.myId].puntosEspeciales = [];
    }
    state.playersData[state.myId].puntosEspeciales.push(puntos);
    
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
        const enMeta = fichaPos >= 5; // Casilla 6 (0-index = 5)
        const puedeAdelante = fichaPos < 5;
        const puedeAtras = fichaPos > 0 && !enMeta; // No puede retroceder si está en meta
        
        buttonsHtml += `
            <div style="display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.05); padding:6px 10px; border-radius:4px; border:1px solid ${colorHex}44;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${colorHex};"></span>
                <span style="flex:1; color:#fff; font-weight:bold; text-transform:capitalize; font-size:0.85rem;">${color} ${enMeta ? '🏆 META' : ''}</span>
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
    if (state.juegoTerminado) {
        mostrarMensaje('El juego ya terminó.', 'warning');
        cerrarEspecial();
        return;
    }
    
    const fichaPos = state.fichas[color] || 0;
    const enMeta = fichaPos >= 5;
    const nuevaPos = fichaPos + direccion;
    
    // No permitir mover si está en meta
    if (enMeta) {
        mostrarMensaje(`La ficha de ${color} ya está en la META y no se puede mover`, 'warning');
        return;
    }
    
    if (nuevaPos < 0 || nuevaPos > 5) {
        mostrarMensaje('No puedes mover la ficha más allá de los límites', 'warning');
        return;
    }
    
    state.fichas[color] = nuevaPos;
    mostrarMensaje(`Ficha de ${color} movida a casilla ${nuevaPos + 1}`, 'success');
    
    // Verificar si llegó a la meta
    if (nuevaPos === 5) {
        if (!state.coloresMeta.includes(color)) {
            state.coloresMeta.push(color);
            mostrarMensaje(`🎉 ¡${color} llegó a la META! (${state.coloresMeta.length}/2)`, 'success');
            
            if (state.coloresMeta.length >= 2) {
                setTimeout(() => {
                    finalizarJuego();
                }, 500);
            }
        }
    }
    
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
    // Si el juego terminó, no recalcular
    if (state.juegoTerminado) {
        const scoreTotal = document.getElementById('score-total');
        if (scoreTotal) {
            scoreTotal.textContent = state.myTotalScore;
        }
        return;
    }
    
    const playerData = state.playersData[state.myId];
    const primerColor = state.coloresMeta?.[0] || null;
    
    let puntajeTotal = 0;
    
    if (playerData && playerData.progresoCartas) {
        // 1. Sumar puntajes de cartas por color
        COLORES.forEach(color => {
            let puntajeColor = 0;
            for (let i = 1; i <= 9; i++) {
                const key = `${color}-${i}`;
                const data = playerData.progresoCartas[key];
                if (data && data.completada === true) {
                    puntajeColor += PUNTAJES[color][i - 1] || 0;
                }
            }
            if (color === primerColor) {
                puntajeColor = 0;
            }
            puntajeTotal += puntajeColor;
        });
        
        // 2. Sumar tickets de color
        COLORES.forEach(color => {
            if (state.tickets[color] === state.myId) {
                puntajeTotal += TICKETS[color].puntaje;
            }
        });
        
        // 3. Sumar BONUS TICKET
        if (state.bonusTicket === state.myId) {
            puntajeTotal += TICKETS.bonus.puntaje;
        }
        
        // 4. Sumar puntos de cartas especiales
        if (playerData.puntosEspeciales && playerData.puntosEspeciales.length > 0) {
            const totalEspeciales = playerData.puntosEspeciales.reduce((sum, pts) => sum + pts, 0);
            puntajeTotal += totalEspeciales;
        }
    }
    
    state.myTotalScore = puntajeTotal;
    if (playerData) {
        playerData.score = puntajeTotal;
    }
    
    // Actualizar UI
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

    // Actualizar playersData para broadcast
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
            cartasEspecialesUsadas: state.cartasEspecialesUsadas || 0,
            puntosEspeciales: state.playersData[state.myId]?.puntosEspeciales || []
        };
    }
}

// ============================================
// REPARTIR CARTAS
// ============================================

export function repartirCartas() {
    // Si el juego terminó, no permitir repartir
    if (state.juegoTerminado) {
        mostrarMensaje('El juego ya terminó. Reinicia para jugar de nuevo.', 'warning');
        return;
    }
    
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
    
    // Resetear puntosEspeciales
    if (state.playersData[state.myId]) {
        state.playersData[state.myId].puntosEspeciales = [];
    }
    
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
    
    // Resetear estado de fin del juego
    state.juegoTerminado = false;
    state.coloresMeta = [];
    state.resultadosFinales = {};
    
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
// REINICIAR TODO
// ============================================

export function reiniciarTodo() {
    // 1. Reiniciar estado global
    initState();
    
    // 2. Regenerar mazos
    generarMazos();
    
    // 3. Reiniciar datos del jugador en playersData
    if (state.playersData[state.myId]) {
        state.playersData[state.myId] = {
            name: state.myName || 'Jugador',
            score: 0,
            cartasJugador: Array(5).fill(null),
            cartasTerminadas: [],
            habilidadesUsadas: {},
            mazoColores: state.mazoColores,
            mazoEspecialDisponible: state.mazoEspecialDisponible,
            cartasVisibles: Array(4).fill(null),
            cartasRepartidas: false,
            tablero: state.tableroGlobal,
            fichas: state.fichas,
            progresoCartas: {},
            cartasEspecialesUsadas: 0,
            puntosEspeciales: []
        };
    }
    
    // 4. Resetear variables de estado
    state.myTotalScore = 0;
    state.cartasRepartidas = false;
    state.progresoCarta = {};
    state.habilidadesUsadas = {};
    state.cartasEspecialesUsadas = 0;
    state.cartasJugador = Array(5).fill(null);
    state.cartasTerminadas = [];
    state.cartasVisibles = Array(4).fill(null);
    state.cartaSeleccionada = null;
    state.cartaEspecialActual = null;
    state.modoEspecial = null;
    
    // Resetear estado de fin del juego
    state.juegoTerminado = false;
    state.coloresMeta = [];
    state.resultadosFinales = {};
    
    // 5. Resetear tickets
    COLORES.forEach(color => {
        state.tickets[color] = null;
    });
    state.bonusTicket = null;
    state.bonusReclamado = false;
    
    // 6. Resetear puntos especiales
    if (state.playersData[state.myId]) {
        state.playersData[state.myId].puntosEspeciales = [];
    }
    
    // 7. Cerrar modal de podio si está abierto
    cerrarPodio();
    
    // 8. Renderizar todo
    renderBoard();
    renderCartasVisibles();
    renderCartasJugador();
    updateVisuals();
    calculateScores();
    renderStatusPanel();
    renderLeaderboard();
    actualizarBotonEspecial();
    
    // 9. Broadcast si está en sala
    if (state.currentRoom) {
        broadcastMazo();
        broadcastTablero();
        broadcastTickets();
        broadcastScore('reiniciar');
    }
    
    mostrarMensaje('🔄 Juego reiniciado completamente', 'info');
}

// ============================================
// REINICIAR Y LIMPIAR (MANTENER POR COMPATIBILIDAD)
// ============================================

export function reiniciarTablero() {
    // Ahora llama a reiniciarTodo para reiniciar completamente
    reiniciarTodo();
}

export function limpiarMano() {
    state.cartasJugador = Array(5).fill(null);
    renderCartasJugador();
    if (state.currentRoom) {
        broadcastScore('sync');
    }
    mostrarMensaje('Mano limpiada', 'info');
}