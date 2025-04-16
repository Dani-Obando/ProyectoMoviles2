import { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import socket from '../sockets/connection';
import { generarPesoAleatorio } from '../utils/helpers';

export default function GameScreen({ route }) {
    const { nombre } = route.params;
    const [mensajes, setMensajes] = useState([]);

    useEffect(() => {
        socket.onopen = () => {
            socket.send(`${nombre} ha entrado al juego`);
        };

        socket.onmessage = (e) => {
            setMensajes((prev) => [...prev, e.data]);
        };

        socket.onerror = (e) => {
            console.log('Error de WebSocket:', e.message);
        };

        socket.onclose = () => {
            console.log('Conexión cerrada');
        };
    }, []);

    const enviarJugada = () => {
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
