// ============================================
// MAZOS Y TABLERO
// ============================================

import { COLORES, state } from './config-state.js';
import { mezclarArray, mostrarMensaje } from './utils.js';
import { abrirZoomJugador, abrirZoomVisible } from './zoom.js';

// MAZOS
export function generarMazos() {
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
    state.mazoColores = mezclarArray(mazoColoresTemp);

    const mazoEspecialTemp = [];
    for (let i = 1; i <= 9; i++) {
        mazoEspecialTemp.push({
            id: `especial-${i}`,
            tipo: 'especial',
            numero: i,
            imagen: `Imagenes/Especial/Especial${i}.png`
        });
    }
    state.mazoEspecial = mezclarArray(mazoEspecialTemp);

    state.cartasVisibles = Array(4).fill(null);
    state.cartasJugador = Array(4).fill(null);
    state.cartasRepartidas = false;
    
    COLORES.forEach(color => {
        state.tableroGlobal[color] = Array(6).fill(false);
        state.fichas[color] = 0;
    });
}

// RENDERIZAR TABLERO
export function renderBoard() {
    const boardElement = document.getElementById('game-board');
    if (!boardElement) return;
    boardElement.innerHTML = '';
    
    COLORES.forEach(color => {
        const rowDiv = document.createElement('div');
        rowDiv.className = `row ${color}`;
        rowDiv.dataset.color = color;
        
        for (let i = 0; i < 6; i++) {
            const box = document.createElement('div');
            box.className = 'box';
            box.textContent = i + 1;
            box.dataset.color = color;
            box.dataset.index = i;
            
            // Verificar si la ficha está en esta casilla (posición 0 = casilla 1)
            const fichaPos = state.fichas[color] || 0;
            if (i === fichaPos) {
                box.classList.add('ficha-actual');
                
                // Ficha más grande y centrada
                const fichaIndicador = document.createElement('div');
                fichaIndicador.className = 'ficha-indicador';
                fichaIndicador.style.cssText = `
                    position: absolute;
                    width: 70%;
                    height: 70%;
                    border-radius: 50%;
                    background: ${getColorFicha(color)};
                    box-shadow: 0 0 20px ${getColorFicha(color)};
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    border: 2px solid rgba(255,255,255,0.3);
                    animation: pulse-ficha 1.5s ease-in-out infinite;
                    z-index: 2;
                `;
                box.appendChild(fichaIndicador);
            }
            
            // Si la casilla está marcada (completada), mostrar check
            if (state.tableroGlobal[color] && state.tableroGlobal[color][i]) {
                box.classList.add('marcada-tablero');
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

// Función para obtener color de ficha (más oscuro que el color de la fila)
function getColorFicha(color) {
    const colores = {
        celeste: '#0288d1',    // Azul oscuro
        lima: '#33691e',       // Verde oscuro
        naranja: '#e65100',    // Naranja oscuro
        purpura: '#4a148c',    // Púrpura oscuro
        rosa: '#880e4f'        // Rosa oscuro
    };
    return colores[color] || '#333';
}

// RENDERIZAR CARTAS VISIBLES
export function renderCartasVisibles() {
    const container = document.getElementById('cartas-visibles-container');
    if (!container) return;
    
    const cartasElements = container.querySelectorAll('.carta-visible');
    
    state.cartasVisibles.forEach((carta, index) => {
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

// RENDERIZAR CARTAS DEL JUGADOR
export function renderCartasJugador() {
    const container = document.getElementById('jugador-cartas-container');
    if (!container) return;
    
    const cartasElements = container.querySelectorAll('.carta-jugador');
    
    state.cartasJugador.forEach((carta, index) => {
        const div = cartasElements[index];
        if (!div) return;
        
        div.innerHTML = '';
        div.className = 'carta-jugador';
        div.dataset.index = index;
        
        if (carta) {
            if (!state.tableroGlobal[carta.color]) {
                state.tableroGlobal[carta.color] = Array(6).fill(false);
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
            
            // Progreso de la carta
            const key = `${carta.color}-${carta.numero}`;
            const progreso = state.progresoCarta[key] || 0;
            
            const progressDiv = document.createElement('div');
            progressDiv.className = 'carta-progreso';
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
            
            if (progreso === 3) {
                div.style.borderColor = '#4caf50';
                div.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.2)';
                div.title = '¡Carta completada!';
            } else if (progreso > 0) {
                div.style.borderColor = '#ffb74d';
                div.style.boxShadow = '0 0 10px rgba(255, 183, 77, 0.2)';
                div.title = `Progreso: ${progreso}/3`;
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

// ACTUALIZACIÓN VISUAL
export function updateVisuals() {
    // Actualizar contadores
    const mazoColoresCount = document.getElementById('mazo-colores-count');
    const mazoEspecialCount = document.getElementById('mazo-especial-count');
    const marcadasCount = document.getElementById('marcadas-count');
    const estadoJuego = document.getElementById('estado-juego');
    
    if (mazoColoresCount) mazoColoresCount.textContent = state.mazoColores.length;
    if (mazoEspecialCount) mazoEspecialCount.textContent = state.mazoEspecial.length;
    
    let totalMarcadas = 0;
    COLORES.forEach(color => {
        if (state.tableroGlobal[color]) {
            totalMarcadas += state.tableroGlobal[color].filter(v => v).length;
        }
    });
    if (marcadasCount) marcadasCount.textContent = totalMarcadas;
    
    if (estadoJuego) {
        estadoJuego.textContent = state.cartasRepartidas ? 'En juego' : 'Esperando';
        estadoJuego.style.color = state.cartasRepartidas ? '#4fc3f7' : '#f06292';
    }
}

// MANEJADOR DE CLICK EN TABLERO
export function handleBoxClick(color, index) {
    // No se permite marcar directamente desde el tablero
    const fichaPos = state.fichas[color] || 0;
    console.warn(`Ficha de ${color} está en casilla ${fichaPos}`);
}