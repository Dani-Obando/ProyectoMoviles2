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
} from "react-native";
import socket from "../sockets/connection";

const COLORES = ["red", "blue", "green", "orange", "purple"];

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
    const intervaloRef = useRef(null);
    const [dropAreas, setDropAreas] = useState({ izquierdo: null, derecho: null });
    const refIzquierdo = useRef(null);
    const refDerecho = useRef(null);

    useEffect(() => {
        const nuevos = [];
        COLORES.forEach((color) => {
            for (let i = 0; i < 2; i++) {
                nuevos.push({
                    id: `${color}-${i}-${Math.random().toString(36).substring(7)}`,
                    color,
                    peso: Math.floor(Math.random() * 19) + 2,
                    usado: false,
                    pan: new Animated.ValueXY(),
                });
            }
        });
        setBloques(nuevos);
    }, []);

    useEffect(() => {
        const mensaje = {
            type: "ENTRADA",
            jugador: nombre,
            modo,
        };

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
                    } else {
                        clearInterval(intervaloRef.current);
                        setContador(0);
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
            } catch (err) {
                console.error("❌ Error procesando mensaje:", err);
            }
        };

        return () => {
            clearInterval(intervaloRef.current);
            if (socket.readyState === 1) socket.close();
        };
    }, []);

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
                        toValue: { x: 0, y: 0 },
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
                    { transform: bloque.pan.getTranslateTransform() },
                ]}
            />
        );
    };



    const isInDropArea = (gesture, area) => {
        if (!area) return false;
        const { moveX, moveY } = gesture;
        return (
            moveX > area.x &&
            moveX < area.x + area.width &&
            moveY > area.y &&
            moveY < area.y + area.height
        );
    };

    const inclinacion = pesoIzq === pesoDer ? 0 : pesoIzq > pesoDer ? -10 : 10;

    if (resumenFinal) {
        return (
            <ScrollView style={{ padding: 20 }}>
                <Text style={styles.tituloResumen}>🏁 Juego finalizado</Text>
                <Text>⚖️ Peso total izquierdo: {resumenFinal.totales.izquierdo}g</Text>
                <Text>⚖️ Peso total derecho: {resumenFinal.totales.derecho}g</Text>
                <Text>🏆 Lado ganador: {resumenFinal.ganador}</Text>
                <Text>👤 Sobrevivientes: {resumenFinal.sobrevivientes.join(", ") || "Ninguno"}</Text>

                <Text style={{ marginTop: 20, fontWeight: "bold" }}>📋 Jugadas por turno:</Text>
                {resumenFinal.contenido.map((j, i) => (
                    <Text key={i}>Turno {j.turno}: {j.jugador} colocó {j.peso}g</Text>
                ))}
            </ScrollView>
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

            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 30 }}>
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
    tituloResumen: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
    bloque: {
        width: 60,
        height: 60,
        borderRadius: 8,
        margin: 10,
        elevation: 4,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowOffset: { width: 2, height: 2 },
        shadowRadius: 3,
    },
});
