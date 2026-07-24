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
    tableroGlobal: {},
    progresoCarta: {},
    zoomModo: 'jugador',
    
    // MQTT
    mqttClient: null,
    myId: Math.random().toString(36).substr(2, 9),
    currentRoom: null,
    playersData: {},
    myName: 'Jugador'
};

// Inicializar almacen y tablero
export function initState() {
    COLORES.forEach(color => {
        state.almacen[color] = Array(6).fill(null);
        if (!state.tableroGlobal[color]) {
            state.tableroGlobal[color] = Array(6).fill(false);
        }
    });
    state.progresoCarta = {};
}