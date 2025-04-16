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

const COLORES = ["red", "blue", "green", "orange", "purple"];

let jugadores = [];
let turnoActual = 0;
let pesoIzquierdo = 0;
let pesoDerecho = 0;
let ladoActual = "izquierdo";
let totalJugadas = 0;
let bloquesTotales = 0;
let bloquesPorJugador = {};
let turnoTimeout = null;

wss.on("connection", (ws) => {
    ws.id = Math.random().toString(36).substring(2);
    ws.eliminado = false;
    ws.individual = false;
    ws.bloquesUsados = 0;
    ws.pesoIzquierdo = 0;
    ws.pesoDerecho = 0;
    jugadores.push(ws);

    console.log(`🟢 Nuevo jugador conectado: ${ws.id}`);

    ws.on("message", async (data) => {
        try {
            const msg = JSON.parse(data);

            if (msg.type === "ENTRADA") {
                ws.nombre = msg.jugador;
                ws.individual = msg.modo === "individual";

                if (!bloquesPorJugador[msg.jugador]) {
                    const bloques = [];
                    COLORES.forEach((color) => {
                        for (let i = 0; i < 2; i++) {
                            const peso = Math.floor(Math.random() * 19) + 2;
                            bloques.push({ color, peso });
                            if (!ws.individual) bloquesTotales++;
                        }
                    });
                    bloquesPorJugador[msg.jugador] = bloques;
                }

                if (!ws.individual) {
                    broadcast({
                        type: "MENSAJE",
                        contenido: `${msg.jugador} se unió al juego.`,
                        totalJugadores: jugadores.filter(j => !j.individual).length,
                    });
                    enviarTurno();
                } else {
                    ws.send(JSON.stringify({
                        type: "TURNO",
                        tuTurno: true,
                        jugadorEnTurno: msg.jugador,
                    }));
                }
            }

            if (msg.type === "JUGADA") {
                // Individual
                if (ws.individual) {
                    const bloquesJugador = bloquesPorJugador[ws.nombre] || [];
                    ws.bloquesUsados++;

                    if (msg.lado === "izquierdo") {
                        ws.pesoIzquierdo += msg.peso;
                    } else {
                        ws.pesoDerecho += msg.peso;
                    }

                    // Actualiza al mismo jugador
                    ws.send(JSON.stringify({
                        type: "ACTUALIZAR_BALANZA",
                        izquierdo: ws.pesoIzquierdo,
                        derecho: ws.pesoDerecho,
                    }));

                    if (ws.bloquesUsados >= bloquesJugador.length) {
                        const resumen = {
                            contenido: bloquesJugador.map((b, i) => ({
                                turno: i + 1,
                                jugador: ws.nombre,
                                peso: b.peso,
                                color: b.color,
                            })),
                            totales: {
                                izquierdo: ws.pesoIzquierdo,
                                derecho: ws.pesoDerecho,
                            },
                            sobrevivientes: [ws.nombre],
                            ganador:
                                ws.pesoIzquierdo === ws.pesoDerecho
                                    ? "Empate"
                                    : ws.pesoIzquierdo < ws.pesoDerecho
                                        ? "Izquierdo"
                                        : "Derecho",
                            bloquesPorJugador: {
                                [ws.nombre]: bloquesJugador,
                            },
                        };

                        ws.send(JSON.stringify({
                            type: "RESUMEN",
                            ...resumen,
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: "TURNO",
                            tuTurno: true,
                            jugadorEnTurno: ws.nombre,
                        }));
                    }

                    return;
                }

                // Multijugador
                clearTimeout(turnoTimeout);
                const jugadorActual = jugadores[turnoActual];

                const jugada = new Jugada({
                    jugador: msg.jugador,
                    turno: totalJugadas + 1,
                    peso: msg.peso,
                    equipo: 0,
                    eliminado: false,
                    color: msg.color,
                });
                await jugada.save();

                if (ladoActual === "izquierdo") {
                    pesoIzquierdo += msg.peso;
                    ladoActual = "derecho";
                } else {
                    pesoDerecho += msg.peso;
                    ladoActual = "izquierdo";
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
                    enviarResumenFinal();
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
    const activos = jugadores.filter(j => !j.individual && !j.eliminado);
    if (activos.length === 0) return;

    do {
        turnoActual = (turnoActual + 1) % activos.length;
    } while (activos[turnoActual]?.eliminado && activos.length > 1);

    enviarTurno();
}

function enviarTurno() {
    clearTimeout(turnoTimeout);
    const activos = jugadores.filter(j => !j.individual && !j.eliminado);
    if (activos.length === 0) return;

    const jugadorActual = activos[turnoActual];
    const nombreActual = jugadorActual?.nombre || `Jugador ${turnoActual + 1}`;

    activos.forEach((j, i) => {
        if (j.readyState === WebSocket.OPEN) {
            j.send(
                JSON.stringify({
                    type: "TURNO",
                    tuTurno: j === jugadorActual,
                    jugadorEnTurno: nombreActual,
                })
            );
        }
    });

    turnoTimeout = setTimeout(() => {
        if (!jugadores[turnoActual]?.eliminado) {
            jugadores[turnoActual].eliminado = true;
            jugadores[turnoActual].send(
                JSON.stringify({
                    type: "ELIMINADO",
                    mensaje: "Has sido eliminado por inactividad (60s sin mover bloque).",
                })
            );
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
    jugadores
        .filter((j) => !j.individual && j.readyState === WebSocket.OPEN)
        .forEach((j) => {
            try {
                j.send(mensaje);
            } catch (err) {
                console.error("❌ Error al enviar broadcast:", err.message);
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
        .filter((j) => !j.individual && !j.eliminado)
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

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
});
