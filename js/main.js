// ============================================
// MAIN - PUNTO DE ENTRADA (CON MODO AUTOMATICO)
// ============================================

import { state, initState } from './config-state.js';
import { generarMazos, renderBoard, updateVisuals, usarHabilidadPorColor } from './mazos-tablero.js';
import { cerrarZoom, usarHabilidadDesdeZoom } from './zoom.js';
import { 
    repartirCartas, 
    reiniciarTablero, 
    calculateScores, 
    limpiarMano,
    usarHabilidad,
    cerrarHabilidad,
    usarCartaEspecial,
    ejecutarEfectoEspecial,
    moverFicha,
    recuperarHabilidad,
    cerrarEspecial,
    actualizarBotonEspecial,
    cerrarPodio
} from './juego.js';
import { 
    playSolo, showJoinModal, backToLobby, 
    createRoom, joinRoom,
    setRenderStatusPanel,
    forzarRestauracionLocal
} from './mqtt.js';
import { toggleLeaderboard, abrirZoomLeaderboardDesdeCard, renderLeaderboard, refrescarSincronizacion } from './leaderboard.js';
import { renderStatusPanel } from './panel.js';
import { abrirCompletas, cerrarCompletas, verHistorial, cerrarHistorial, activarHabilidadDesdeCompletas, abrirZoomTerminadaDesdeCompletas, abrirCompletasDeJugador, verHistorialDeJugador } from './completas.js';
import { 
    pushMovimiento, 
    eliminarMovimientosDeCarta, 
    limpiarPilaMovimientos, 
    intentarDeshacer, 
    desmarcarCasilla,
    esUltimoMovimiento,
    hayMovimientos,
    peekMovimiento,
    getUltimoMovimiento,
    getTodosLosMovimientos,
    contarMovimientos
} from './deshacer.js';

// ===== DETECTAR MODO AUTOMATICO =====
const urlParams = new URLSearchParams(window.location.search);
const isAutoMode = urlParams.get('auto') === '1';
const AUTO_ROOM_CODE = 'GRIL';

// ============================================
// INICIALIZACIÓN
// ============================================

function init() {
    // Registrar renderStatusPanel para que mqtt.js pueda usarlo
    setRenderStatusPanel(renderStatusPanel);
    
    initState();
    generarMazos();
    renderBoard();
    updateVisuals();
    calculateScores();
    renderStatusPanel();
    actualizarBotonEspecial();
    
    if (window.innerWidth <= 768) {
        const content = document.getElementById('leaderboardContent');
        const icon = document.getElementById('toggleIcon');
        if (content) content.style.display = 'none';
        if (icon) icon.textContent = '▼';
    }
    
    // EXPONER FUNCIONES GLOBALES
    window.repartirCartas = repartirCartas;
    window.reiniciarTablero = reiniciarTablero;
    window.limpiarMano = limpiarMano;
    window.createRoom = createRoom;
    window.joinRoom = joinRoom;
    window.playSolo = playSolo;
    window.showJoinModal = showJoinModal;
    window.backToLobby = backToLobby;
    window.cerrarZoom = cerrarZoom;
    window.toggleLeaderboard = toggleLeaderboard;
    window.abrirZoomLeaderboardDesdeCard = abrirZoomLeaderboardDesdeCard;
    window.usarHabilidad = usarHabilidad;
    window.cerrarHabilidad = cerrarHabilidad;
    window.usarCartaEspecial = usarCartaEspecial;
    window.ejecutarEfectoEspecial = ejecutarEfectoEspecial;
    window.usarHabilidadPorColor = usarHabilidadPorColor;
    window.moverFicha = moverFicha;
    window.recuperarHabilidad = recuperarHabilidad;
    window.cerrarEspecial = cerrarEspecial;
    window.usarHabilidadDesdeZoom = usarHabilidadDesdeZoom;
    window.actualizarBotonEspecial = actualizarBotonEspecial;
    window.renderStatusPanel = renderStatusPanel;
    window.cerrarPodio = cerrarPodio;
    window.refrescarSincronizacion = refrescarSincronizacion;
    window.forzarRestauracionLocal = forzarRestauracionLocal;
    window.isAutoMode = isAutoMode;
    window.AUTO_ROOM_CODE = AUTO_ROOM_CODE;
    
    // Funciones de completas
    window.abrirCompletas = abrirCompletas;
    window.cerrarCompletas = cerrarCompletas;
    window.verHistorial = verHistorial;
    window.cerrarHistorial = cerrarHistorial;
    window.activarHabilidadDesdeCompletas = activarHabilidadDesdeCompletas;
    window.abrirZoomTerminadaDesdeCompletas = abrirZoomTerminadaDesdeCompletas;
    window.abrirCompletasDeJugador = abrirCompletasDeJugador;
    window.verHistorialDeJugador = verHistorialDeJugador;

    // Funciones de deshacer (para debug y consola)
    window._debugDeshacer = {
        push: pushMovimiento,
        pop: () => { const m = popMovimiento(); if(m) console.log('Pop:', m); return m; },
        peek: peekMovimiento,
        hay: hayMovimientos,
        contar: contarMovimientos,
        limpiar: () => { limpiarPilaMovimientos(); console.log('Pila limpiada'); },
        todos: getTodosLosMovimientos,
        ultimo: getUltimoMovimiento,
        esUltimo: esUltimoMovimiento,
        eliminarDeCarta: eliminarMovimientosDeCarta,
        desmarcar: desmarcarCasilla,
        intentar: intentarDeshacer
    };
    
    console.log('ParaDice - Iniciado');
    console.log(`Cartas en mazo: ${state.mazoColores.length}`);
    console.log(`Cartas especiales: ${state.mazoEspecialDisponible.length}`);
    console.log('Completa una carta Lima y usa su habilidad para desbloquear Cartas Especiales');
    console.log('Haz clic en el panel de estado para ver tus cartas completadas');
    console.log('🔄 Sistema de deshacer: haz clic en la última casilla marcada para desmarcarla');
    console.log('📊 Para debug: window._debugDeshacer');
    console.log('🔄 Para restaurar estado: window.forzarRestauracionLocal()');
    console.log('🤖 Modo automatico:', isAutoMode ? 'ACTIVADO (sala ' + AUTO_ROOM_CODE + ')' : 'DESACTIVADO');
}

// ============================================
// EVENTOS
// ============================================

document.addEventListener('DOMContentLoaded', init);

// Evento para abrir completas al hacer clic en el panel de estado
document.addEventListener('click', function(event) {
    const panel = document.getElementById('status-panel-content');
    if (panel && panel.contains(event.target)) {
        abrirCompletas();
    }
});

document.addEventListener('click', function(event) {
    const modal = document.getElementById('zoomModal');
    if (modal && event.target === modal) cerrarZoom();
});

document.addEventListener('click', function(event) {
    const modal = document.getElementById('habilidadModal');
    if (modal && event.target === modal) cerrarHabilidad();
});

document.addEventListener('click', function(event) {
    const modal = document.getElementById('especialModal');
    if (modal && event.target === modal) cerrarEspecial();
});

document.addEventListener('click', function(event) {
    const modal = document.getElementById('podioModal');
    if (modal && event.target === modal) cerrarPodio();
});

document.addEventListener('click', function(event) {
    const modal = document.getElementById('completasModal');
    if (modal && event.target === modal) cerrarCompletas();
});

document.addEventListener('click', function(event) {
    const modal = document.getElementById('historialModal');
    if (modal && event.target === modal) cerrarHistorial();
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        cerrarZoom();
        cerrarHabilidad();
        cerrarEspecial();
        cerrarPodio();
        cerrarCompletas();
        cerrarHistorial();
    }
});

// ============================================
// EXPORTAR
// ============================================

export { 
    repartirCartas, 
    reiniciarTablero, 
    limpiarMano,
    createRoom,
    joinRoom,
    playSolo,
    showJoinModal,
    backToLobby,
    cerrarZoom,
    toggleLeaderboard,
    abrirZoomLeaderboardDesdeCard,
    usarHabilidad,
    cerrarHabilidad,
    usarCartaEspecial,
    ejecutarEfectoEspecial,
    usarHabilidadPorColor,
    moverFicha,
    recuperarHabilidad,
    cerrarEspecial,
    usarHabilidadDesdeZoom,
    actualizarBotonEspecial,
    renderStatusPanel,
    cerrarPodio,
    refrescarSincronizacion,
    forzarRestauracionLocal,
    abrirCompletas,
    cerrarCompletas,
    verHistorial,
    cerrarHistorial,
    activarHabilidadDesdeCompletas,
    abrirZoomTerminadaDesdeCompletas,
    abrirCompletasDeJugador,
    verHistorialDeJugador,
    // Funciones de deshacer
    pushMovimiento,
    eliminarMovimientosDeCarta,
    limpiarPilaMovimientos,
    intentarDeshacer,
    desmarcarCasilla,
    esUltimoMovimiento,
    hayMovimientos,
    peekMovimiento,
    getUltimoMovimiento,
    getTodosLosMovimientos,
    contarMovimientos,
    // Modo automatico
    isAutoMode,
    AUTO_ROOM_CODE
};