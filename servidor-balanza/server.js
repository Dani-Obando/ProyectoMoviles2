const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const conectarDB = require("./db");
const Jugada = require("./models/Jugada");
const Adivinanza = require("./models/Adivinanza");
const jugadasRoute = require("./routes/jugadas");
const adivinanzasRoute = require("./routes/adivinanzas");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use("/jugadas", jugadasRoute);
app.use("/adivinanzas", adivinanzasRoute);

conectarDB();

// ... [IMPORTS Y CONFIGURACIÓN INICIAL IGUAL] ...

let jugadores = [];
let turnoActual = 0;
let pesoIzquierdo = 0;
let pesoDerecho = 0;
let ladoActual = "izquierdo";
let totalJugadas = 0;
let bloquesTotales = 0;
let bloquesPorJugador = {};
let jugadasIndividuales = {}; // ✅ para partidas individuales
let turnoTimeout = null;

const COLORES = ["red", "blue", "green", "orange", "purple"];

wss.on("connection", (ws) => {
    ws.id = Math.random().toString(36).substring(2);
    ws.eliminado = false;
    ws.individual = false;
    jugadores.push(ws);
    console.log(`🟢 Nuevo jugador conectado: ${ws.id}`);

    ws.on("message", async (data) => {
        try {
            const msg = JSON.parse(data);

            if (msg.type === "ENTRADA") {
                ws.nombre = msg.jugador;
                ws.individual = msg.modo === "individual"; // ✅ detectar modo

                if (!bloquesPorJugador[msg.jugador]) {
                    const bloques = [];
                    COLORES.forEach((color) => {
                        for (let i = 0; i < 2; i++) {
                            const peso = Math.floor(Math.random() * 19) + 2;
                            bloques.push({ color, peso });
                            bloquesTotales++;
                        }
                    });
                    bloquesPorJugador[msg.jugador] = bloques;
                }

                if (ws.individual) {
                    jugadasIndividuales[msg.jugador] = []; // ✅ nuevo registro individual
                }

                broadcast({
                    type: "MENSAJE",
                    contenido: `${msg.jugador} se unió al juego.`,
                });

                enviarTurno();
            }

            if (msg.type === "JUGADA") {
                clearTimeout(turnoTimeout);
                const jugadorActual = jugadores[turnoActual];

                const jugada = {
                    jugador: msg.jugador,
                    turno: totalJugadas + 1,
                    peso: msg.peso,
                    equipo: 0,
                    eliminado: false,
                    color: msg.color,
                };

                if (ws.individual) {
                    jugadasIndividuales[msg.jugador].push(jugada);
                } else {
                    const jugadaMongo = new Jugada(jugada);
                    await jugadaMongo.save();
                }

                if (msg.lado === "izquierdo") {
                    pesoIzquierdo += msg.peso;
                } else if (msg.lado === "derecho") {
                    pesoDerecho += msg.peso;
                }


                broadcast({
                    type: "ACTUALIZAR_BALANZA",
                    izquierdo: pesoIzquierdo,
                    derecho: pesoDerecho,
                    jugador: msg.jugador,
                });

                broadcast({
                    type: "MENSAJE",
                    contenido: `${msg.jugador} colocó ${msg.peso}g`,
                });

                totalJugadas++;

                if (totalJugadas >= bloquesTotales) {
                    if (ws.individual) {
                        enviarResumenIndividual(ws);
                    } else {
                        enviarResumenFinal();
                    }
                } else {
                    avanzarTurno();
                }
            }
        } catch (err) {
            console.error("❌ Error:", err.message);
        }
    });

    ws.on("close", () => {
        console.log(`🔴 Jugador desconectado: ${ws.id}`);
        jugadores = jugadores.filter((j) => j !== ws);
        if (turnoActual >= jugadores.length) turnoActual = 0;
        enviarTurno();
    });
});

function avanzarTurno() {
    do {
        turnoActual = (turnoActual + 1) % jugadores.length;
    } while (jugadores[turnoActual]?.eliminado && jugadores.length > 1);
    enviarTurno();
}

function enviarTurno() {
    clearTimeout(turnoTimeout);

    const jugadorActual = jugadores[turnoActual];
    const nombreActual = jugadorActual?.nombre || `Jugador ${turnoActual + 1}`;

    jugadores.forEach((j, i) => {
        if (j.readyState === WebSocket.OPEN) {
            try {
                j.send(JSON.stringify({
                    type: "TURNO",
                    tuTurno: i === turnoActual && !j.eliminado,
                    jugadorEnTurno: nombreActual,
                }));
            } catch (err) {
                console.error("❌ Error al enviar turno:", err.message);
            }
        }
    });

    turnoTimeout = setTimeout(() => {
        if (!jugadores[turnoActual]?.eliminado) {
            jugadores[turnoActual].eliminado = true;
            jugadores[turnoActual].send(JSON.stringify({
                type: "ELIMINADO",
                mensaje: "Has sido eliminado por inactividad (60s sin mover bloque).",
            }));
            broadcast({
                type: "MENSAJE",
                contenido: `${jugadores[turnoActual].nombre} fue eliminado por inactividad.`,
            });
        }
        avanzarTurno();
    }, 60000);
}

function broadcast(data) {
    const mensaje = typeof data === "string" ? data : JSON.stringify(data);
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

    const resumen = jugadas.map((j) => ({
        jugador: j.jugador,
        turno: j.turno,
        peso: j.peso,
        color: j.color || null,
    }));

    const sobrevivientes = jugadores
        .filter((j) => !j.eliminado)
        .map((j) => j.nombre || "Jugador");

    const ladoGanador =
        pesoIzquierdo === pesoDerecho
            ? "Empate"
            : pesoIzquierdo < pesoDerecho
                ? "Izquierdo"
                : "Derecho";

    broadcast({
        type: "RESUMEN",
        contenido: resumen,
        totales: {
            izquierdo: pesoIzquierdo,
            derecho: pesoDerecho,
        },
        sobrevivientes,
        ganador: ladoGanador,
        bloquesPorJugador,
    });
}

function enviarResumenIndividual(ws) {
    const jugadas = jugadasIndividuales[ws.nombre] || [];

    const resumen = jugadas.map((j, i) => ({
        jugador: j.jugador,
        turno: j.turno,
        peso: j.peso,
        color: j.color,
    }));

    const ladoGanador =
        pesoIzquierdo === pesoDerecho
            ? "Empate"
            : pesoIzquierdo < pesoDerecho
                ? "Izquierdo"
                : "Derecho";

    ws.send(JSON.stringify({
        type: "RESUMEN",
        contenido: resumen,
        totales: {
            izquierdo: pesoIzquierdo,
            derecho: pesoDerecho,
        },
        sobrevivientes: [ws.nombre],
        ganador: ladoGanador,
        bloquesPorJugador: { [ws.nombre]: bloquesPorJugador[ws.nombre] },
    }));
}

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
});
