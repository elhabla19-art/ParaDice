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
    celeste: '#087CAB',
    lima: '#80BA27',
    naranja: '#E85418',
    purpura: '#78326E',
    rosa: '#E23B8B'
};

// Puntajes por carta [número de carta] = puntaje
export const PUNTAJES = {
    celeste: [15, 15, 10, 15, 20, 20, 20, 10, 20],
    lima: [20, 10, 15, 20, 10, 10, 20, 15, 15],
    naranja: [15, 15, 10, 10, 20, 20, 20, 15, 10],
    purpura: [10, 20, 15, 20, 20, 15, 10, 15, 10],
    rosa: [15, 15, 10, 10, 10, 20, 20, 15, 20]
};

// HABILIDADES POR COLOR
export const HABILIDADES = {
    celeste: {
        nombre: 'Escoge Fila',
        descripcion: 'Escoge cualquier fila para jugar',
        icono: '🎯',
        color: '#087CAB'
    },
    lima: {
        nombre: 'Carta Especial',
        descripcion: 'Toma una carta del mazo Especial',
        icono: '🃏',
        color: '#80BA27'
    },
    naranja: {
        nombre: 'Cambia Valor',
        descripcion: 'Cambia el valor de un dado al que desees',
        icono: '🎲',
        color: '#E85418'
    },
    purpura: {
        nombre: 'Cambia Color',
        descripcion: 'Cambia el color de un dado al que desees',
        icono: '🌈',
        color: '#78326E'
    },
    rosa: {
        nombre: 'Escoge Dado',
        descripcion: 'Escoge un dado de cualquier columna',
        icono: '🎯',
        color: '#E23B8B'
    }
};

// CARTAS ESPECIALES
export const CARTAS_ESPECIALES = [
    { id: 'especial-1', tipo: 'mover_ficha', descripcion: 'Mueve ficha 1 paso (adelante/atrás)', icono: '↕️' },
    { id: 'especial-2', tipo: 'mover_ficha', descripcion: 'Mueve ficha 1 paso (adelante/atrás)', icono: '↕️' },
    { id: 'especial-3', tipo: 'turno_extra', descripcion: 'Turno Extra', icono: '⏭️' },
    { id: 'especial-4', tipo: 'recuperar_habilidad', descripcion: 'Recupera un poder ya utilizado', icono: '🔄' },
    { id: 'especial-5', tipo: 'tomar_dado', descripcion: 'Toma cualquier dado de juego', icono: '🎲' },
    { id: 'especial-6', tipo: 'puntos', descripcion: '+5 puntos', icono: '⭐', puntos: 5 },
    { id: 'especial-7', tipo: 'puntos', descripcion: '+5 puntos', icono: '⭐', puntos: 5 },
    { id: 'especial-8', tipo: 'puntos', descripcion: '+5 puntos', icono: '⭐', puntos: 5 },
    { id: 'especial-9', tipo: 'puntos', descripcion: '+10 puntos', icono: '⭐', puntos: 10 }
];

// Tickets
export const TICKETS = {
    celeste: { nombre: 'Ticket Celeste', puntaje: 10 },
    lima: { nombre: 'Ticket Lima', puntaje: 10 },
    naranja: { nombre: 'Ticket Naranja', puntaje: 10 },
    purpura: { nombre: 'Ticket Purpura', puntaje: 10 },
    rosa: { nombre: 'Ticket Rosa', puntaje: 10 },
    bonus: { nombre: 'Ticket Bonus', puntaje: 20 }
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
    cartasTerminadas: [],
    almacen: {},
    cartasRepartidas: false,
    cartaSeleccionada: null,
    
    // Tablero
    fichas: {},
    tableroGlobal: {},
    
    // Progreso de cartas
    progresoCarta: {},
    zoomModo: 'jugador',
    
    // Habilidades usadas
    habilidadesUsadas: {},
    
    // Mazo Especial
    mazoEspecialDisponible: [],
    cartaEspecialActual: null,
    modoEspecial: null, // 'mover_ficha', 'recuperar_habilidad', 'puntos'
    cartasEspecialesUsadas: 0,
    
    // Tickets
    tickets: {},
    bonusTicket: null,
    bonusReclamado: false,
    
    // MQTT
    mqttClient: null,
    myId: Math.random().toString(36).substr(2, 9),
    currentRoom: null,
    playersData: {},
    myName: 'Jugador',

    // FIN DEL JUEGO
    juegoTerminado: false,
    coloresMeta: [],
    resultadosFinales: {}
};

// Inicializar estado
export function initState() {
    COLORES.forEach(color => {
        state.almacen[color] = Array(6).fill(null);
        state.tableroGlobal[color] = Array(6).fill(false);
        state.fichas[color] = 0;
        state.tickets[color] = null;
    });
    state.bonusTicket = null;
    state.bonusReclamado = false;
    state.progresoCarta = {};
    state.cartasJugador = Array(5).fill(null);
    state.cartasTerminadas = [];
    state.habilidadesUsadas = {};
    state.mazoEspecialDisponible = [];
    state.cartaEspecialActual = null;
    state.modoEspecial = null;
    state.cartasEspecialesUsadas = 0;
    state.myTotalScore = 0;
    state.cartasRepartidas = false;
    state.moveHistory = [];
    
    // Reiniciar estado de fin del juego
    state.juegoTerminado = false;
    state.coloresMeta = [];
    state.resultadosFinales = {};
    
    // Inicializar puntosEspeciales para el jugador actual
    if (!state.playersData[state.myId]) {
        state.playersData[state.myId] = {
            name: state.myName,
            score: 0,
            cartasJugador: state.cartasJugador,
            cartasTerminadas: state.cartasTerminadas,
            habilidadesUsadas: state.habilidadesUsadas,
            mazoColores: state.mazoColores,
            mazoEspecialDisponible: state.mazoEspecialDisponible,
            cartasVisibles: state.cartasVisibles,
            cartasRepartidas: false,
            tablero: state.tableroGlobal,
            fichas: state.fichas,
            progresoCartas: state.progresoCarta,
            cartasEspecialesUsadas: 0,
            puntosEspeciales: [] // Array para almacenar los puntos de cartas especiales usadas
        };
    } else {
        state.playersData[state.myId].puntosEspeciales = [];
    }
}