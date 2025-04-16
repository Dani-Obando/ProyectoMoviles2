import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, TextInput, Button } from "react-native";

export default function HomeScreen() {
    const [nombre, setNombre] = useState('');
    const router = useRouter();

    const entrarAlJuego = () => {
        if (nombre.trim()) {
            router.push({ pathname: "/game", params: { nombre } });
        } else {
            alert('Debes ingresar tu nombre');
        }
    };

    return (
        <View style={{ padding: 20, flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 18 }}>Ingresa tu nombre:</Text>
            <TextInput
                placeholder="Jugador..."
                value={nombre}
                onChangeText={setNombre}
                style={{ borderWidth: 1, padding: 10, marginVertical: 20 }}
            />
            <Button title="Entrar al juego" onPress={entrarAlJuego} />
        </View>
    );
}
