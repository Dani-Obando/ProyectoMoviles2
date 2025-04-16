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
        <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
            <Text style={{ fontSize: 20 }}>Bienvenido a Juego de la Balanza</Text>
            <TextInput
                placeholder="Nombre del jugador"
                value={nombre}
                onChangeText={setNombre}
                style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    padding: 10,
                    marginVertical: 20
                }}
            />
            <Button title="Entrar al juego" onPress={entrarAlJuego} />
        </View>
    );
}
