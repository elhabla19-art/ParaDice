// ============================================
// MAIN - PUNTO DE ENTRADA
// ============================================

import { state, initState } from './config-state.js';
import { generarMazos, renderBoard, updateVisuals } from './mazos-tablero.js';
import { cerrarZoom } from './zoom.js';
import { repartirCartas, reiniciarTablero, calculateScores, limpiarMano } from './juego.js';
import { 
    playSolo, showJoinModal, backToLobby, 
    createRoom, joinRoom 
} from './mqtt.js';
import { toggleLeaderboard, abrirZoomLeaderboardDesdeCard } from './leaderboard.js';

// INICIALIZACIÓN
function init() {
    initState();
    generarMazos();
    renderBoard();
    updateVisuals();
    calculateScores();
    
    if (window.innerWidth <= 768) {
        const content = document.getElementById('leaderboardContent');
        const icon = document.getElementById('toggleIcon');
        if (content) content.style.display = 'none';
        if (icon) icon.textContent = '▼';
    }
    
    // Exponer funciones globales
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
    
    console.log('🎲 ParaDice - Iniciado');
    console.log(`📦 Cartas en mazo: ${state.mazoColores.length}`);
    console.log(`⭐ Cartas especiales: ${state.mazoEspecial.length}`);
    console.log('💡 Haz clic en "Repartir Cartas" para mostrar 4 cartas visibles');
    console.log('💡 Luego haz clic en una carta visible para agregarla a tu mano');
}

document.addEventListener('DOMContentLoaded', init);

// CERRAR ZOOM CON CLICK FUERA
document.addEventListener('click', function(event) {
    const modal = document.getElementById('zoomModal');
    if (!modal) return;
    if (event.target === modal) {
        cerrarZoom();
    }
});

// CERRAR ZOOM CON ESC
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        cerrarZoom();
    }
});

export { repartirCartas, reiniciarTablero };