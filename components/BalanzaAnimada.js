import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";

export default function BalanzaAnimada({ pesoIzq, pesoDer }) {
    const inclinacionAnimada = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const diff = pesoIzq - pesoDer;
        const inclinacionFinal = Math.max(Math.min(diff, 50), -50);

        Animated.timing(inclinacionAnimada, {
            toValue: inclinacionFinal,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, [pesoIzq, pesoDer]);

    return (
        <View style={{ alignItems: "center", marginTop: 30 }}>
            <Text style={{ marginBottom: 10 }}>⚖️ Balanza</Text>

            <View style={{ height: 120, justifyContent: "flex-end" }}>
                {/* soporte vertical */}
                <View style={{ width: 10, height: 60, backgroundColor: "#555", alignSelf: "center" }} />

                {/* barra animada */}
                <Animated.View
                    style={{
                        width: 240,
                        height: 10,
                        backgroundColor: "#333",
                        borderRadius: 5,
                        transform: [
                            {
                                rotate: inclinacionAnimada.interpolate({
                                    inputRange: [-50, 0, 50],
                                    outputRange: ["10deg", "0deg", "-10deg"],
                                }),
                            },
                        ],
                        alignSelf: "center",
                    }}
                >
                    {/* platos */}
                    <View style={{ position: "absolute", left: 10, bottom: -35, alignItems: "center" }}>
                        <Text style={{ marginBottom: 5 }}>{pesoIzq}g</Text>
                        <View style={{ width: 50, height: 10, backgroundColor: "#f99", borderRadius: 5 }} />
                    </View>
                    <View style={{ position: "absolute", right: 10, bottom: -35, alignItems: "center" }}>
                        <Text style={{ marginBottom: 5 }}>{pesoDer}g</Text>
                        <View style={{ width: 50, height: 10, backgroundColor: "#99f", borderRadius: 5 }} />
                    </View>
                </Animated.View>
            </View>
        </View>
    );
}
