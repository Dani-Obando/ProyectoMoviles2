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

    useEffect(() => {
        if (!socket) {
            Alert.alert("Error", "WebSocket no disponible");
            return;
        }

        socket.onopen = () => {
            const mensaje = {
                type: "ENTRADA",
                jugador: nombre
            };
            socket.send(JSON.stringify(mensaje));
        };

        socket.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);

                if (data.type === "TURNO") {
                    setMiTurno(data.tuTurno);
                    setJugadorEnTurno(data.jugadorEnTurno);
                } else if (data.type === "MENSAJE") {
                    setMensajes((prev) => [...prev, data.contenido]);
                }
            } catch (err) {
                console.error("❌ Error procesando mensaje:", err);
            }
        };

        socket.onerror = (e) => {
            console.error("❌ WebSocket error:", e.message);
        };

        socket.onclose = () => {
            console.warn("🔌 Conexión WebSocket cerrada");
        };

        return () => {
            if (socket.readyState === 1) socket.close();
        };
    }, []);

    const enviarJugada = () => {
        if (!socket || socket.readyState !== 1) {
            Alert.alert("WebSocket no disponible");
            return;
        }

        const peso = generarPesoAleatorio();

        const mensaje = {
            type: "JUGADA",
            jugador: nombre,
            peso: peso
        };

        socket.send(JSON.stringify(mensaje));
    };

    return (
        <View style={{ flex: 1, padding: 20 }}>
            <Text style={{ fontSize: 18, marginBottom: 10 }}>Jugador: {nombre}</Text>
            <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
                Turno de: {jugadorEnTurno || "Esperando..."}
            </Text>

            <Button
                title={miTurno ? "ENVIAR PESO ALEATORIO" : "ESPERANDO TURNO..."}
                onPress={enviarJugada}
                disabled={!miTurno}
            />

            <Text style={{ marginTop: 20, fontWeight: "bold" }}>Mensajes:</Text>
            <ScrollView style={{ marginTop: 10, maxHeight: 400 }}>
                {mensajes.length > 0 ? (
                    mensajes.map((msg, idx) => (
                        <Text key={idx} style={{ marginBottom: 5 }}>{msg}</Text>
                    ))
                ) : (
                    <Text style={{ fontStyle: "italic", color: "#888" }}>
                        Aún no hay mensajes...
                    </Text>
                )}
            </ScrollView>
        </View>
    );
}
