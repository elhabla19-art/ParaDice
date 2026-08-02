// ============================================
// COMPLETAS - MODAL DE CARTAS COMPLETADAS
// ============================================

import { COLORES, state, PUNTAJES, HABILIDADES } from './config-state.js';
import { getCartasCompletadasPorColor } from './juego.js';
import { abrirZoomTerminada } from './zoom.js';
import { usarHabilidad } from './juego.js';
import { mostrarMensaje } from './utils.js';

// ============================================
// ABRIR MODAL COMPLETAS (JUGADOR LOCAL)
// ============================================

export function abrirCompletas() {
    const modal = document.getElementById('completasModal');
    const content = document.getElementById('completasContent');
    if (!modal || !content) return;

    const jugadorId = state.myId;
    const player = state.playersData[jugadorId];
    if (!player) {
        mostrarMensaje('No hay datos del jugador', 'error');
        return;
    }

    const colorHex = {
        celeste: '#4fc3f7',
        lima: '#aed581',
        naranja: '#ffb74d',
        purpura: '#ce93d8',
        rosa: '#f06292'
    };

    let html = `
        <div style="text-align: center; margin-bottom: 15px;">
            <h2 style="color: #fff; font-size: 1.2rem;">Mis Casetas Completas</h2>
            <p style="color: #666; font-size: 0.7rem; margin-top: 4px;">Haz clic en cualquier color para ver su historial</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
    `;

    COLORES.forEach(color => {
        const hex = colorHex[color] || '#888';
        const completadas = getCartasCompletadasPorColor(jugadorId, color);
        const total = completadas.length;

        // Contar habilidades disponibles (cartas terminadas de este color que NO han usado habilidad)
        const cartasTerminadas = player.cartasTerminadas || [];
        const cartasColor = cartasTerminadas.filter(c => c.color === color);
        const disponibles = cartasColor.filter(c => {
            const usada = player.habilidadesUsadas ? player.habilidadesUsadas[c.id] : true;
            return !usada;
        });
        const habilidadesDisponibles = disponibles.length;

        // Verificar si tiene habilidad este color
        const tieneHabilidad = HABILIDADES[color] !== undefined;

        html += `
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border-left: 3px solid ${hex}; cursor: pointer;" 
                 onclick="window.verHistorial('${color}')"
                 onmouseover="this.style.background='rgba(255,255,255,0.1)'" 
                 onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                <span style="font-size: 1.5rem; color: ${hex};">•</span>
                <span style="flex: 1; color: #fff; font-size: 0.85rem;">
                    Completas: <strong>${total}</strong>
                </span>
                <span style="color: #fff; font-size: 0.85rem;">
                    Habilidades: <strong style="color: ${habilidadesDisponibles > 0 ? '#4caf50' : '#666'};">${habilidadesDisponibles}</strong>
                </span>
                ${tieneHabilidad && habilidadesDisponibles > 0 ? `
                    <button onclick="event.stopPropagation(); window.activarHabilidadDesdeCompletas('${color}')" 
                            style="background: #4caf50; border: none; color: #fff; padding: 4px 12px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; cursor: pointer; transition: all 0.2s;"
                            onmouseover="this.style.background='#45a049'" 
                            onmouseout="this.style.background='#4caf50'">
                        Activar
                    </button>
                ` : `
                    <button disabled style="background: #444; border: none; color: #666; padding: 4px 12px; border-radius: 4px; font-size: 0.7rem; cursor: not-allowed; opacity: 0.5;">
                        Activar
                    </button>
                `}
            </div>
        `;
    });

    // Resumen de habilidades
    html += `
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: 10px;">
            <div style="font-size: 0.7rem; color: #888; text-align: center; margin-bottom: 6px;">Resumen de Habilidades</div>
            <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.6rem; color: #aaa; text-align: left; padding: 0 4px;">
    `;

    COLORES.forEach(color => {
        const habilidad = HABILIDADES[color];
        if (habilidad) {
            const hex = colorHex[color] || '#888';
            html += `
                <div style="display: flex; align-items: center; gap: 6px; padding: 2px 6px; background: rgba(255,255,255,0.03); border-radius: 3px; text-align: left;">
                    <span style="color: ${hex}; font-weight: bold; font-size: 1.2rem; line-height: 1;">•</span>
                    <span style="color: #ccc; font-weight: bold; min-width: 65px;">${habilidad.nombre}</span>
                    <span style="color: #666; font-size: 0.55rem; flex: 1;">- ${habilidad.descripcion}</span>
                </div>
            `;
        }
    });

    html += `
            </div>
        </div>
        <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; margin-top: 12px;">
            <button onclick="window.cerrarCompletas()" 
                    style="background: #555; color: white; border: none; padding: 8px 30px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; cursor: pointer;">
                Cerrar
            </button>
        </div>
    `;

    content.innerHTML = html;
    modal.style.display = 'flex';
}

// ============================================
// CERRAR MODAL COMPLETAS
// ============================================

export function cerrarCompletas() {
    const modal = document.getElementById('completasModal');
    if (modal) modal.style.display = 'none';
}

// ============================================
// VER HISTORIAL DE UN COLOR (LOCAL)
// ============================================

export function verHistorial(color) {
    const jugadorId = state.myId;
    const player = state.playersData[jugadorId];
    if (!player) return;

    const cartasTerminadas = player.cartasTerminadas || [];
    const cartasColor = cartasTerminadas.filter(c => c.color === color);

    if (cartasColor.length === 0) {
        mostrarMensaje(`No hay cartas completadas de ${color}`, 'warning');
        return;
    }

    // Guardar estado del historial para restaurar después del zoom
    window._historialState = {
        activo: true,
        color: color,
        jugadorId: jugadorId,
        modo: 'local'
    };

    const colorHex = {
        celeste: '#4fc3f7',
        lima: '#aed581',
        naranja: '#ffb74d',
        purpura: '#ce93d8',
        rosa: '#f06292'
    }[color] || '#888';

    const modal = document.getElementById('historialModal');
    const content = document.getElementById('historialContent');
    if (!modal || !content) return;

    let html = `
        <div style="text-align: center; margin-bottom: 12px;">
            <span style="font-size: 1.5rem; color: ${colorHex};">•</span>
            <h3 style="color: #fff; display: inline; margin-left: 8px; font-size: 1.1rem;">${color.charAt(0).toUpperCase() + color.slice(1)} - Historial</h3>
            <div style="font-size: 0.65rem; color: #666; margin-top: 2px;">Haz clic en una carta para ampliarla</div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-height: 300px; overflow-y: auto; padding: 4px;">
    `;

    // Ordenar por número de carta (ascendente)
    cartasColor.sort((a, b) => a.numero - b.numero);

    cartasColor.forEach(carta => {
        const usada = player.habilidadesUsadas?.[carta.id] || false;
        html += `
            <div onclick="window.abrirZoomTerminadaDesdeCompletas('${carta.id}')" 
                 style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px; cursor: pointer; transition: all 0.2s; text-align: center; width: 70px;"
                 onmouseover="this.style.background='rgba(255,255,255,0.15)'" 
                 onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                <img src="${carta.imagen}" alt="Carta ${carta.numero}" 
                     style="width: 60px; height: 80px; object-fit: contain; border-radius: 4px; display: block; margin: 0 auto;"
                     onerror="this.style.display='none'; this.parentElement.innerHTML += '<div style=\\'font-size:0.7rem;color:#888;\\'>N°${carta.numero}</div>'">
                <div style="font-size: 0.5rem; color: ${usada ? '#666' : '#4caf50'}; margin-top: 2px;">
                    ${usada ? 'Usada' : 'Disponible'}
                </div>
            </div>
        `;
    });

    html += `
        </div>
        <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: 10px;">
            <button onclick="window.cerrarHistorial()" 
                    style="background: #555; color: white; border: none; padding: 6px 25px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; cursor: pointer;">
                Cerrar
            </button>
        </div>
    `;

    content.innerHTML = html;
    modal.style.display = 'flex';
}

// ============================================
// VER HISTORIAL DE OTRO JUGADOR
// ============================================

export function verHistorialDeJugador(jugadorId, color) {
    const player = state.playersData[jugadorId];
    if (!player) return;

    const cartasTerminadas = player.cartasTerminadas || [];
    const cartasColor = cartasTerminadas.filter(c => c.color === color);

    if (cartasColor.length === 0) {
        mostrarMensaje(`No hay cartas completadas de ${color} para ${player.name}`, 'warning');
        return;
    }

    // Guardar estado del historial para restaurar después del zoom
    window._historialState = {
        activo: true,
        color: color,
        jugadorId: jugadorId,
        modo: 'remoto'
    };

    const colorHex = {
        celeste: '#4fc3f7',
        lima: '#aed581',
        naranja: '#ffb74d',
        purpura: '#ce93d8',
        rosa: '#f06292'
    }[color] || '#888';

    const modal = document.getElementById('historialModal');
    const content = document.getElementById('historialContent');
    if (!modal || !content) return;

    let html = `
        <div style="text-align: center; margin-bottom: 12px;">
            <span style="font-size: 1.5rem; color: ${colorHex};">•</span>
            <h3 style="color: #fff; display: inline; margin-left: 8px; font-size: 1.1rem;">${player.name} - ${color.charAt(0).toUpperCase() + color.slice(1)}</h3>
            <div style="font-size: 0.65rem; color: #666; margin-top: 2px;">Haz clic en una carta para ampliarla</div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-height: 300px; overflow-y: auto; padding: 4px;">
    `;

    cartasColor.sort((a, b) => a.numero - b.numero);

    cartasColor.forEach(carta => {
        const usada = player.habilidadesUsadas?.[carta.id] || false;
        html += `
            <div onclick="window.abrirZoomTerminadaDesdeCompletas('${carta.id}')" 
                 style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px; cursor: pointer; transition: all 0.2s; text-align: center; width: 70px;"
                 onmouseover="this.style.background='rgba(255,255,255,0.15)'" 
                 onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                <img src="${carta.imagen}" alt="Carta ${carta.numero}" 
                     style="width: 60px; height: 80px; object-fit: contain; border-radius: 4px; display: block; margin: 0 auto;"
                     onerror="this.style.display='none'; this.parentElement.innerHTML += '<div style=\\'font-size:0.7rem;color:#888;\\'>N°${carta.numero}</div>'">
                <div style="font-size: 0.5rem; color: ${usada ? '#666' : '#4caf50'}; margin-top: 2px;">
                    ${usada ? 'Usada' : 'Disponible'}
                </div>
            </div>
        `;
    });

    html += `
        </div>
        <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: 10px;">
            <button onclick="window.cerrarHistorial()" 
                    style="background: #555; color: white; border: none; padding: 6px 25px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; cursor: pointer;">
                Cerrar
            </button>
        </div>
    `;

    content.innerHTML = html;
    modal.style.display = 'flex';
}

// ============================================
// CERRAR HISTORIAL
// ============================================

export function cerrarHistorial() {
    const modal = document.getElementById('historialModal');
    if (modal) modal.style.display = 'none';
    // Limpiar estado del historial
    window._historialState = { activo: false, color: null, jugadorId: null, modo: null };
}

// ============================================
// ACTIVAR HABILIDAD DESDE COMPLETAS
// ============================================

export function activarHabilidadDesdeCompletas(color) {
    const jugadorId = state.myId;
    const player = state.playersData[jugadorId];
    if (!player) return;

    const cartasTerminadas = player.cartasTerminadas || [];
    const cartasColor = cartasTerminadas.filter(c => c.color === color);
    
    // Buscar una carta de este color que NO haya usado su habilidad
    const disponible = cartasColor.find(c => {
        const usada = player.habilidadesUsadas?.[c.id] || false;
        return !usada;
    });

    if (!disponible) {
        mostrarMensaje(`No hay habilidades disponibles para ${color}`, 'warning');
        return;
    }

    // Cerrar modal de completas
    cerrarCompletas();
    
    // Usar la habilidad (reutiliza la función existente)
    usarHabilidad(disponible);
}

// ============================================
// ABRIR ZOOM DESDE HISTORIAL (CORREGIDO)
// ============================================

export function abrirZoomTerminadaDesdeCompletas(cartaId) {
    // Primero verificar si hay un estado de historial activo
    const estadoHistorial = window._historialState || { activo: false, jugadorId: null };
    
    let carta = null;
    let jugadorId = estadoHistorial.jugadorId || state.myId;
    let player = null;
    
    // Buscar la carta en el jugador correspondiente
    if (jugadorId && state.playersData[jugadorId]) {
        player = state.playersData[jugadorId];
        if (player && player.cartasTerminadas) {
            carta = player.cartasTerminadas.find(c => c.id === cartaId);
        }
    }
    
    // Si no se encontró en el jugador del historial, buscar en el jugador local
    if (!carta) {
        const playerLocal = state.playersData[state.myId];
        if (playerLocal && playerLocal.cartasTerminadas) {
            carta = playerLocal.cartasTerminadas.find(c => c.id === cartaId);
        }
    }
    
    // Si aún no se encontró, buscar en state.cartasTerminadas (fallback)
    if (!carta) {
        carta = state.cartasTerminadas?.find(c => c.id === cartaId);
    }
    
    if (!carta) {
        mostrarMensaje('Carta no encontrada', 'error');
        console.warn(`Carta ${cartaId} no encontrada en ningún jugador`);
        return;
    }

    // Cerrar historial y completas antes de abrir zoom
    cerrarHistorial();
    cerrarCompletas();
    
    abrirZoomTerminada(carta);
}

// ============================================
// ABRIR COMPLETAS DE OTRO JUGADOR (DESDE LEADERBOARD)
// ============================================

export function abrirCompletasDeJugador(jugadorId, color) {
    const player = state.playersData[jugadorId];
    if (!player) {
        mostrarMensaje('Jugador no encontrado', 'error');
        return;
    }

    const colorHex = {
        celeste: '#4fc3f7',
        lima: '#aed581',
        naranja: '#ffb74d',
        purpura: '#ce93d8',
        rosa: '#f06292'
    }[color] || '#888';

    const completadas = getCartasCompletadasPorColor(jugadorId, color);
    const total = completadas.length;

    // Contar habilidades disponibles
    const cartasTerminadas = player.cartasTerminadas || [];
    const cartasColor = cartasTerminadas.filter(c => c.color === color);
    const disponibles = cartasColor.filter(c => {
        const usada = player.habilidadesUsadas ? player.habilidadesUsadas[c.id] : true;
        return !usada;
    });
    const habilidadesDisponibles = disponibles.length;

    const modal = document.getElementById('completasModal');
    const content = document.getElementById('completasContent');
    if (!modal || !content) return;

    let html = `
        <div style="text-align: center; margin-bottom: 15px;">
            <h2 style="color: #fff; font-size: 1.1rem;">${player.name} - ${color.charAt(0).toUpperCase() + color.slice(1)}</h2>
            <p style="color: #666; font-size: 0.65rem; margin-top: 2px;">Haz clic en "Ver Historial" para ver las cartas</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
            <div style="display: flex; gap: 20px; background: rgba(255,255,255,0.05); padding: 10px 20px; border-radius: 8px; border-left: 3px solid ${colorHex};">
                <span style="color: #fff;">Completas: <strong>${total}</strong></span>
                <span style="color: #fff;">Habilidades: <strong style="color: ${habilidadesDisponibles > 0 ? '#4caf50' : '#666'};">${habilidadesDisponibles}</strong></span>
            </div>
            ${total > 0 ? `
                <button onclick="window.verHistorialDeJugador('${jugadorId}', '${color}')" 
                        style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 6px 20px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.2)'" 
                        onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                    Ver Historial
                </button>
            ` : `
                <span style="color: #666; font-size: 0.8rem;">Sin cartas completadas</span>
            `}
        </div>
        <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; margin-top: 12px;">
            <button onclick="window.cerrarCompletas()" 
                    style="background: #555; color: white; border: none; padding: 8px 30px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; cursor: pointer;">
                Cerrar
            </button>
        </div>
    `;

    content.innerHTML = html;
    modal.style.display = 'flex';
}

// ============================================
// EXPONER FUNCIONES GLOBALES
// ============================================

window.abrirCompletas = abrirCompletas;
window.cerrarCompletas = cerrarCompletas;
window.verHistorial = verHistorial;
window.cerrarHistorial = cerrarHistorial;
window.activarHabilidadDesdeCompletas = activarHabilidadDesdeCompletas;
window.abrirZoomTerminadaDesdeCompletas = abrirZoomTerminadaDesdeCompletas;
window.abrirCompletasDeJugador = abrirCompletasDeJugador;
window.verHistorialDeJugador = verHistorialDeJugador;