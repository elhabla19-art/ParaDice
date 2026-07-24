// Configuracion de colores
const COLORES = ['celeste', 'lima', 'naranja', 'purpura', 'rosa'];
const COLORES_ESPANOL = {
    celeste: 'Celeste',
    lima: 'Lima',
    naranja: 'Naranja',
    purpura: 'Purpura',
    rosa: 'Rosa'
};

// Estado del juego local
let moveHistory = [];
let myTotalScore = 0;
let mazoColores = [];
let mazoEspecial = [];
let cartasVisibles = [];
let cartasJugador = [];
let almacen = {};
let cartasRepartidas = false;
let cartaSeleccionada = null;
let tableroGlobal = {};
let zoomModo = 'jugador';

// --- SISTEMA MULTIJUGADOR MQTT ---
let mqttClient = null;
let myId = Math.random().toString(36).substr(2, 9);
let currentRoom = null;
let playersData = {};
let myName = "Jugador";

// Inicializar almacen y tablero global
function initAlmacen() {
    COLORES.forEach(color => {
        almacen[color] = Array(6).fill(null);
        if (!tableroGlobal[color]) {
            tableroGlobal[color] = Array(6).fill(false);
        }
    });
}
initAlmacen();

// Generar mazos
function generarMazos() {
    const mazoColoresTemp = [];
    COLORES.forEach(color => {
        for (let i = 1; i <= 9; i++) {
            const nombreCarpeta = color.charAt(0).toUpperCase() + color.slice(1);
            mazoColoresTemp.push({
                id: `${color}-${i}`,
                color: color,
                numero: i,
                tipo: 'color',
                imagen: `Imagenes/${nombreCarpeta}/${color}${i}.png`
            });
        }
    });
    mazoColores = mezclarArray(mazoColoresTemp);

    const mazoEspecialTemp = [];
    for (let i = 1; i <= 9; i++) {
        mazoEspecialTemp.push({
            id: `especial-${i}`,
            tipo: 'especial',
            numero: i,
            imagen: `Imagenes/Especial/Especial${i}.png`
        });
    }
    mazoEspecial = mezclarArray(mazoEspecialTemp);

    cartasVisibles = Array(4).fill(null);
    cartasJugador = Array(4).fill(null);
    cartasRepartidas = false;
    
    COLORES.forEach(color => {
        tableroGlobal[color] = Array(6).fill(false);
    });
}

function mezclarArray(array) {
    const copia = [...array];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

// Obtener la columna de una carta (siempre 1, 2, 3)
function getCasillasCarta(carta) {
    if (!carta) return null;
    // Las casillas de una carta son siempre 1, 2, 3 (independientemente del número)
    return [1, 2, 3];
}

// Verificar si una carta está completada (las 3 casillas marcadas)
function isCartaCompletada(carta) {
    if (!carta) return false;
    const color = carta.color;
    if (!tableroGlobal[color]) return false;
    
    // Buscar si hay una casilla en el tablero que corresponda a esta carta
    // Cada carta completada marca UNA casilla en el tablero
    // Usamos el número de la carta para determinar qué casilla marcar
    const casillaIndex = carta.numero - 1; // 0-8, pero solo tenemos 6 casillas
    // Si el número es > 6, se usa el módulo
    const indexReal = casillaIndex % 6;
    return tableroGlobal[color][indexReal] === true;
}

// Verificar si se puede completar una carta (no está completada aún)
function puedeCompletarCarta(carta) {
    if (!carta) return false;
    return !isCartaCompletada(carta);
}

// Renderizar el almacen
function renderBoard() {
    const boardElement = document.getElementById('game-board');
    boardElement.innerHTML = '';
    
    COLORES.forEach(color => {
        const rowDiv = document.createElement('div');
        rowDiv.className = `row ${color}`;
        
        for (let i = 0; i < 6; i++) {
            const box = document.createElement('div');
            box.className = 'box';
            box.textContent = i + 1;
            box.dataset.color = color;
            box.dataset.index = i;
            
            if (tableroGlobal[color] && tableroGlobal[color][i]) {
                box.classList.add('marked');
            }
            
            box.addEventListener('click', () => handleBoxClick(color, i));
            rowDiv.appendChild(box);
        }
        
        boardElement.appendChild(rowDiv);
    });
    
    renderCartasVisibles();
    renderCartasJugador();
    updateVisuals();
}

function renderCartasVisibles() {
    const container = document.getElementById('cartas-visibles-container');
    if (!container) return;
    
    const cartasElements = container.querySelectorAll('.carta-visible');
    
    cartasVisibles.forEach((carta, index) => {
        const div = cartasElements[index];
        if (!div) return;
        
        div.innerHTML = '';
        div.className = 'carta-visible';
        div.dataset.index = index;
        
        if (carta) {
            const img = document.createElement('img');
            img.src = carta.imagen || '';
            img.alt = `Carta ${index+1}`;
            img.draggable = false;
            img.onerror = function() {
                this.style.display = 'none';
                div.textContent = `${carta.color || 'Especial'} ${carta.numero || ''}`;
                div.style.fontSize = '0.7rem';
                div.style.textAlign = 'center';
                div.style.color = '#888';
            };
            div.appendChild(img);
            div.style.background = 'rgba(255,255,255,0.1)';
            div.style.borderColor = '#4fc3f7';
            div.style.cursor = 'pointer';
            div.addEventListener('click', () => abrirZoomVisible(carta, index));
        } else {
            div.textContent = 'Vacío';
            div.style.color = '#555';
            div.style.fontSize = '0.7rem';
            div.classList.add('vacia');
            div.style.cursor = 'default';
        }
    });
}

function renderCartasJugador() {
    const container = document.getElementById('jugador-cartas-container');
    if (!container) return;
    
    const cartasElements = container.querySelectorAll('.carta-jugador');
    
    cartasJugador.forEach((carta, index) => {
        const div = cartasElements[index];
        if (!div) return;
        
        div.innerHTML = '';
        div.className = 'carta-jugador';
        div.dataset.index = index;
        
        if (carta) {
            if (!tableroGlobal[carta.color]) {
                tableroGlobal[carta.color] = Array(6).fill(false);
            }
            
            const img = document.createElement('img');
            img.src = carta.imagen || '';
            img.alt = `Carta jugador ${index+1}`;
            img.draggable = false;
            img.onerror = function() {
                this.style.display = 'none';
                div.textContent = `${carta.color || 'Especial'} ${carta.numero || ''}`;
                div.style.fontSize = '0.7rem';
                div.style.textAlign = 'center';
                div.style.color = '#888';
            };
            div.appendChild(img);
            div.style.background = 'rgba(255,255,255,0.1)';
            div.style.borderColor = '#ffb74d';
            div.style.cursor = 'pointer';
            
            // Verificar si la carta está completada
            const completada = isCartaCompletada(carta);
            
            // Mostrar progreso (siempre 0/3, 1/3, 2/3 o 3/3)
            // Para saber el progreso, necesitamos un estado local de la carta
            // Usamos un objeto para almacenar el progreso de cada carta
            if (!window.progresoCarta) {
                window.progresoCarta = {};
            }
            const key = `${carta.color}-${carta.numero}`;
            if (!window.progresoCarta[key]) {
                window.progresoCarta[key] = 0;
            }
            
            const progressDiv = document.createElement('div');
            progressDiv.className = 'carta-progreso';
            const progreso = window.progresoCarta[key] || 0;
            progressDiv.textContent = progreso === 3 ? '✓' : `${progreso}/3`;
            progressDiv.style.cssText = `
                position: absolute;
                bottom: 4px;
                right: 4px;
                font-size: 0.6rem;
                color: ${progreso === 3 ? '#4caf50' : '#888'};
                background: rgba(0,0,0,0.8);
                padding: 1px 6px;
                border-radius: 10px;
                font-weight: bold;
                pointer-events: none;
            `;
            div.style.position = 'relative';
            div.appendChild(progressDiv);
            
            if (completada) {
                div.style.borderColor = '#4caf50';
                div.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.2)';
                div.title = '¡Carta completada!';
            } else if (progreso > 0) {
                div.style.borderColor = '#ffb74d';
                div.style.boxShadow = '0 0 10px rgba(255, 183, 77, 0.2)';
                div.title = `Progreso: ${progreso}/3`;
            } else {
                div.style.borderColor = '#ffb74d';
                div.title = 'Click para completar';
            }
            
            div.addEventListener('click', () => abrirZoomJugador(carta));
        } else {
            div.textContent = 'Vacío';
            div.style.color = '#555';
            div.style.fontSize = '0.7rem';
            div.classList.add('vacia');
            div.style.cursor = 'default';
        }
    });
}

// ============ 3 VISTAS DE ZOOM ============

// 1. ZOOM PARA CARTAS VISIBLES - Muestra "Agregar"
function abrirZoomVisible(carta, indexVisible) {
    const modal = document.getElementById('zoomModal');
    const img = document.getElementById('zoomImage');
    const text = document.getElementById('zoomText');
    const casillasContainer = document.getElementById('zoomCasillas');
    const zoomAcciones = document.getElementById('zoomAcciones');
    
    if (!modal || !img || !text || !casillasContainer) return;
    
    zoomModo = 'visible';
    cartaSeleccionada = carta;
    
    img.src = carta.imagen || '';
    img.alt = `Carta ${carta.color || 'Especial'} ${carta.numero || ''}`;
    img.onerror = function() {
        this.style.display = 'none';
        text.textContent = `${carta.color ? COLORES_ESPANOL[carta.color] : 'Especial'} - Número ${carta.numero || ''}`;
    };
    img.style.display = 'block';
    
    text.textContent = `${carta.color ? COLORES_ESPANOL[carta.color] : 'Especial'} - Número ${carta.numero || ''}`;
    
    casillasContainer.innerHTML = '';
    zoomAcciones.innerHTML = '';
    
    // Mostrar las casillas 1, 2, 3 (siempre)
    for (let i = 1; i <= 3; i++) {
        const casillaDiv = document.createElement('div');
        casillaDiv.className = '';
        casillaDiv.textContent = i;
        casillaDiv.style.cssText = `
            width: 50px;
            height: 50px;
            background: rgba(255,255,255,0.1);
            border: 2px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 1.2rem;
            font-weight: bold;
            color: #fff;
            cursor: default;
            transition: all 0.2s;
        `;
        casillasContainer.appendChild(casillaDiv);
    }
    
    // Botón Agregar
    const btnAgregar = document.createElement('button');
    btnAgregar.style.cssText = `
        background: #4caf50;
        color: white;
        border: none;
        padding: 10px 25px;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        width: 100%;
        margin-top: 10px;
    `;
    btnAgregar.textContent = '➕ Agregar a Tus Cartas';
    btnAgregar.onmouseenter = function() {
        this.style.transform = 'scale(1.05)';
        this.style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.3)';
    };
    btnAgregar.onmouseleave = function() {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = 'none';
    };
    btnAgregar.onclick = function() {
        agregarCartaAJugador(indexVisible);
    };
    casillasContainer.appendChild(btnAgregar);
    
    modal.style.display = 'flex';
}

// 2. ZOOM PARA CARTAS DEL JUGADOR - Muestra casillas 1, 2, 3 para llenar
function abrirZoomJugador(carta) {
    const modal = document.getElementById('zoomModal');
    const img = document.getElementById('zoomImage');
    const text = document.getElementById('zoomText');
    const casillasContainer = document.getElementById('zoomCasillas');
    const zoomAcciones = document.getElementById('zoomAcciones');
    
    if (!modal || !img || !text || !casillasContainer) return;
    
    zoomModo = 'jugador';
    cartaSeleccionada = carta;
    
    img.src = carta.imagen || '';
    img.alt = `Carta ${carta.color || 'Especial'} ${carta.numero || ''}`;
    img.onerror = function() {
        this.style.display = 'none';
        text.textContent = `${carta.color ? COLORES_ESPANOL[carta.color] : 'Especial'} - Número ${carta.numero || ''}`;
    };
    img.style.display = 'block';
    
    text.textContent = `${carta.color ? COLORES_ESPANOL[carta.color] : 'Especial'} - Número ${carta.numero || ''}`;
    
    casillasContainer.innerHTML = '';
    zoomAcciones.innerHTML = '';
    
    // Obtener progreso de esta carta
    const key = `${carta.color}-${carta.numero}`;
    if (!window.progresoCarta) {
        window.progresoCarta = {};
    }
    if (!window.progresoCarta[key]) {
        window.progresoCarta[key] = 0;
    }
    const progresoActual = window.progresoCarta[key];
    const completada = isCartaCompletada(carta);
    
    // Mostrar las casillas 1, 2, 3 (siempre)
    for (let i = 1; i <= 3; i++) {
        const estaMarcada = i <= progresoActual;
        
        const casillaDiv = document.createElement('div');
        casillaDiv.className = estaMarcada ? 'marcada' : '';
        casillaDiv.textContent = estaMarcada ? `${i} ✓` : i;
        casillaDiv.style.cssText = `
            width: 50px;
            height: 50px;
            background: ${estaMarcada ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.1)'};
            border: 2px solid ${estaMarcada ? '#4caf50' : 'rgba(255,255,255,0.2)'};
            border-radius: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 1.2rem;
            font-weight: bold;
            color: ${estaMarcada ? '#4caf50' : '#fff'};
            cursor: ${estaMarcada || completada ? 'default' : 'pointer'};
            transition: all 0.2s;
            box-shadow: ${estaMarcada ? '0 0 15px rgba(76, 175, 80, 0.3)' : 'none'};
        `;
        
        if (!estaMarcada && !completada) {
            casillaDiv.onmouseenter = function() {
                this.style.background = 'rgba(255,255,255,0.2)';
                this.style.borderColor = '#4caf50';
                this.style.transform = 'scale(1.05)';
            };
            casillaDiv.onmouseleave = function() {
                this.style.background = 'rgba(255,255,255,0.1)';
                this.style.borderColor = 'rgba(255,255,255,0.2)';
                this.style.transform = 'scale(1)';
            };
            casillaDiv.onclick = function() {
                marcarCasillaCarta(carta, i);
            };
        }
        
        casillasContainer.appendChild(casillaDiv);
    }
    
    // Mostrar estado
    const infoDiv = document.createElement('div');
    infoDiv.className = progresoActual === 3 ? 'completo' : 'contador';
    infoDiv.textContent = progresoActual === 3 ? '✓ Carta completada' : `${progresoActual}/3`;
    infoDiv.style.cssText = `
        text-align: center;
        color: ${progresoActual === 3 ? '#4caf50' : '#666'};
        font-size: ${progresoActual === 3 ? '1rem' : '0.7rem'};
        font-weight: ${progresoActual === 3 ? 'bold' : 'normal'};
        margin-top: 5px;
    `;
    casillasContainer.appendChild(infoDiv);
    
    if (completada) {
        const msg = document.createElement('div');
        msg.style.cssText = `
            color: #4caf50;
            font-size: 0.8rem;
            text-align: center;
            margin-top: 3px;
        `;
        msg.textContent = '✅ Ya completaste esta carta';
        casillasContainer.appendChild(msg);
    }
    
    modal.style.display = 'flex';
}

// 3. ZOOM PARA LEADERBOARD - Solo vista, sin interacción
function abrirZoomLeaderboard(carta, playerName, jugadorId) {
    const modal = document.getElementById('zoomModal');
    const img = document.getElementById('zoomImage');
    const text = document.getElementById('zoomText');
    const casillasContainer = document.getElementById('zoomCasillas');
    const zoomAcciones = document.getElementById('zoomAcciones');
    
    if (!modal || !img || !text || !casillasContainer) return;
    
    zoomModo = 'leaderboard';
    cartaSeleccionada = carta;
    
    img.src = carta.imagen || '';
    img.alt = `Carta ${carta.color || 'Especial'} ${carta.numero || ''}`;
    img.onerror = function() {
        this.style.display = 'none';
        text.textContent = `${carta.color ? COLORES_ESPANOL[carta.color] : 'Especial'} - Número ${carta.numero || ''}`;
    };
    img.style.display = 'block';
    
    text.textContent = `${playerName} - ${carta.color ? COLORES_ESPANOL[carta.color] : 'Especial'} N°${carta.numero || ''}`;
    
    casillasContainer.innerHTML = '';
    zoomAcciones.innerHTML = '';
    
    // Obtener el progreso del jugador para esta carta
    const playerData = playersData[jugadorId];
    const pProgreso = playerData && playerData.progresoCartas ? 
        playerData.progresoCartas[`${carta.color}-${carta.numero}`] || 0 : 0;
    
    // Mostrar las casillas 1, 2, 3 (siempre)
    for (let i = 1; i <= 3; i++) {
        const estaMarcada = i <= pProgreso;
        
        const casillaDiv = document.createElement('div');
        casillaDiv.className = estaMarcada ? 'marcada' : '';
        casillaDiv.textContent = estaMarcada ? `${i} ✓` : i;
        casillaDiv.style.cssText = `
            width: 50px;
            height: 50px;
            background: ${estaMarcada ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.1)'};
            border: 2px solid ${estaMarcada ? '#4caf50' : 'rgba(255,255,255,0.2)'};
            border-radius: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 1.2rem;
            font-weight: bold;
            color: ${estaMarcada ? '#4caf50' : '#fff'};
            cursor: default;
            transition: all 0.2s;
        `;
        casillasContainer.appendChild(casillaDiv);
    }
    
    // Contador
    const infoDiv = document.createElement('div');
    infoDiv.className = pProgreso === 3 ? 'completo' : 'contador';
    infoDiv.textContent = pProgreso === 3 ? '✓ Completada' : `${pProgreso}/3`;
    infoDiv.style.cssText = `
        text-align: center;
        color: ${pProgreso === 3 ? '#4caf50' : '#666'};
        font-size: ${pProgreso === 3 ? '1rem' : '0.7rem'};
        font-weight: ${pProgreso === 3 ? 'bold' : 'normal'};
        margin-top: 5px;
    `;
    casillasContainer.appendChild(infoDiv);
    
    // Mensaje de solo lectura
    const msg = document.createElement('div');
    msg.style.cssText = `
        color: #666;
        font-size: 0.7rem;
        text-align: center;
        margin-top: 5px;
        font-style: italic;
    `;
    msg.textContent = '👁️ Solo vista';
    casillasContainer.appendChild(msg);
    
    modal.style.display = 'flex';
}

// Marcar una casilla de una carta (progreso 1, 2, 3)
function marcarCasillaCarta(carta, casillaNumero) {
    const key = `${carta.color}-${carta.numero}`;
    if (!window.progresoCarta) {
        window.progresoCarta = {};
    }
    if (!window.progresoCarta[key]) {
        window.progresoCarta[key] = 0;
    }
    
    // Solo se puede marcar si es la siguiente en orden (1, luego 2, luego 3)
    if (casillaNumero === window.progresoCarta[key] + 1) {
        window.progresoCarta[key]++;
        const nuevoProgreso = window.progresoCarta[key];
        
        // Si se completó la carta (3/3), marcar UNA casilla en el tablero
        if (nuevoProgreso === 3) {
            // Marcar UNA casilla en el tablero del color correspondiente
            const casillaIndex = (carta.numero - 1) % 6;
            if (!tableroGlobal[carta.color]) {
                tableroGlobal[carta.color] = Array(6).fill(false);
            }
            tableroGlobal[carta.color][casillaIndex] = true;
            
            // Mostrar mensaje de carta completada
            const msg = document.createElement('div');
            msg.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #4caf50;
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                z-index: 9999;
                font-weight: bold;
                animation: slideDown 0.5s ease;
            `;
            msg.textContent = `🎉 ¡Carta ${carta.color} N°${carta.numero} completada!`;
            document.body.appendChild(msg);
            setTimeout(() => { msg.remove(); }, 3000);
            
            // Broadcast del tablero
            if (currentRoom) {
                broadcastTablero();
            }
        }
        
        // Actualizar todo
        updateVisuals();
        calculateScores();
        renderCartasJugador();
        
        // Reabrir zoom con la carta actualizada
        cerrarZoom();
        setTimeout(() => {
            abrirZoomJugador(carta);
        }, 200);
        
        // Broadcast del progreso
        if (currentRoom) {
            broadcastScore('sync');
        }
    } else {
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #d32f2f;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            z-index: 9999;
            font-weight: bold;
            animation: slideDown 0.5s ease;
        `;
        msg.textContent = `Debes marcar en orden: primero ${window.progresoCarta[key] + 1}`;
        document.body.appendChild(msg);
        setTimeout(() => { msg.remove(); }, 3000);
    }
}

// Agregar carta visible a Tus Cartas
function agregarCartaAJugador(indexVisible) {
    const carta = cartasVisibles[indexVisible];
    if (!carta) return;
    
    const emptyIndex = cartasJugador.findIndex(c => c === null);
    if (emptyIndex === -1) {
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #f39c12;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            z-index: 9999;
            font-weight: bold;
            animation: slideDown 0.5s ease;
        `;
        msg.textContent = 'No tienes espacio en Tus Cartas';
        document.body.appendChild(msg);
        setTimeout(() => { msg.remove(); }, 3000);
        return;
    }
    
    cartasJugador[emptyIndex] = carta;
    cartasVisibles[indexVisible] = null;
    
    // Inicializar progreso de la carta
    const key = `${carta.color}-${carta.numero}`;
    if (!window.progresoCarta) {
        window.progresoCarta = {};
    }
    window.progresoCarta[key] = 0;
    
    cerrarZoom();
    renderCartasVisibles();
    renderCartasJugador();
    updateVisuals();
    
    if (currentRoom) {
        broadcastScore('sync');
    }
    
    const msg = document.createElement('div');
    msg.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #4caf50;
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        z-index: 9999;
        font-weight: bold;
        animation: slideDown 0.5s ease;
    `;
    msg.textContent = '✅ Carta agregada a Tus Cartas';
    document.body.appendChild(msg);
    setTimeout(() => { msg.remove(); }, 2000);
}

function cerrarZoom() {
    const modal = document.getElementById('zoomModal');
    const casillasContainer = document.getElementById('zoomCasillas');
    const zoomAcciones = document.getElementById('zoomAcciones');
    if (modal) modal.style.display = 'none';
    if (casillasContainer) casillasContainer.innerHTML = '';
    if (zoomAcciones) zoomAcciones.innerHTML = '';
    cartaSeleccionada = null;
}

function handleBoxClick(color, index) {
    // No se permite marcar directamente desde el tablero
    console.warn('Marca las casillas desde tus cartas');
}

function updateVisuals() {
    COLORES.forEach(color => {
        const rowDiv = document.querySelector(`.row.${color}`);
        if (!rowDiv) return;
        
        const boxes = rowDiv.querySelectorAll('.box');
        
        boxes.forEach((box, index) => {
            const estaMarcada = tableroGlobal[color] && tableroGlobal[color][index];
            box.classList.remove('marked', 'disabled', 'last-marked');
            if (estaMarcada) {
                box.classList.add('marked');
                box.classList.add('last-marked');
            }
        });
    });
    
    const mazoColoresCount = document.getElementById('mazo-colores-count');
    const mazoEspecialCount = document.getElementById('mazo-especial-count');
    const marcadasCount = document.getElementById('marcadas-count');
    const estadoJuego = document.getElementById('estado-juego');
    
    if (mazoColoresCount) mazoColoresCount.textContent = mazoColores.length;
    if (mazoEspecialCount) mazoEspecialCount.textContent = mazoEspecial.length;
    
    let totalMarcadas = 0;
    COLORES.forEach(color => {
        if (tableroGlobal[color]) {
            totalMarcadas += tableroGlobal[color].filter(v => v).length;
        }
    });
    if (marcadasCount) marcadasCount.textContent = totalMarcadas;
    
    if (estadoJuego) {
        estadoJuego.textContent = cartasRepartidas ? 'En juego' : 'Esperando';
        estadoJuego.style.color = cartasRepartidas ? '#4fc3f7' : '#f06292';
    }
}

function calculateScores() {
    let totalScore = 0;
    
    COLORES.forEach(color => {
        if (tableroGlobal[color]) {
            const count = tableroGlobal[color].filter(v => v).length;
            totalScore += count * 2; // 2 puntos por cada casilla marcada
        }
    });
    
    myTotalScore = totalScore;

    const scoreTotal = document.getElementById('score-total');
    if (scoreTotal) {
        scoreTotal.textContent = totalScore;
    }

    if (currentRoom) {
        playersData[myId] = {
            name: myName,
            score: myTotalScore,
            cartasJugador: cartasJugador,
            mazoColores: mazoColores,
            cartasRepartidas: cartasRepartidas,
            tablero: tableroGlobal,
            progresoCartas: window.progresoCarta || {}
        };
        renderLeaderboard();
    }
}

function repartirCartas() {
    if (cartasRepartidas) {
        console.warn('Ya se repartieron las cartas');
        return;
    }
    
    if (mazoColores.length < 5) {
        console.warn('No hay suficientes cartas en el mazo');
        return;
    }
    
    const jugadores = Object.keys(playersData);
    if (jugadores.length === 0 || (jugadores.length === 1 && jugadores[0] === myId)) {
        const cartaJugador = mazoColores.pop();
        cartasJugador[0] = cartaJugador;
        const key = `${cartaJugador.color}-${cartaJugador.numero}`;
        if (!window.progresoCarta) window.progresoCarta = {};
        window.progresoCarta[key] = 0;
    } else {
        jugadores.forEach((id, index) => {
            if (index < 4 && mazoColores.length > 0) {
                const carta = mazoColores.pop();
                if (id === myId) {
                    cartasJugador[index] = carta;
                    const key = `${carta.color}-${carta.numero}`;
                    if (!window.progresoCarta) window.progresoCarta = {};
                    window.progresoCarta[key] = 0;
                }
                if (!playersData[id]) {
                    playersData[id] = { name: 'Jugador', cartasJugador: [] };
                }
                if (!playersData[id].cartasJugador) {
                    playersData[id].cartasJugador = [];
                }
                playersData[id].cartasJugador[index] = carta;
            }
        });
    }
    
    const nuevasVisibles = [];
    for (let i = 0; i < 4; i++) {
        nuevasVisibles.push(mazoColores.pop());
    }
    cartasVisibles = nuevasVisibles;
    cartasRepartidas = true;
    
    COLORES.forEach(color => {
        tableroGlobal[color] = Array(6).fill(false);
    });
    
    renderCartasVisibles();
    renderCartasJugador();
    updateVisuals();
    calculateScores();
    
    if (currentRoom) {
        broadcastTablero();
        broadcastScore('repartir');
    }
    
    console.log('Cartas repartidas correctamente');
}

function reiniciarTablero() {
    COLORES.forEach(color => {
        tableroGlobal[color] = Array(6).fill(false);
    });
    window.progresoCarta = {};
    updateVisuals();
    calculateScores();
    renderCartasJugador();
    if (currentRoom) {
        broadcastTablero();
    }
    console.log('Tablero reiniciado');
}

function broadcastTablero() {
    if (mqttClient && currentRoom) {
        const topic = `paradice_xyz/room/${currentRoom}`;
        const payload = JSON.stringify({
            action: 'tablero',
            id: myId,
            tablero: tableroGlobal
        });
        mqttClient.publish(topic, payload);
    }
}

function toggleLeaderboard() {
    const content = document.getElementById('leaderboardContent');
    const icon = document.getElementById('toggleIcon');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▲';
    } else {
        content.style.display = 'none';
        icon.textContent = '▼';
    }
}

// --- FUNCIONES MQTT ---
function getPlayerName() {
    let name = document.getElementById('playerName').value.trim();
    return name || "Jugador " + Math.floor(Math.random() * 100);
}

function playSolo() {
    myName = getPlayerName();
    document.getElementById('lobbyModal').style.display = 'none';
    window.progresoCarta = {};
    playersData[myId] = {
        name: myName,
        score: 0,
        cartasJugador: [],
        mazoColores: [],
        cartasRepartidas: false,
        tablero: tableroGlobal,
        progresoCartas: {}
    };
    generarMazos();
    renderBoard();
    updateVisuals();
    calculateScores();
    document.getElementById('leaderboardPanel').style.display = 'flex';
    renderLeaderboard();
}

function showJoinModal() {
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('joinModal').style.display = 'flex';
}

function backToLobby() {
    document.getElementById('joinModal').style.display = 'none';
    document.getElementById('lobbyModal').style.display = 'flex';
}

function createRoom() {
    myName = getPlayerName();
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    connectToRoom(code);
}

function joinRoom() {
    myName = getPlayerName();
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (code.length !== 4) {
        alert("El codigo debe tener 4 letras/numeros.");
        return;
    }
    connectToRoom(code);
}

function connectToRoom(code) {
    showLoading("Conectando con la sala...");
    
    mqttClient = mqtt.connect('wss://broker.hivemq.com:8884/mqtt');

    mqttClient.on('connect', () => {
        currentRoom = code;
        const topic = `paradice_xyz/room/${code}`;
        mqttClient.subscribe(topic);
        
        window.progresoCarta = {};
        generarMazos();
        renderBoard();
        updateVisuals();
        calculateScores();
        
        playersData[myId] = {
            name: myName,
            score: myTotalScore,
            cartasJugador: cartasJugador,
            mazoColores: mazoColores,
            cartasRepartidas: cartasRepartidas,
            tablero: tableroGlobal,
            progresoCartas: {}
        };
        
        joinSuccess(code);
        broadcastScore('join');
    });

    mqttClient.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.id === myId) return;

            if (data.action === 'tablero' && data.tablero) {
                tableroGlobal = data.tablero;
                updateVisuals();
                calculateScores();
                renderCartasJugador();
                renderLeaderboard();
                return;
            }

            playersData[data.id] = {
                name: data.name,
                score: data.score || 0,
                cartasJugador: data.cartasJugador || [],
                mazoColores: data.mazoColores || [],
                cartasRepartidas: data.cartasRepartidas || false,
                tablero: data.tablero || tableroGlobal,
                progresoCartas: data.progresoCartas || {}
            };
            renderLeaderboard();

            if (data.action === 'join') {
                setTimeout(() => {
                    broadcastTablero();
                }, 500);
                broadcastScore('sync');
            }
            
            if (data.action === 'repartir') {
                cartasVisibles = data.cartasVisibles || cartasVisibles;
                mazoColores = data.mazoColores || mazoColores;
                cartasRepartidas = data.cartasRepartidas || false;
                if (data.cartasJugador && data.cartasJugador.length > 0) {
                    cartasJugador = data.cartasJugador;
                }
                renderCartasVisibles();
                renderCartasJugador();
                updateVisuals();
            }
        } catch(e) {
            console.error("Mensaje invalido", e);
        }
    });

    mqttClient.on('error', (err) => {
        hideLoading();
        alert("Error de red. Revisa tu internet.");
    });
}

function broadcastScore(action = 'sync') {
    if (mqttClient && currentRoom) {
        const topic = `paradice_xyz/room/${currentRoom}`;
        const payload = JSON.stringify({
            action: action,
            id: myId,
            name: myName,
            score: myTotalScore,
            cartasJugador: cartasJugador,
            mazoColores: mazoColores,
            cartasRepartidas: cartasRepartidas,
            tablero: tableroGlobal,
            progresoCartas: window.progresoCarta || {},
            cartasVisibles: cartasVisibles
        });
        mqttClient.publish(topic, payload);
    }
}

function joinSuccess(code) {
    hideLoading();
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('joinModal').style.display = 'none';
    
    const info = document.getElementById('roomInfoDisplay');
    info.style.display = 'inline-block';
    info.textContent = 'SALA: ' + code;
    
    document.getElementById('leaderboardPanel').style.display = 'flex';
    renderLeaderboard();
}

function renderLeaderboard() {
    const list = document.getElementById('playersList');
    list.innerHTML = '';
    
    const playersArr = Object.keys(playersData).map(id => ({
        id: id,
        ...playersData[id]
    })).sort((a, b) => (b.score || 0) - (a.score || 0));

    playersArr.forEach(p => {
        const isMe = p.id === myId;
        const card = document.createElement('div');
        card.className = 'player-card ' + (isMe ? 'me' : '');
        
        let cartasHtml = '<div class="mini-cartas-jugador">';
        const pCartas = p.cartasJugador || [];
        const pProgreso = p.progresoCartas || {};
        
        if (pCartas.length === 0 || pCartas.every(c => c === null)) {
            cartasHtml += '<span class="mini-carta vacia">Sin cartas</span>';
        } else {
            pCartas.forEach((carta, idx) => {
                if (carta) {
                    const key = `${carta.color}-${carta.numero}`;
                    const progreso = pProgreso[key] || 0;
                    const isCompleta = progreso === 3;
                    
                    const colorAbr = carta.color ? carta.color.substring(0,2) : 'E';
                    
                    cartasHtml += `
                        <div class="mini-carta-jugador" 
                             onclick="abrirZoomLeaderboardDesdeCard('${p.id}', ${idx})"
                             style="cursor:pointer; border: 1px solid ${isCompleta ? '#4caf50' : '#555'}; 
                                    padding: 4px 6px; border-radius: 4px; background: rgba(255,255,255,0.05);
                                    min-width: 40px; text-align: center;">
                            <div style="font-size:0.65rem; font-weight:bold;">${colorAbr}${carta.numero || ''}</div>
                            <div style="display:flex; gap:2px; justify-content:center; margin-top:2px;">
                                ${[1, 2, 3].map(i => `
                                    <span style="
                                        display:inline-block;
                                        width:12px;
                                        height:12px;
                                        border-radius:2px;
                                        background: ${i <= progreso ? '#4caf50' : 'rgba(255,255,255,0.2)'};
                                        border: 1px solid ${i <= progreso ? '#4caf50' : 'rgba(255,255,255,0.1)'};
                                        font-size:6px;
                                        text-align:center;
                                        color:${i <= progreso ? 'white' : 'transparent'};
                                    ">${i <= progreso ? '✓' : ''}</span>
                                `).join('')}
                            </div>
                            <div style="font-size:0.5rem; color:${isCompleta ? '#4caf50' : '#888'}; margin-top:1px;">
                                ${progreso}/3
                            </div>
                        </div>
                    `;
                } else {
                    cartasHtml += '<span class="mini-carta vacia">-</span>';
                }
            });
        }
        cartasHtml += '</div>';

        card.innerHTML = 
            '<div class="player-card-header">' +
                '<span>' + p.name + (isMe ? ' (Tu)' : '') + '</span>' +
                '<span>' + (p.score || 0) + ' pts</span>' +
            '</div>' +
            '<div class="mini-info">' +
                '<span>Mazo: ' + (p.mazoColores ? p.mazoColores.length : 0) + '</span>' +
                '<span>' + (p.cartasRepartidas ? 'Repartido' : 'Esperando') + '</span>' +
            '</div>' +
            cartasHtml;
        
        list.appendChild(card);
    });
}

// Función para abrir zoom desde leaderboard
function abrirZoomLeaderboardDesdeCard(playerId, cartaIndex) {
    const player = playersData[playerId];
    if (!player || !player.cartasJugador || !player.cartasJugador[cartaIndex]) {
        return;
    }
    const carta = player.cartasJugador[cartaIndex];
    abrirZoomLeaderboard(carta, player.name, playerId);
}

// --- UTILIDADES ---
function showLoading(text) {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingModal').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingModal').style.display = 'none';
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.progresoCarta = {};
    generarMazos();
    renderBoard();
    updateVisuals();
    calculateScores();
    if (window.innerWidth <= 768) {
        document.getElementById('leaderboardContent').style.display = 'none';
        document.getElementById('toggleIcon').textContent = '▼';
    }
});

// Exponer funciones globalmente
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
window.agregarCartaAJugador = agregarCartaAJugador;
window.marcarCasillaCarta = marcarCasillaCarta;