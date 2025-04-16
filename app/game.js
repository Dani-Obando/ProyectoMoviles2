import { useLocalSearchParams } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
    Alert,
    StyleSheet,
    Animated,
    PanResponder,
} from "react-native";
import socket from "../sockets/connection";
import { generarPesoAleatorio } from "../utils/helpers";

const colores = ["red", "blue", "green", "orange", "purple"];

export default function GameScreen() {
    const { nombre } = useLocalSearchParams();
    const [mensajes, setMensajes] = useState([]);
    const [miTurno, setMiTurno] = useState(false);
    const [jugadorEnTurno, setJugadorEnTurno] = useState("");
    const [pesoIzq, setPesoIzq] = useState(0);
    const [pesoDer, setPesoDer] = useState(0);
    const [eliminado, setEliminado] = useState(false);
    const [resumenFinal, setResumenFinal] = useState(null);
    const [bloques, setBloques] = useState([]);
    const [contador, setContador] = useState(60);
    const intervaloRef = useRef(null);

    const [dropAreas, setDropAreas] = useState({
        izquierdo: null,
        derecho: null,
    });

    useEffect(() => {
        const bloquesIniciales = colores.map((color) => ({
            id: Math.random().toString(36).substring(7),
            peso: generarPesoAleatorio(),
            color,
            colocados: false,
            pan: new Animated.ValueXY(),
            lado: null,
        }));
        setBloques(bloquesIniciales);
    }, []);

    useEffect(() => {
        const mensaje = {
            type: "ENTRADA",
            jugador: nombre,
        };

        if (socket.readyState === 1) {
            socket.send(JSON.stringify(mensaje));
        } else {
            socket.onopen = () => {
                socket.send(JSON.stringify(mensaje));
            };
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
                } else if (data.type === "MENSAJE") {
                    setMensajes((prev) => [...prev, data.contenido]);
                } else if (data.type === "ACTUALIZAR_BALANZA") {
                    setPesoIzq(data.izquierdo);
                    setPesoDer(data.derecho);
                } else if (data.type === "ELIMINADO") {
                    Alert.alert("⚠️ Has sido eliminado", data.mensaje);
                    setEliminado(true);
                    setMiTurno(false);
                    clearInterval(intervaloRef.current);
                    setContador(0);
                } else if (data.type === "RESUMEN") {
                    clearInterval(intervaloRef.current);
                    setContador(0);
                    setResumenFinal(data);
                }
            } catch (err) {
                console.error("❌ Error procesando mensaje:", err);
            }
        };

        return () => {
            if (socket.readyState === 1) socket.close();
            clearInterval(intervaloRef.current);
        };
    }, []);

    const enviarJugada = (bloque, lado) => {
        const mensaje = {
            type: "JUGADA",
            jugador: nombre,
            peso: bloque.peso,
        };
        socket.send(JSON.stringify(mensaje));

        setBloques((prev) =>
            prev.map((b) =>
                b.id === bloque.id ? { ...b, colocados: true, lado } : b
            )
        );
    };

    const renderBloque = (bloque) => {
        if (bloque.colocados) return null;

        const panResponder = PanResponder.create({
            onStartShouldSetPanResponder: () => miTurno && !eliminado,
            onPanResponderMove: Animated.event(
                [null, { dx: bloque.pan.x, dy: bloque.pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (_, gesture) => {
                bloque.pan.extractOffset();

                if (
                    dropAreas.izquierdo &&
                    isInDropArea(gesture, dropAreas.izquierdo)
                ) {
                    enviarJugada(bloque, "izquierdo");
                } else if (
                    dropAreas.derecho &&
                    isInDropArea(gesture, dropAreas.derecho)
                ) {
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
                    bloque.pan.getLayout(),
                ]}
            />
        );
    };

    const isInDropArea = (gesture, area) => {
        const { pageX, pageY } = gesture.moveX
            ? { pageX: gesture.moveX, pageY: gesture.moveY }
            : gesture;
        return (
            pageX > area.x &&
            pageX < area.x + area.width &&
            pageY > area.y &&
            pageY < area.y + area.height
        );
    };

    const inclinacion = pesoIzq === pesoDer ? 0 : pesoIzq > pesoDer ? -10 : 10;

    if (resumenFinal) {
        const esSobreviviente = resumenFinal.sobrevivientes.includes(nombre);
        const [adivinanzas, setAdivinanzas] = useState({});
        const [mostrarResultado, setMostrarResultado] = useState(false);
        const [resultadoAciertos, setResultadoAciertos] = useState(0);

        const misBloques = resumenFinal.bloquesPorJugador[nombre] || [];

        const verificarAciertos = async () => {
            let aciertos = 0;
            const detalle = [];

            misBloques.forEach((bloque, i) => {
                const guess = parseInt(adivinanzas[i]);
                const acertado = guess === bloque.peso;
                if (acertado) aciertos++;
                detalle.push({
                    intento: guess,
                    pesoReal: bloque.peso,
                    acertado
                });
            });

            setResultadoAciertos(aciertos);
            setMostrarResultado(true);

            // Enviar a MongoDB
            try {
                await fetch("http://localhost:5000/adivinanzas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jugador: nombre,
                        bloques: detalle,
                        aciertos
                    })
                });
            } catch (err) {
                console.error("❌ Error guardando adivinanza:", err.message);
            }
        };

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

                {esSobreviviente && !mostrarResultado && (
                    <View style={{ marginTop: 30 }}>
                        <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>
                            🎯 Adivina el peso de tus bloques:
                        </Text>
                        {misBloques.map((bloque, i) => (
                            <View key={i} style={{ marginBottom: 10 }}>
                                <Text>Bloque {i + 1} (color {bloque.color || "?"}):</Text>
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <Text>🎯 Tu adivinanza:</Text>
                                    <ScrollView horizontal>
                                        {[...Array(19)].map((_, n) => {
                                            const valor = n + 2;
                                            return (
                                                <Text
                                                    key={valor}
                                                    style={{
                                                        padding: 6,
                                                        margin: 2,
                                                        borderWidth: 1,
                                                        backgroundColor:
                                                            adivinanzas[i] == valor ? "#add8e6" : "#eee",
                                                    }}
                                                    onPress={() =>
                                                        setAdivinanzas((prev) => ({
                                                            ...prev,
                                                            [i]: valor,
                                                        }))
                                                    }
                                                >
                                                    {valor}
                                                </Text>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            </View>
                        ))}
                        <Text
                            onPress={verificarAciertos}
                            style={{
                                marginTop: 20,
                                backgroundColor: "#008080",
                                color: "white",
                                padding: 10,
                                textAlign: "center",
                                borderRadius: 6,
                            }}
                        >
                            ✅ Enviar respuestas
                        </Text>
                    </View>
                )}

                {mostrarResultado && (
                    <View style={{ marginTop: 30 }}>
                        <Text style={{ fontSize: 18 }}>
                            🎉 ¡Adivinaste correctamente {resultadoAciertos} de {misBloques.length} bloques!
                        </Text>
                    </View>
                )}
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    titulo: {
        fontSize: 18,
        marginBottom: 10,
    },
    subtitulo: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 10,
    },
    tituloResumen: {
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 20,
    },
    bloque: {
        width: 50,
        height: 50,
        borderRadius: 8,
        margin: 8,
    },
});
