import { useLocalSearchParams } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Alert,
    Animated,
    PanResponder,
    Dimensions,
} from "react-native";
import socket from "../sockets/connection";

const COLORES = ["red", "blue", "green", "orange", "purple"];
const { width } = Dimensions.get("window");

export default function GameScreen() {
    const { nombre, modo } = useLocalSearchParams();
    const [bloques, setBloques] = useState([]);
    const [mensajes, setMensajes] = useState([]);
    const [miTurno, setMiTurno] = useState(false);
    const [jugadorEnTurno, setJugadorEnTurno] = useState("");
    const [pesoIzq, setPesoIzq] = useState(0);
    const [pesoDer, setPesoDer] = useState(0);
    const [resumenFinal, setResumenFinal] = useState(null);
    const [eliminado, setEliminado] = useState(false);
    const [contador, setContador] = useState(60);
    const [jugadoresConectados, setJugadoresConectados] = useState(1);
    const [esperando, setEsperando] = useState(modo === "multijugador");
    const [dropAreas, setDropAreas] = useState({ izquierdo: null, derecho: null });

    const refIzquierdo = useRef(null);
    const refDerecho = useRef(null);
    const intervaloRef = useRef(null);

    useEffect(() => {
        const nuevos = [];
        const inicioX = 20;
        const inicioY = 500;
        let fila = 0;
        let col = 0;

        COLORES.forEach((color) => {
            for (let i = 0; i < 2; i++) {
                const posX = inicioX + col * 70;
                const posY = inicioY + fila * 70;
                nuevos.push({
                    id: `${color}-${i}-${Math.random().toString(36).substring(7)}`,
                    color,
                    peso: Math.floor(Math.random() * 19) + 2,
                    usado: false,
                    pan: new Animated.ValueXY({ x: posX, y: posY }),
                    origen: { x: posX, y: posY },
                });
                col++;
                if (col >= 5) {
                    col = 0;
                    fila++;
                }
            }
        });
        setBloques(nuevos);
    }, []);

    useEffect(() => {
        const mensaje = { type: "ENTRADA", jugador: nombre };

        if (socket.readyState === 1) {
            socket.send(JSON.stringify(mensaje));
        } else {
            socket.onopen = () => socket.send(JSON.stringify(mensaje));
        }

        socket.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);

                if (data.type === "TURNO") {
                    setMiTurno(data.tuTurno);
                    setJugadorEnTurno(data.jugadorEnTurno);
                    if (data.tuTurno && !eliminado) {
                        setContador(60);
                        clearInterval(intervaloRef.current);
                        intervaloRef.current = setInterval(() => {
                            setContador((prev) => {
                                if (prev <= 1) {
                                    clearInterval(intervaloRef.current);
                                    return 0;
                                }
                                return prev - 1;
                            });
                        }, 1000);
                    }
                }

                if (data.type === "ACTUALIZAR_BALANZA") {
                    setPesoIzq(data.izquierdo);
                    setPesoDer(data.derecho);
                }

                if (data.type === "MENSAJE") {
                    setMensajes((prev) => [...prev, data.contenido]);
                }

                if (data.type === "ELIMINADO") {
                    setEliminado(true);
                    setMiTurno(false);
                    Alert.alert("Has sido eliminado", data.mensaje);
                }

                if (data.type === "RESUMEN") {
                    clearInterval(intervaloRef.current);
                    setResumenFinal(data);
                }

                if (data.type === "ENTRADA" && modo === "multijugador") {
                    setJugadoresConectados(data.totalJugadores || 1);
                    if ((data.totalJugadores || 1) >= 10) {
                        setEsperando(false);
                    }
                }
            } catch (err) {
                console.error("❌ Error al procesar mensaje:", err);
            }
        };

        return () => {
            clearInterval(intervaloRef.current);
            if (socket.readyState === 1) socket.close();
        };
    }, [modo]);

    const enviarJugada = (bloque, lado) => {
        socket.send(
            JSON.stringify({
                type: "JUGADA",
                jugador: nombre,
                peso: bloque.peso,
                color: bloque.color,
                lado,
            })
        );
        setBloques((prev) =>
            prev.map((b) => (b.id === bloque.id ? { ...b, usado: true } : b))
        );
        setMiTurno(false);
    };

    const renderBloque = (bloque) => {
        if (bloque.usado) return null;

        const panResponder = PanResponder.create({
            onStartShouldSetPanResponder: () => miTurno && !eliminado,
            onPanResponderGrant: () => {
                bloque.pan.setOffset({
                    x: bloque.pan.x._value,
                    y: bloque.pan.y._value,
                });
                bloque.pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: Animated.event(
                [null, { dx: bloque.pan.x, dy: bloque.pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (_, gesture) => {
                bloque.pan.flattenOffset();

                const inIzq = isInDropArea(gesture, dropAreas.izquierdo);
                const inDer = isInDropArea(gesture, dropAreas.derecho);

                if (inIzq) {
                    enviarJugada(bloque, "izquierdo");
                } else if (inDer) {
                    enviarJugada(bloque, "derecho");
                } else {
                    Animated.spring(bloque.pan, {
                        toValue: {
                            x: bloque.origen.x,
                            y: bloque.origen.y,
                        },
                        useNativeDriver: false,
                    }).start();
                }
            },
        });

        return (
            <Animated.View
                key={bloque.id}
                {...panResponder.panHandlers}
                style={[
                    styles.bloque,
                    { backgroundColor: bloque.color },
                    bloque.pan.getLayout(),
                ]}
            />
        );
    };

    const isInDropArea = (gesture, area) => {
        if (!area) return false;
        return (
            gesture.moveX > area.x &&
            gesture.moveX < area.x + area.width &&
            gesture.moveY > area.y &&
            gesture.moveY < area.y + area.height
        );
    };

    const inclinacion = pesoIzq === pesoDer ? 0 : pesoIzq > pesoDer ? -10 : 10;

    if (modo === "multijugador" && esperando) {
        return (
            <View style={styles.centered}>
                <Text style={styles.esperando}>
                    Esperando a {10 - jugadoresConectados} jugador
                    {10 - jugadoresConectados !== 1 ? "es" : ""} más...
                </Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, padding: 20 }}>
            <Text style={styles.titulo}>Jugador: {nombre}</Text>
            <Text style={styles.subtitulo}>Turno de: {jugadorEnTurno || "..."}</Text>
            <Text style={{ color: "red", marginBottom: 10 }}>
                {miTurno ? `⏱️ Tiempo: ${contador}s` : "⏳ Esperando turno..."}
            </Text>

            <View style={{ alignItems: "center", marginTop: 20 }}>
                <Text style={{ marginBottom: 10 }}>⚖️ Balanza</Text>
                <View
                    style={{
                        width: 200,
                        height: 20,
                        backgroundColor: "#444",
                        transform: [{ rotate: `${inclinacion}deg` }],
                        borderRadius: 10,
                    }}
                />
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        width: 200,
                        marginTop: 10,
                    }}
                >
                    <View
                        ref={refIzquierdo}
                        style={{ backgroundColor: "#ffe0e0", padding: 10, borderRadius: 5 }}
                        onLayout={() => {
                            refIzquierdo.current?.measureInWindow((x, y, width, height) => {
                                setDropAreas((prev) => ({
                                    ...prev,
                                    izquierdo: { x, y, width, height },
                                }));
                            });
                        }}
                    >
                        <Text>Izq: {pesoIzq}g</Text>
                    </View>
                    <View
                        ref={refDerecho}
                        style={{ backgroundColor: "#e0e0ff", padding: 10, borderRadius: 5 }}
                        onLayout={() => {
                            refDerecho.current?.measureInWindow((x, y, width, height) => {
                                setDropAreas((prev) => ({
                                    ...prev,
                                    derecho: { x, y, width, height },
                                }));
                            });
                        }}
                    >
                        <Text>Der: {pesoDer}g</Text>
                    </View>
                </View>
            </View>

            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                {bloques.map(renderBloque)}
            </View>

            <Text style={{ marginTop: 30, fontWeight: "bold" }}>📨 Mensajes:</Text>
            <ScrollView style={{ marginTop: 10, maxHeight: 200 }}>
                {mensajes.map((msg, idx) => (
                    <Text key={idx} style={{ marginBottom: 5 }}>{msg}</Text>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    titulo: { fontSize: 18, marginBottom: 10 },
    subtitulo: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
    bloque: {
        width: 60,
        height: 60,
        borderRadius: 8,
        position: "absolute",
        elevation: 4,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowOffset: { width: 2, height: 2 },
        shadowRadius: 3,
    },
    esperando: { fontSize: 18, textAlign: "center" },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
});
