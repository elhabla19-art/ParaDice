// ============================================
// CONFIGURACIÓN Y ESTADO GLOBAL
// ============================================

// Colores disponibles
export const COLORES = ['celeste', 'lima', 'naranja', 'purpura', 'rosa'];

export const COLORES_ESPANOL = {
    celeste: 'Celeste',
    lima: 'Lima',
    naranja: 'Naranja',
    purpura: 'Purpura',
    rosa: 'Rosa'
};

export const COLORES_HEX = {
    celeste: '#4fc3f7',
    lima: '#aed581',
    naranja: '#ffb74d',
    purpura: '#ce93d8',
    rosa: '#f06292'
};

// Puntajes por carta [número de carta] = puntaje
export const PUNTAJES = {
    celeste: [15, 15, 10, 15, 20, 20, 20, 10, 20],
    lima: [20, 10, 15, 20, 10, 10, 20, 15, 15],
    naranja: [15, 15, 10, 10, 20, 20, 20, 15, 10],
    purpura: [10, 20, 15, 20, 20, 15, 10, 15, 10],
    rosa: [15, 15, 10, 10, 10, 20, 20, 15, 20]
};

// Estado del juego
export const state = {
    // Estado local
    moveHistory: [],
    myTotalScore: 0,
    mazoColores: [],
    mazoEspecial: [],
    cartasVisibles: [],
    cartasJugador: [],
    almacen: {},
    cartasRepartidas: false,
    cartaSeleccionada: null,
    
    // Tablero: cada color tiene una ficha en una posición (0-5)
    fichas: {},
    tableroGlobal: {},
    
    // Progreso de cartas
    progresoCarta: {},
    zoomModo: 'jugador',
    
    // MQTT
    mqttClient: null,
    myId: Math.random().toString(36).substr(2, 9),
    currentRoom: null,
    playersData: {},
    myName: 'Jugador'
};

// Inicializar estado
export function initState() {
    COLORES.forEach(color => {
        state.almacen[color] = Array(6).fill(null);
        state.tableroGlobal[color] = Array(6).fill(false);
        state.fichas[color] = 0; // Empieza en casilla 1 (índice 0)
    });
    state.progresoCarta = {};
}