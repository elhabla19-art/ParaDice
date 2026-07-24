// ============================================
// MAIN - PUNTO DE ENTRADA
// ============================================

import { state, initState } from './config-state.js';
import { generarMazos, renderBoard, updateVisuals } from './mazos-tablero.js';
import { cerrarZoom } from './zoom.js';
import { repartirCartas, reiniciarTablero, calculateScores } from './juego.js';
import { 
    playSolo, showJoinModal, backToLobby, 
    createRoom, joinRoom 
} from './mqtt.js';
import { toggleLeaderboard, abrirZoomLeaderboardDesdeCard } from './leaderboard.js';
import { mostrarMensaje } from './utils.js';

// ----- INICIALIZACIÓN -----
function init() {
    // Inicializar estado
    initState();
    
    // Generar mazos
    generarMazos();
    
    // Renderizar
    renderBoard();
    updateVisuals();
    calculateScores();
    
    // Leaderboard cerrado en móvil
    if (window.innerWidth <= 768) {
        const content = document.getElementById('leaderboardContent');
        const icon = document.getElementById('toggleIcon');
        if (content) content.style.display = 'none';
        if (icon) icon.textContent = '▼';
    }
    
    // Exponer funciones globales
    window.repartirCartas = repartirCartas;
    window.reiniciarTablero = reiniciarTablero;
    window.createRoom = createRoom;
    window.joinRoom = joinRoom;
    window.playSolo = playSolo;
    window.showJoinModal = showJoinModal;
    window.backToLobby = backToLobby;
    window.cerrarZoom = cerrarZoom;
    window.toggleLeaderboard = toggleLeaderboard;
    window.abrirZoomLeaderboardDesdeCard = abrirZoomLeaderboardDesdeCard;
    
    console.log('🎲 ParaDice - Iniciado');
    console.log(`📦 Cartas en mazo: ${state.mazoColores.length}`);
    console.log(`⭐ Cartas especiales: ${state.mazoEspecial.length}`);
}

// ----- EVENTOS GLOBALES -----
document.addEventListener('DOMContentLoaded', init);

// ----- CLICK FUERA DEL ZOOM PARA CERRAR -----
document.addEventListener('click', function(event) {
    const modal = document.getElementById('zoomModal');
    if (!modal) return;
    
    if (event.target === modal) {
        cerrarZoom();
    }
});

// ----- TECLA ESC PARA CERRAR ZOOM -----
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        cerrarZoom();
    }
});

// Exportar funciones que otros módulos puedan necesitar
export { repartirCartas, reiniciarTablero };