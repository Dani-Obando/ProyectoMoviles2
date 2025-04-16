import { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';

export default function HomeScreen({ navigation }) {
    const [nombre, setNombre] = useState('');

    const entrarAlJuego = () => {
        if (nombre.trim()) {
            navigation.navigate('Game', { nombre });
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
