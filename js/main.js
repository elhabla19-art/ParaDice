// ============================================
// MAIN - PUNTO DE ENTRADA
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
    actualizarBotonEspecial
} from './juego.js';
import { 
    playSolo, showJoinModal, backToLobby, 
    createRoom, joinRoom,
    setRenderStatusPanel
} from './mqtt.js';
import { toggleLeaderboard, abrirZoomLeaderboardDesdeCard, renderLeaderboard } from './leaderboard.js';

// ============================================
// FUNCIONES DEL PANEL DE ESTADO
// ============================================

function renderStatusPanel() {
    const container = document.getElementById('status-panel-content');
    if (!container) return;
    
    const colorHex = {
        celeste: '#4fc3f7',
        lima: '#aed581',
        naranja: '#ffb74d',
        purpura: '#ce93d8',
        rosa: '#f06292'
    };
    
    const COLORES = ['celeste', 'lima', 'naranja', 'purpura', 'rosa'];
    const PUNTAJES = {
        celeste: [15, 15, 10, 15, 20, 20, 20, 10, 20],
        lima: [20, 10, 15, 20, 10, 10, 20, 15, 15],
        naranja: [15, 15, 10, 10, 20, 20, 20, 15, 10],
        purpura: [10, 20, 15, 20, 20, 15, 10, 15, 10],
        rosa: [15, 15, 10, 10, 10, 20, 20, 15, 20]
    };
    
    let totalCartas = 0;
    let html = '';
    
    // Todos los colores en orden
    COLORES.forEach((color) => {
        const playerData = state.playersData[state.myId];
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
        
        html += `
            <div class="status-item-color" style="color: ${colorHex[color]};">
                ${puntajeColor}pts
            </div>
        `;
    });
    
    // Tag "Todas" en gris
    html += `
        <div class="status-item-todas">
            Todas: ${totalCartas}pts
        </div>
    `;
    
    container.innerHTML = html;
}

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
    
    console.log('ParaDice - Iniciado');
    console.log(`Cartas en mazo: ${state.mazoColores.length}`);
    console.log(`Cartas especiales: ${state.mazoEspecialDisponible.length}`);
    console.log('Completa una carta Lima y usa su habilidad para desbloquear Cartas Especiales');
}

// ============================================
// EVENTOS
// ============================================

document.addEventListener('DOMContentLoaded', init);

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

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        cerrarZoom();
        cerrarHabilidad();
        cerrarEspecial();
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
    renderStatusPanel
};