// =========================================================
//  PONG MITICO - logica completa
// =========================================================

const canvas = document.getElementById('cancha');
const ctx = canvas.getContext('2d');

const elHud = document.getElementById('hud');
const elPuntajeJugador = document.getElementById('puntajeJugador');
const elPuntajeMaquina = document.getElementById('puntajeMaquina');
const elNivelActual = document.getElementById('nivelActual');
const elPowerup = document.getElementById('powerupIndicador');

const menuInicio = document.getElementById('menu-inicio');
const menuNiveles = document.getElementById('menu-niveles');
const pantallaFinal = document.getElementById('pantalla-final');
const mensajeFinal = document.getElementById('mensajeFinal');

// --- Configuracion de niveles ---
const NIVELES = {
    1: { nombre: 'Normal',   velocidadPelota: 5.0, velocidadMaquina: 5.0, margenErrorIA: 20, trampas: false },
    2: { nombre: 'Dificil',  velocidadPelota: 7.3, velocidadMaquina: 7.0, margenErrorIA: 14, trampas: false },
    3: { nombre: 'Hardcore', velocidadPelota: 9.0, velocidadMaquina: 9.0, margenErrorIA: 8,  trampas: true  }
};

const PUNTOS_PARA_GANAR = 5;
const HITOS_POWERUP = [3, 5, 7];
const FRASES_BURLA = [
    '¡Qué tonto!',
    '¿Eso es todo?',
    'Me aburro...',
    '¿No tienes algo bueno al menos?',
    'Eres más malo que pegarle a un padre',
    'Manco asqueroso',
    '¿Y pintar no te gusta?'
];

// --- Estado general ---
let estado = 'menu'; // 'menu' | 'niveles' | 'jugando' | 'fin'
let temaActual = 'madera';
let nivelActualNumero = 1;
let nivelConfig = NIVELES[1];

let jugador, maquina, pelota;
let puntosJugador = 0;
let puntosMaquina = 0;
let tiempoUltimoPuntoJugador = 0;
let hitosLogrados = new Set();
let potenciadorActivo = null;
let burlaActual = null;
let contadorRondas = 0;
let idDistraccion = null;

let arribaPresionado = false;
let abajoPresionado = false;

let patronMadera = null;

// =========================================================
//  Tamano del canvas (pantalla completa)
// =========================================================
function ajustarTamanoCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (jugador) jugador.y = Math.min(jugador.y, canvas.height - jugador.alto);
    if (maquina) {
        maquina.x = canvas.width - 50 - maquina.ancho;
        maquina.y = Math.min(maquina.y, canvas.height - maquina.alto);
    }
}
window.addEventListener('resize', ajustarTamanoCanvas);

// =========================================================
//  Menus
// =========================================================
function ocultarTodosLosMenus() {
    menuInicio.classList.add('oculto');
    menuNiveles.classList.add('oculto');
    pantallaFinal.classList.add('oculto');
}

function irAMenuInicio() {
    estado = 'menu';
    ocultarTodosLosMenus();
    menuInicio.classList.remove('oculto');
    elHud.classList.add('oculto');
}

function irAMenuNiveles() {
    estado = 'niveles';
    ocultarTodosLosMenus();
    menuNiveles.classList.remove('oculto');
    elHud.classList.add('oculto');
}

function mostrarPantallaFinal(gano) {
    estado = 'fin';
    mensajeFinal.textContent = gano ? 'GANASTE' : 'GAME OVER';
    ocultarTodosLosMenus();
    pantallaFinal.classList.remove('oculto');
    elHud.classList.add('oculto');
}

document.getElementById('btnIniciar').addEventListener('click', () => iniciarPartida(nivelActualNumero));
document.getElementById('btnNiveles').addEventListener('click', irAMenuNiveles);
document.getElementById('btnVolver').addEventListener('click', irAMenuInicio);
document.getElementById('btnReintentar').addEventListener('click', irAMenuInicio);

document.querySelectorAll('.btn-nivel').forEach((btn) => {
    btn.addEventListener('click', (e) => {
        iniciarPartida(parseInt(e.target.dataset.nivel, 10));
    });
});

document.querySelectorAll('.btn-tema').forEach((btn) => {
    btn.addEventListener('click', (e) => {
        temaActual = e.target.dataset.tema;
        document.body.className = 'tema-' + temaActual;
        document.querySelectorAll('.btn-tema').forEach((b) => b.classList.remove('activo'));
        e.target.classList.add('activo');
    });
});

// =========================================================
//  Controles del jugador
// =========================================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') arribaPresionado = true;
    if (e.key === 'ArrowDown') abajoPresionado = true;
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') arribaPresionado = false;
    if (e.key === 'ArrowDown') abajoPresionado = false;
});

function moverJugador() {
    if (arribaPresionado) jugador.y -= jugador.velocidad;
    if (abajoPresionado) jugador.y += jugador.velocidad;
    if (jugador.y < 0) jugador.y = 0;
    if (jugador.y + jugador.alto > canvas.height) jugador.y = canvas.height - jugador.alto;
}

// =========================================================
//  IA de la maquina (ahora si puede fallar)
// =========================================================
function moverMaquina() {
    if (maquina.distraida) return; // en Hardcore, a veces se "desconecta"

    const centroMaquina = maquina.y + maquina.alto / 2;
    const margen = nivelConfig.margenErrorIA;

    if (centroMaquina < pelota.y - margen) {
        maquina.y += maquina.velocidad;
    } else if (centroMaquina > pelota.y + margen) {
        maquina.y -= maquina.velocidad;
    }

    if (maquina.y < 0) maquina.y = 0;
    if (maquina.y + maquina.alto > canvas.height) maquina.y = canvas.height - maquina.alto;
}

function programarDistraccion() {
    if (!nivelConfig.trampas) return;
    const espera = 4000 + Math.random() * 5000;
    idDistraccion = setTimeout(() => {
        if (estado !== 'jugando') return;
        maquina.distraida = true;
        const duracion = 800 + Math.random() * 900;
        setTimeout(() => {
            if (estado !== 'jugando') return;
            maquina.distraida = false;
            programarDistraccion();
        }, duracion);
    }, espera);
}

// =========================================================
//  Pelota: movimiento, rebotes, trampa de Hardcore
// =========================================================
function reiniciarPelota() {
    pelota.x = canvas.width / 2;
    pelota.y = canvas.height / 2;
    const direccion = Math.random() > 0.5 ? 1 : -1;
    pelota.velX = direccion * nivelConfig.velocidadPelota;
    pelota.velY = (Math.random() > 0.5 ? 1 : -1) * nivelConfig.velocidadPelota * 0.5;
}

function ajustarAnguloRebote(paleta) {
    const impacto = (pelota.y - (paleta.y + paleta.alto / 2)) / (paleta.alto / 2);
    pelota.velY = impacto * nivelConfig.velocidadPelota * 0.8;
}

function programarTrampaPelota() {
    if (!nivelConfig.trampas) return;
    contadorRondas++;
    const miRonda = contadorRondas;
    const demora = 280 + Math.random() * 480;
    setTimeout(() => {
        if (estado === 'jugando' && miRonda === contadorRondas && pelota.velX > 0) {
            pelota.velX = -Math.abs(pelota.velX);
        }
    }, demora);
}

function moverPelota() {
    pelota.x += pelota.velX;
    pelota.y += pelota.velY;

    if (pelota.y - pelota.radio < 0 || pelota.y + pelota.radio > canvas.height) {
        pelota.velY = -pelota.velY;
    }

    // Rebote contra el jugador
    if (
        pelota.velX < 0 &&
        pelota.x - pelota.radio < jugador.x + jugador.ancho &&
        pelota.x > jugador.x &&
        pelota.y > jugador.y &&
        pelota.y < jugador.y + jugador.alto
    ) {
        pelota.velX = Math.abs(pelota.velX);
        ajustarAnguloRebote(jugador);
        if (nivelConfig.trampas && Math.random() < 0.35) {
            programarTrampaPelota();
        }
    }

    // Rebote contra la maquina
    if (
        pelota.velX > 0 &&
        pelota.x + pelota.radio > maquina.x &&
        pelota.x < maquina.x + maquina.ancho &&
        pelota.y > maquina.y &&
        pelota.y < maquina.y + maquina.alto
    ) {
        pelota.velX = -Math.abs(pelota.velX);
        ajustarAnguloRebote(maquina);
    }

    // Punto para la maquina
    if (pelota.x - pelota.radio < 0) {
        puntosMaquina++;
        mostrarBurla();
        tiempoUltimoPuntoJugador = performance.now();
        actualizarHUD();
        if (puntosMaquina >= PUNTOS_PARA_GANAR) {
            mostrarPantallaFinal(false);
        } else {
            reiniciarPelota();
        }
    }

    // Punto para el jugador
    if (pelota.x + pelota.radio > canvas.width) {
        puntosJugador++;
        tiempoUltimoPuntoJugador = performance.now();
        comprobarPowerUp();
        actualizarHUD();
        if (puntosJugador >= PUNTOS_PARA_GANAR) {
            mostrarPantallaFinal(true);
        } else {
            reiniciarPelota();
        }
    }
}

// =========================================================
//  Power-ups por puntaje del jugador
// =========================================================
function comprobarPowerUp() {
    if (HITOS_POWERUP.includes(puntosJugador) && !hitosLogrados.has(puntosJugador)) {
        hitosLogrados.add(puntosJugador);
        activarPowerUp();
    }
}

function activarPowerUp() {
    const tipo = Math.random() < 0.5 ? 'velocidad' : 'paleta';

    if (tipo === 'velocidad') {
        jugador.velocidad = jugador.velocidadBase * 1.8;
    } else {
        const extra = 50;
        jugador.y -= extra / 2;
        jugador.alto = jugador.altoBase + extra;
    }

    potenciadorActivo = { tipo, hasta: performance.now() + 10000 };

    setTimeout(() => {
        if (tipo === 'velocidad') {
            jugador.velocidad = jugador.velocidadBase;
        } else {
            jugador.y += 25;
            jugador.alto = jugador.altoBase;
        }
        if (potenciadorActivo && potenciadorActivo.tipo === tipo) {
            potenciadorActivo = null;
        }
    }, 10000);
}

// =========================================================
//  Burlas de la maquina
// =========================================================
function mostrarBurla() {
    const texto = FRASES_BURLA[Math.floor(Math.random() * FRASES_BURLA.length)];
    burlaActual = { texto, inicio: performance.now() };
}

function comprobarBurlaPorTiempo() {
    if (estado !== 'jugando') return;
    if (performance.now() - tiempoUltimoPuntoJugador > 30000) {
        mostrarBurla();
        tiempoUltimoPuntoJugador = performance.now();
    }
}

// =========================================================
//  HUD
// =========================================================
function actualizarHUD() {
    elPuntajeJugador.textContent = puntosJugador;
    elPuntajeMaquina.textContent = puntosMaquina;
    elNivelActual.textContent = 'Nivel: ' + nivelConfig.nombre;

    if (potenciadorActivo) {
        const restante = Math.max(0, Math.ceil((potenciadorActivo.hasta - performance.now()) / 1000));
        const etiqueta = potenciadorActivo.tipo === 'velocidad' ? 'Velocidad extra' : 'Paleta extendida';
        elPowerup.textContent = etiqueta + ' - ' + restante + 's';
    } else {
        elPowerup.textContent = '';
    }
}

// =========================================================
//  Iniciar una partida
// =========================================================
function iniciarPartida(nivel) {
    if (idDistraccion) clearTimeout(idDistraccion);

    nivelActualNumero = nivel;
    nivelConfig = NIVELES[nivel];

    puntosJugador = 0;
    puntosMaquina = 0;
    hitosLogrados = new Set();
    potenciadorActivo = null;
    burlaActual = null;
    contadorRondas = 0;

    const anchoPaleta = 16;
    const altoPaleta = 100;

    jugador = {
        x: 50, y: canvas.height / 2 - altoPaleta / 2,
        ancho: anchoPaleta, alto: altoPaleta, altoBase: altoPaleta,
        velocidad: 6, velocidadBase: 6
    };

    maquina = {
        x: canvas.width - 50 - anchoPaleta, y: canvas.height / 2 - altoPaleta / 2,
        ancho: anchoPaleta, alto: altoPaleta,
        velocidad: nivelConfig.velocidadMaquina, distraida: false
    };

    pelota = { x: canvas.width / 2, y: canvas.height / 2, radio: 11, velX: 0, velY: 0 };
    reiniciarPelota();

    tiempoUltimoPuntoJugador = performance.now();

    estado = 'jugando';
    ocultarTodosLosMenus();
    elHud.classList.remove('oculto');
    actualizarHUD();

    if (nivelConfig.trampas) programarDistraccion();
}

// =========================================================
//  Dibujo: fondo segun tema
// =========================================================
function crearPatronMadera() {
    const tile = document.createElement('canvas');
    tile.width = 140;
    tile.height = 140;
    const tctx = tile.getContext('2d');

    tctx.fillStyle = '#6b4226';
    tctx.fillRect(0, 0, 140, 140);

    for (let i = 0; i < 36; i++) {
        const y = Math.random() * 140;
        tctx.strokeStyle = 'rgba(40,20,10,' + (0.12 + Math.random() * 0.18).toFixed(2) + ')';
        tctx.lineWidth = 1 + Math.random() * 2;
        tctx.beginPath();
        tctx.moveTo(0, y);
        tctx.quadraticCurveTo(70, y + (Math.random() * 14 - 7), 140, y + (Math.random() * 14 - 7));
        tctx.stroke();
    }
    return ctx.createPattern(tile, 'repeat');
}

function dibujarFondo() {
    if (temaActual === 'madera') {
        if (!patronMadera) patronMadera = crearPatronMadera();
        ctx.fillStyle = patronMadera;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const vineta = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, canvas.height * 0.2,
            canvas.width / 2, canvas.height / 2, canvas.width * 0.7
        );
        vineta.addColorStop(0, 'rgba(0,0,0,0)');
        vineta.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx.fillStyle = vineta;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        const t = performance.now() / 1000;
        const cx = canvas.width / 2 + Math.sin(t * 0.4) * canvas.width * 0.15;
        const cy = canvas.height / 2 + Math.cos(t * 0.3) * canvas.height * 0.1;
        const grad = ctx.createRadialGradient(cx, cy, 40, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75);
        grad.addColorStop(0, '#1c7fb8');
        grad.addColorStop(0.55, '#0b3d63');
        grad.addColorStop(1, '#021527');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 3; i++) {
            const ox = canvas.width * (0.2 + i * 0.3) + Math.sin(t + i) * 60;
            const oy = canvas.height * 0.5 + Math.cos(t * 0.6 + i) * 120;
            ctx.beginPath();
            ctx.ellipse(ox, oy, 180, 70, t + i, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // Linea central punteada
    ctx.setLineDash([10, 12]);
    ctx.strokeStyle = temaActual === 'madera' ? 'rgba(255,240,220,0.25)' : 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
}

// =========================================================
//  Dibujo: paletas y pelota
// =========================================================
function dibujarPaleta(paleta, esJugador) {
    if (temaActual === 'madera') {
        ctx.fillStyle = esJugador ? '#8a5a34' : '#5a3b23';
        ctx.strokeStyle = '#2e1b10';
        ctx.lineWidth = 2;
        ctx.fillRect(paleta.x, paleta.y, paleta.ancho, paleta.alto);
        ctx.strokeRect(paleta.x, paleta.y, paleta.ancho, paleta.alto);

        ctx.strokeStyle = 'rgba(255,240,220,0.18)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
            const y = paleta.y + (paleta.alto / 4) * i;
            ctx.beginPath();
            ctx.moveTo(paleta.x + 2, y);
            ctx.lineTo(paleta.x + paleta.ancho - 2, y);
            ctx.stroke();
        }
    } else {
        const color = esJugador ? '#4fd1ff' : '#1c6fa8';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.fillRect(paleta.x, paleta.y, paleta.ancho, paleta.alto);
        ctx.shadowBlur = 0;
    }

    if (!esJugador && paleta.distraida) {
        ctx.fillStyle = temaActual === 'madera' ? 'rgba(255,220,150,0.9)' : 'rgba(255,255,255,0.9)';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('zzz', paleta.x + paleta.ancho / 2, paleta.y - 12);
    }
}

function dibujarPelota() {
    if (temaActual === 'madera') {
        const grad = ctx.createRadialGradient(
            pelota.x - pelota.radio * 0.4, pelota.y - pelota.radio * 0.4, 1,
            pelota.x, pelota.y, pelota.radio
        );
        grad.addColorStop(0, '#d8a46a');
        grad.addColorStop(1, '#6b4226');
        ctx.fillStyle = grad;
    } else {
        ctx.fillStyle = '#eaf6ff';
        ctx.shadowColor = '#4fd1ff';
        ctx.shadowBlur = 18;
    }
    ctx.beginPath();
    ctx.arc(pelota.x, pelota.y, pelota.radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function dibujarBurla() {
    if (!burlaActual) return;
    const transcurrido = performance.now() - burlaActual.inicio;
    const duracion = 3000;
    if (transcurrido > duracion) {
        burlaActual = null;
        return;
    }
    const alpha = transcurrido < 2200 ? 1 : Math.max(0, (duracion - transcurrido) / 800);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = temaActual === 'madera' ? 'italic 18px Georgia' : '16px Arial';
    ctx.fillStyle = temaActual === 'madera' ? '#f3e9d2' : '#eaf6ff';
    ctx.textAlign = 'right';
    ctx.fillText(burlaActual.texto, maquina.x - 18, maquina.y + maquina.alto / 2);
    ctx.restore();
}

// =========================================================
//  Bucle principal
// =========================================================
function bucleDelJuego() {
    dibujarFondo();

    if (estado === 'jugando') {
        moverJugador();
        moverMaquina();
        moverPelota();
        comprobarBurlaPorTiempo();
        actualizarHUD();
    }

    if (estado === 'jugando' || estado === 'fin') {
        dibujarPaleta(jugador, true);
        dibujarPaleta(maquina, false);
        dibujarPelota();
        dibujarBurla();
    }

    requestAnimationFrame(bucleDelJuego);
}

ajustarTamanoCanvas();
bucleDelJuego();
