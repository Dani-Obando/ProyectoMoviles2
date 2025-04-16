const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 5000 });
const jugadores = [];
let turnoActual = 0;

console.log("🎯 Servidor WebSocket iniciado en puerto 5000");

server.on('connection', (ws) => {
    ws.id = Math.random().toString(36).substring(7);
    jugadores.push(ws);

    console.log(`🟢 Jugador conectado: ${ws.id}`);

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);

            if (msg.type === 'ENTRADA') {
                ws.nombre = msg.jugador;
                console.log(`👤 ${msg.jugador} ha entrado`);
                broadcast({ type: "MENSAJE", contenido: `${msg.jugador} se unió al juego.` });
                enviarTurno();
            }

            if (msg.type === 'JUGADA') {
                console.log(`🎲 ${msg.jugador} jugó ${msg.peso}g`);

                broadcast({
                    type: "MENSAJE",
                    contenido: `${msg.jugador} colocó ${msg.peso}g`
                });

                turnoActual = (turnoActual + 1) % jugadores.length;
                enviarTurno();
            }

        } catch (err) {
            console.error("❌ Error procesando mensaje:", err);
        }
    });

    ws.on('close', () => {
        console.log(`🔴 Jugador desconectado: ${ws.id}`);
        const index = jugadores.indexOf(ws);
        if (index !== -1) {
            jugadores.splice(index, 1);
            if (jugadores.length === 0) turnoActual = 0;
            else if (turnoActual >= jugadores.length) turnoActual = 0;
            enviarTurno();
        }
    });
});

function enviarTurno() {
    const jugadorActual = jugadores[turnoActual];
    const nombreActual = jugadorActual?.nombre || `Jugador ${turnoActual + 1}`;

    jugadores.forEach((jugador, index) => {
        jugador.send(JSON.stringify({
            type: "TURNO",
            tuTurno: index === turnoActual,
            jugadorEnTurno: nombreActual
        }));
    });
}

function broadcast(data) {
    jugadores.forEach(j => {
        if (j.readyState === WebSocket.OPEN) {
            j.send(JSON.stringify(data));
        }
    });
}
