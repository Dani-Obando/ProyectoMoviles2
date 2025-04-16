import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

export default function ResultScreen() {
    const { resumen } = useLocalSearchParams();
    const router = useRouter();

    let data = {};
    try {
        data = JSON.parse(decodeURIComponent(resumen));
    } catch (e) {
        return (
            <View style={styles.container}>
                <Text style={styles.titulo}>❌ Error al cargar resumen.</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.titulo}>🏁 Juego finalizado</Text>
            <Text style={styles.info}>⚖️ Peso total izquierdo: {data.totales.izquierdo}g</Text>
            <Text style={styles.info}>⚖️ Peso total derecho: {data.totales.derecho}g</Text>
            <Text style={styles.info}>🏆 Lado ganador: {data.ganador}</Text>
            <Text style={styles.info}>👤 Sobrevivientes: {data.sobrevivientes?.join(", ") || "Ninguno"}</Text>

            <Text style={styles.subtitulo}>📋 Jugadas:</Text>
            {data.contenido?.map((j, i) => (
                <Text key={i} style={styles.jugada}>
                    Turno {j.turno}: {j.jugador} colocó {j.peso}g
                </Text>
            ))}

            <TouchableOpacity
                onPress={() => router.replace("/")}
                style={styles.boton}
            >
                <Text style={styles.botonTexto}>🏠 Volver al inicio</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 20, alignItems: "center" },
    titulo: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
    info: { fontSize: 16, marginBottom: 5 },
    subtitulo: { fontSize: 18, fontWeight: "bold", marginTop: 20, marginBottom: 10 },
    jugada: { fontSize: 14, marginBottom: 3 },
    boton: {
        backgroundColor: "#2c3e50",
        marginTop: 30,
        padding: 12,
        borderRadius: 6,
        width: "80%",
    },
    botonTexto: { color: "white", textAlign: "center", fontWeight: "bold" },
});
