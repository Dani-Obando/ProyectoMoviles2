const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const conectarDB = require('./db');
const jugadasRoute = require('./routes/jugadas');
const Jugada = require('./routes/jugadas');



const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use('/jugadas', jugadasRoute);

conectarDB();

let jugadores = [];
let turnoActual = 0;

wss.on('connection', (ws) => {
    ws.id = Math.random().toString(36).substring(2);
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
                const jugada = new Jugada({
                    jugador: msg.jugador,
                    turno: turnoActual + 1,
                    peso: msg.peso,
                    equipo: 0, // lógica futura
                    eliminado: false,
                });
                await jugada.save();

                broadcast({
                    type: 'MENSAJE',
                    contenido: `${msg.jugador} colocó ${msg.peso}g`,
                });

                turnoActual = (turnoActual + 1) % jugadores.length;
                enviarTurno();
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
                j.send(JSON.stringify({
                    type: 'TURNO',
                    tuTurno: i === turnoActual,
                    jugadorEnTurno: nombreActual
                }));
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


const PORT = 5000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
});
