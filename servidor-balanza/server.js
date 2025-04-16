const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const conectarDB = require('./db');
const jugadasRoute = require('./routes/jugadas');
const Jugada = require('./models/Jugada');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use('/jugadas', jugadasRoute);

conectarDB();

let jugadores = [];
let turnoActual = 0;
let pesoIzquierdo = 0;
let pesoDerecho = 0;
let ladoActual = 'izquierdo';
let totalJugadas = 0;
const MAX_JUGADAS = 10;

wss.on('connection', (ws) => {
    ws.id = Math.random().toString(36).substring(2);
    ws.eliminado = false;
    jugadores.push(ws);
    console.log(`🟢 Nuevo jugador conectado: ${ws.id}`);

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);

            if (msg.type === 'ENTRADA') {
                ws.nombre = msg.jugador;
                broadcast({
                    type: 'MENSAJE',
                    contenido: `${msg.jugador} se unió al juego.`,
                });
                enviarTurno();
            }

            if (msg.type === 'JUGADA') {
                const jugadorActual = jugadores[turnoActual];
                if (jugadorActual.eliminado) return;

                const jugada = new Jugada({
                    jugador: msg.jugador,
                    turno: totalJugadas + 1,
                    peso: msg.peso,
                    equipo: 0,
                    eliminado: false,
                });
                await jugada.save();

                let eliminado = false;

                if (ladoActual === 'izquierdo') {
                    pesoIzquierdo += msg.peso;
                    if (pesoIzquierdo > 50) {
                        eliminado = true;
                        pesoIzquierdo -= msg.peso;
                    } else {
                        ladoActual = 'derecho';
                    }
                } else {
                    pesoDerecho += msg.peso;
                    if (pesoDerecho > 50) {
                        eliminado = true;
                        pesoDerecho -= msg.peso;
                    } else {
                        ladoActual = 'izquierdo';
                    }
                }

                if (eliminado) {
                    jugadorActual.eliminado = true;
                    jugadorActual.send(JSON.stringify({
                        type: 'ELIMINADO',
                        mensaje: 'Has sido eliminado por exceder el peso permitido.'
                    }));
                    broadcast({
                        type: 'MENSAJE',
                        contenido: `${msg.jugador} fue eliminado por sobrepeso.`
                    });
                } else {
                    broadcast({
                        type: 'ACTUALIZAR_BALANZA',
                        izquierdo: pesoIzquierdo,
                        derecho: pesoDerecho,
                        jugador: msg.jugador
                    });

                    broadcast({
                        type: 'MENSAJE',
                        contenido: `${msg.jugador} colocó ${msg.peso}g en el lado ${ladoActual === 'izquierdo' ? 'derecho' : 'izquierdo'}`
                    });
                }

                totalJugadas++;

                if (totalJugadas >= MAX_JUGADAS) {
                    enviarResumenFinal();
                } else {
                    do {
                        turnoActual = (turnoActual + 1) % jugadores.length;
                    } while (jugadores[turnoActual]?.eliminado && jugadores.length > 1);

                    enviarTurno();
                }
            }
        } catch (err) {
            console.error('❌ Error:', err.message);
        }
    });

    ws.on('close', () => {
        console.log(`🔴 Jugador desconectado: ${ws.id}`);
        jugadores = jugadores.filter((j) => j !== ws);
        if (turnoActual >= jugadores.length) turnoActual = 0;
        enviarTurno();
    });
});

function enviarTurno() {
    const jugadorActual = jugadores[turnoActual];
    const nombreActual = jugadorActual?.nombre || `Jugador ${turnoActual + 1}`;
    jugadores.forEach((j, i) => {
        if (j.readyState === WebSocket.OPEN) {
            try {
                j.send(
                    JSON.stringify({
                        type: 'TURNO',
                        tuTurno: i === turnoActual && !j.eliminado,
                        jugadorEnTurno: nombreActual,
                    })
                );
            } catch (err) {
                console.error("❌ Error al enviar turno:", err.message);
            }
        }
    });
}

function broadcast(data) {
    const mensaje = typeof data === 'string' ? data : JSON.stringify(data);
    jugadores.forEach((j) => {
        if (j.readyState === WebSocket.OPEN) {
            try {
                j.send(mensaje);
            } catch (err) {
                console.error("❌ Error al enviar broadcast:", err.message);
            }
        }
    });
}

async function enviarResumenFinal() {
    const jugadas = await Jugada.find().sort({ turno: 1 });

    const resumen = jugadas.map(j => ({
        jugador: j.jugador,
        turno: j.turno,
        peso: j.peso
    }));

    broadcast({
        type: 'RESUMEN',
        contenido: resumen
    });
}

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
});
