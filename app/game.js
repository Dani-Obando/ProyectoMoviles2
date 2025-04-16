import socket from '../sockets/connection';
import { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { generarPesoAleatorio } from '../utils/helpers';

export default function GameScreen() {
    const { nombre } = useLocalSearchParams();
    const [mensajes, setMensajes] = useState([]);

    useEffect(() => {
        if (!socket) return;

        socket.onopen = () => {
            socket.send(`${nombre} ha entrado al juego`);
        };

        socket.onmessage = (e) => {
            setMensajes((prev) => [...prev, e.data]);
        };

        return () => {
            socket.close();
        };
    }, []);

    const enviarJugada = () => {
        if (!socket || socket.readyState !== 1) return;

        const peso = generarPesoAleatorio();
        socket.send(`${nombre} colocó un material de ${peso}g`);
    };

    return (
        <View style={{ padding: 20, flex: 1 }}>
            <Text style={{ fontSize: 18 }}>Jugador: {nombre}</Text>
            <Button title="Enviar peso aleatorio" onPress={enviarJugada} />
            <Text style={{ marginTop: 20, fontWeight: 'bold' }}>Conversación del juego:</Text>
            <ScrollView style={{ marginTop: 10 }}>
                {mensajes.map((msg, idx) => (
                    <Text key={idx} style={{ marginBottom: 5 }}>{msg}</Text>
                ))}
            </ScrollView>
        </View>
    );
}
