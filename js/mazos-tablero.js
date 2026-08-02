// ============================================
// MAZOS Y TABLERO
// ============================================

import { COLORES, state, CARTAS_ESPECIALES } from './config-state.js';
import { mezclarArray, mostrarMensaje } from './utils.js';
import { abrirZoomJugador, abrirZoomVisible } from './zoom.js';
import { getHabilidadCarta, isHabilidadUsada, usarHabilidad } from './juego.js';

// MAZOS
export function generarMazos() {
    // Mazo de colores
    const mazoColoresTemp = [];
    COLORES.forEach(color => {
        for (let i = 1; i <= 9; i++) {
            const nombreCarpeta = color.charAt(0).toUpperCase() + color.slice(1);
            mazoColoresTemp.push({
                id: `${color}-${i}`,
                color: color,
                numero: i,
                tipo: 'color',
                imagen: `Imagenes/${nombreCarpeta}/${nombreCarpeta}${i}.png`
            });
        }
    });
    state.mazoColores = mezclarArray(mazoColoresTemp);

    // Mazo Especial - Crear copia de las cartas especiales
    state.mazoEspecialDisponible = CARTAS_ESPECIALES.map(c => ({ ...c }));
    state.mazoEspecialDisponible = mezclarArray(state.mazoEspecialDisponible);

    state.cartasVisibles = Array(4).fill(null);
    state.cartasJugador = Array(5).fill(null);
    state.cartasTerminadas = [];
    state.cartasRepartidas = false;
    
    // Resetear puntosEspeciales al generar mazos
    if (state.playersData[state.myId]) {
        state.playersData[state.myId].puntosEspeciales = [];
    }
    
    COLORES.forEach(color => {
        state.tableroGlobal[color] = Array(6).fill(false);
        state.fichas[color] = 0;
    });
}

function getColorFicha(color) {
    const colores = {
        celeste: '#0288d1',
        lima: '#33691e',
        naranja: '#e65100',
        purpura: '#4a148c',
        rosa: '#880e4f'
    };
    return colores[color] || '#333';
}

// RENDERIZAR TABLERO (SOLO VISUAL - SIN INTERACCIÓN)
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
            
            const fichaPos = state.fichas[color] || 0;
            if (i === fichaPos) {
                box.classList.add('ficha-actual');
                
                const fichaIndicador = document.createElement('div');
                fichaIndicador.className = 'ficha-indicador';
                fichaIndicador.style.cssText = `
                    position: absolute;
                    width: 65%;
                    height: 65%;
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
            
            rowDiv.appendChild(box);
        }
        
        boardElement.appendChild(rowDiv);
    });
    
    renderCartasVisibles();
    renderCartasJugador();
    updateVisuals();
}

// RENDERIZAR CARTAS VISIBLES (horizontales)
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
                div.style.fontSize = '0.5rem';
                div.style.textAlign = 'center';
                div.style.color = '#888';
            };
            div.appendChild(img);
            div.style.background = 'rgba(255,255,255,0.1)';
            div.style.borderColor = '#4fc3f7';
            div.style.cursor = 'pointer';
            div.addEventListener('click', () => abrirZoomVisible(carta, index));
        } else {
            div.textContent = 'Vacio';
            div.style.color = '#555';
            div.style.fontSize = '0.5rem';
            div.classList.add('vacia');
            div.style.cursor = 'default';
        }
    });
}

// RENDERIZAR CARTAS DEL JUGADOR (Mano + Terminadas)
export function renderCartasJugador() {
    // Renderizar mano (5 cartas)
    const manoContainer = document.getElementById('jugador-cartas-container');
    if (manoContainer) {
        manoContainer.innerHTML = '';
        
        state.cartasJugador.forEach((carta, index) => {
            const div = document.createElement('div');
            div.className = 'carta-jugador';
            div.dataset.index = index;
            
            if (carta) {
                const img = document.createElement('img');
                img.src = carta.imagen || '';
                img.alt = `Carta ${index+1}`;
                img.draggable = false;
                img.onerror = function() {
                    this.style.display = 'none';
                    div.textContent = `${carta.color || 'Especial'} ${carta.numero || ''}`;
                    div.style.fontSize = '0.5rem';
                    div.style.textAlign = 'center';
                    div.style.color = '#888';
                };
                div.appendChild(img);
                div.style.background = 'rgba(255,255,255,0.1)';
                div.style.borderColor = '#ffb74d';
                div.style.cursor = 'pointer';
                
                const key = `${carta.color}-${carta.numero}`;
                const progresoData = state.progresoCarta[key] || { marcadas: [], completada: false };
                const totalMarcadas = progresoData.marcadas?.length || 0;
                const estaCompletada = progresoData.completada || false;
                
                const progressDiv = document.createElement('div');
                progressDiv.className = 'carta-progreso';
                progressDiv.textContent = estaCompletada ? '✓' : `${totalMarcadas}/3`;
                progressDiv.style.cssText = `
                    position: absolute;
                    bottom: 3px;
                    right: 3px;
                    font-size: 0.5rem;
                    color: ${estaCompletada ? '#4caf50' : '#888'};
                    background: rgba(0,0,0,0.8);
                    padding: 1px 5px;
                    border-radius: 6px;
                    font-weight: bold;
                    pointer-events: none;
                `;
                div.style.position = 'relative';
                div.appendChild(progressDiv);
                
                div.addEventListener('click', () => abrirZoomJugador(carta));
            } else {
                div.textContent = 'Vacio';
                div.style.color = '#555';
                div.style.fontSize = '0.45rem';
                div.classList.add('vacia');
                div.style.cursor = 'default';
            }
            
            manoContainer.appendChild(div);
        });
    }
}

// USAR HABILIDAD POR COLOR
export function usarHabilidadPorColor(color) {
    const carta = state.cartasTerminadas.find(c => c.color === color && state.habilidadesUsadas[c.id] !== true);
    if (carta) {
        usarHabilidad(carta);
    }
}

// ACTUALIZACIÓN VISUAL
export function updateVisuals() {
    const mazoColoresCount = document.getElementById('mazo-colores-count');
    const mazoEspecialCount = document.getElementById('mazo-especial-count');
    const marcadasCount = document.getElementById('marcadas-count');
    const estadoJuego = document.getElementById('estado-juego');
    
    if (mazoColoresCount) mazoColoresCount.textContent = state.mazoColores.length;
    if (mazoEspecialCount) mazoEspecialCount.textContent = state.mazoEspecialDisponible.length;
    
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

// ============================================
// FUNCIÓN PARA FORZAR ACTUALIZACIÓN COMPLETA DE UI
// (Útil después de deshacer)
// ============================================

export function refreshUI() {
    renderBoard();
    renderCartasVisibles();
    renderCartasJugador();
    updateVisuals();
}

// EXPONER FUNCIONES PARA WINDOW
window.usarHabilidadPorColor = usarHabilidadPorColor;
window.refreshUI = refreshUI;