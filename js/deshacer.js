// ============================================
// DESHACER - SISTEMA DE PILA LIFO
// ============================================

import { state } from './config-state.js';
import { mostrarMensaje } from './utils.js';

// ============================================
// PILA DE MOVIMIENTOS (LIFO)
// ============================================

let pilaMovimientos = [];

// ============================================
// FUNCIONES DE PILA
// ============================================

/**
 * Guarda un nuevo movimiento en la pila
 * @param {string} color - Color de la carta
 * @param {number} numero - Número de la carta
 * @param {number} casilla - Casilla marcada (1, 2 o 3)
 */
export function pushMovimiento(color, numero, casilla) {
    const key = `${color}-${numero}`;
    pilaMovimientos.push({
        key: key,
        color: color,
        numero: numero,
        casilla: casilla,
        timestamp: Date.now()
    });
}

/**
 * Obtiene y elimina el último movimiento de la pila
 * @returns {Object|null} El último movimiento o null si está vacía
 */
export function popMovimiento() {
    if (pilaMovimientos.length === 0) return null;
    return pilaMovimientos.pop();
}

/**
 * Obtiene el último movimiento sin eliminarlo
 * @returns {Object|null} El último movimiento o null si está vacía
 */
export function peekMovimiento() {
    if (pilaMovimientos.length === 0) return null;
    return pilaMovimientos[pilaMovimientos.length - 1];
}

/**
 * Verifica si hay movimientos en la pila
 * @returns {boolean} True si hay movimientos
 */
export function hayMovimientos() {
    return pilaMovimientos.length > 0;
}

/**
 * Obtiene la cantidad de movimientos en la pila
 * @returns {number} Cantidad de movimientos
 */
export function contarMovimientos() {
    return pilaMovimientos.length;
}

/**
 * Elimina todos los movimientos de una carta específica
 * @param {string} key - Clave de la carta (ej: 'celeste-5')
 */
export function eliminarMovimientosDeCarta(key) {
    const cantidadOriginal = pilaMovimientos.length;
    pilaMovimientos = pilaMovimientos.filter(m => m.key !== key);
    const eliminados = cantidadOriginal - pilaMovimientos.length;
    if (eliminados > 0) {
        console.log(`🗑️ Eliminados ${eliminados} movimiento(s) de la carta ${key}`);
    }
}

/**
 * Limpia completamente la pila de movimientos
 */
export function limpiarPilaMovimientos() {
    const cantidad = pilaMovimientos.length;
    pilaMovimientos = [];
    if (cantidad > 0) {
        console.log(`🗑️ Pila de movimientos limpiada (${cantidad} movimiento(s))`);
    }
}

/**
 * Verifica si un movimiento es el último de la pila
 * @param {string} key - Clave de la carta
 * @param {number} casilla - Casilla a verificar
 * @returns {boolean} True si es el último movimiento
 */
export function esUltimoMovimiento(key, casilla) {
    const ultimo = peekMovimiento();
    if (!ultimo) return false;
    return ultimo.key === key && ultimo.casilla === casilla;
}

/**
 * Obtiene el último movimiento (para depuración)
 * @returns {Object|null} El último movimiento o null
 */
export function getUltimoMovimiento() {
    return peekMovimiento();
}

/**
 * Obtiene todos los movimientos (para depuración)
 * @returns {Array} Array con todos los movimientos
 */
export function getTodosLosMovimientos() {
    return [...pilaMovimientos];
}

// ============================================
// FUNCIONES DE DESHACER (INTERFAZ PRINCIPAL)
// ============================================

/**
 * Intenta deshacer el último movimiento
 * @param {string} key - Clave de la carta donde se hizo clic
 * @param {number} casilla - Casilla donde se hizo clic
 * @returns {Object|null} El movimiento deshecho o null si no se pudo
 */
export function intentarDeshacer(key, casilla) {
    // Verificar si hay movimientos
    if (!hayMovimientos()) {
        mostrarMensaje('No hay movimientos para deshacer', 'warning');
        return null;
    }

    // Verificar si es el último movimiento
    if (!esUltimoMovimiento(key, casilla)) {
        mostrarMensaje('Solo puedes deshacer el último movimiento', 'warning');
        return null;
    }

    // Deshacer: obtener y eliminar el último movimiento
    const movimiento = popMovimiento();
    
    if (movimiento) {
        console.log(`↩️ Deshecho: ${movimiento.color} N°${movimiento.numero} - Casilla ${movimiento.casilla}`);
    }
    
    return movimiento;
}

/**
 * Desmarca una casilla (llamada desde el sistema de deshacer)
 * @param {string} key - Clave de la carta
 * @param {number} casilla - Casilla a desmarcar
 * @returns {boolean} True si se desmarcó correctamente
 */
export function desmarcarCasilla(key, casilla) {
    const progreso = state.progresoCarta[key];
    if (!progreso) {
        console.error(`❌ No se encontró progreso para la carta ${key}`);
        return false;
    }

    // Verificar si la carta ya está completada
    if (progreso.completada) {
        console.warn(`⚠️ La carta ${key} ya está completada, no se puede desmarcar`);
        return false;
    }

    // Verificar si la casilla está marcada
    const index = progreso.marcadas.indexOf(casilla);
    if (index === -1) {
        console.warn(`⚠️ La casilla ${casilla} no está marcada en ${key}`);
        return false;
    }

    // Desmarcar la casilla
    progreso.marcadas.splice(index, 1);
    
    // Actualizar el estado de completada (si estaba en 3/3, vuelve a 2/3)
    // pero el progreso.completada ya debería ser false si no estaba completa
    // Si por alguna razón estaba completada, la desmarcamos
    if (progreso.completada && progreso.marcadas.length < 3) {
        progreso.completada = false;
        console.log(`🔄 Carta ${key} ya no está completada (${progreso.marcadas.length}/3)`);
    }

    return true;
}

// ============================================
// EXPONER FUNCIONES GLOBALES PARA DEBUG
// ============================================

window._debugPilaMovimientos = {
    getPila: getTodosLosMovimientos,
    getUltimo: getUltimoMovimiento,
    contar: contarMovimientos,
    limpiar: limpiarPilaMovimientos
};

// ============================================
// EXPORTAR
// ============================================

export default {
    pushMovimiento,
    popMovimiento,
    peekMovimiento,
    hayMovimientos,
    contarMovimientos,
    eliminarMovimientosDeCarta,
    limpiarPilaMovimientos,
    esUltimoMovimiento,
    getUltimoMovimiento,
    getTodosLosMovimientos,
    intentarDeshacer,
    desmarcarCasilla
};