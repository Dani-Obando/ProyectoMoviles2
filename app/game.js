import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, Button, ScrollView, Alert } from "react-native";
import socket from "../sockets/connection";
import { generarPesoAleatorio } from "../utils/helpers";

export default function GameScreen() {
    const { nombre } = useLocalSearchParams();
    const [mensajes, setMensajes] = useState([]);
    const [miTurno, setMiTurno] = useState(false);
    const [jugadorEnTurno, setJugadorEnTurno] = useState("");
    const [pesoIzq, setPesoIzq] = useState(0);
    const [pesoDer, setPesoDer] = useState(0);
    const [eliminado, setEliminado] = useState(false);
    const [resumenFinal, setResumenFinal] = useState(null);

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
                } else if (data.type === "MENSAJE") {
                    setMensajes((prev) => [...prev, data.contenido]);
                } else if (data.type === "ACTUALIZAR_BALANZA") {
                    setPesoIzq(data.izquierdo);
                    setPesoDer(data.derecho);
                } else if (data.type === "ELIMINADO") {
                    Alert.alert("⚠️ Has sido eliminado", data.mensaje);
                    setEliminado(true);
                    setMiTurno(false);
                } else if (data.type === "RESUMEN") {
                    setResumenFinal(data.contenido);
                }
            } catch (err) {
                console.error("❌ Error procesando mensaje:", err);
            }
        };

        return () => {
            if (socket.readyState === 1) socket.close();
        };
    }, []);

    const enviarJugada = () => {
        if (eliminado || resumenFinal) return;

        const peso = generarPesoAleatorio();

        const mensaje = {
            type: "JUGADA",
            jugador: nombre,
            peso: peso,
        };

        socket.send(JSON.stringify(mensaje));
    };

    const inclinacion = pesoIzq === pesoDer ? 0 : pesoIzq > pesoDer ? -10 : 10;

    if (resumenFinal) {
        return (
            <ScrollView style={{ padding: 20 }}>
                <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 20 }}>
                    🏁 Juego finalizado
                </Text>

                <Text style={{ fontSize: 16, marginBottom: 10 }}>
                    ⚖️ Peso total izquierdo: {resumenFinal.totales.izquierdo}g
                </Text>
                <Text style={{ fontSize: 16, marginBottom: 10 }}>
                    ⚖️ Peso total derecho: {resumenFinal.totales.derecho}g
                </Text>
                <Text style={{ fontSize: 16, marginBottom: 10 }}>
                    🏆 Lado ganador: {resumenFinal.ganador}
                </Text>
                <Text style={{ fontSize: 16, marginBottom: 10 }}>
                    👤 Sobrevivientes: {resumenFinal.sobrevivientes.join(", ") || "Ninguno"}
                </Text>

                <Text style={{ fontSize: 16, marginTop: 20, fontWeight: "bold" }}>
                    📋 Jugadas por turno:
                </Text>
                {resumenFinal.contenido.map((j, i) => (
                    <Text key={i} style={{ marginBottom: 5 }}>
                        Turno {j.turno}: {j.jugador} colocó {j.peso}g
                    </Text>
                ))}
            </ScrollView>
        );
    }


    return (
        <View style={{ flex: 1, padding: 20 }}>
            <Text style={{ fontSize: 18, marginBottom: 10 }}>Jugador: {nombre}</Text>
            <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
                Turno de: {jugadorEnTurno || "Esperando..."}
            </Text>

            <Button
                title={eliminado ? "ELIMINADO" : miTurno ? "ENVIAR PESO ALEATORIO" : "ESPERANDO TURNO..."}
                onPress={enviarJugada}
                disabled={!miTurno || eliminado}
            />

            <View style={{ marginTop: 40, alignItems: "center" }}>
                <Text style={{ marginBottom: 10 }}>Balanza</Text>
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
                    <Text>Izq: {pesoIzq}g</Text>
                    <Text>Der: {pesoDer}g</Text>
                </View>
            </View>

            <Text style={{ marginTop: 30, fontWeight: "bold" }}>Mensajes:</Text>
            <ScrollView style={{ marginTop: 10, maxHeight: 300 }}>
                {mensajes.map((msg, idx) => (
                    <Text key={idx} style={{ marginBottom: 5 }}>{msg}</Text>
                ))}
            </ScrollView>
        </View>
    );
}
