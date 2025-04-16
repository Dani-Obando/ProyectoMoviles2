import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";

export default function BalanzaAnimada({ pesoIzq, pesoDer, bloquesIzq, bloquesDer, setDropAreas }) {
    const inclinacionAnimada = useRef(new Animated.Value(0)).current;
    const refIzq = useRef(null);
    const refDer = useRef(null);
    const [bloquesAnimados, setBloquesAnimados] = useState(new Set());

    useEffect(() => {
        const diff = pesoIzq - pesoDer;
        const inclinacionFinal = Math.max(Math.min(diff, 50), -50);

        Animated.timing(inclinacionAnimada, {
            toValue: inclinacionFinal,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, [pesoIzq, pesoDer]);

    useEffect(() => {
        if (refIzq.current) {
            refIzq.current.measureInWindow((x, y, width, height) => {
                setDropAreas((prev) => ({ ...prev, izquierdo: { x, y, width, height } }));
            });
        }
        if (refDer.current) {
            refDer.current.measureInWindow((x, y, width, height) => {
                setDropAreas((prev) => ({ ...prev, derecho: { x, y, width, height } }));
            });
        }
    }, [bloquesIzq.length, bloquesDer.length]);

    const renderBloques = (bloques, lado) =>
        bloques.map((bloque, i) => {
            const key = `${lado}-${bloque.color}-${bloque.peso}-${i}`;
            const yaAnimado = bloquesAnimados.has(key);

            const styleBase = [
                styles.miniBloque,
                { backgroundColor: bloque.color },
            ];

            if (yaAnimado) {
                return <View key={key} style={styleBase} />;
            }

            const anim = new Animated.Value(0);
            Animated.spring(anim, {
                toValue: 1,
                friction: 5,
                useNativeDriver: true,
            }).start();

            setBloquesAnimados((prev) => new Set(prev).add(key));

            return (
                <Animated.View
                    key={key}
                    style={[
                        ...styleBase,
                        {
                            transform: [
                                {
                                    translateY: anim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-20, 0],
                                    }),
                                },
                            ],
                            opacity: anim,
                        },
                    ]}
                />
            );
        });

    return (
        <View style={styles.wrapper}>
            <Text style={{ marginBottom: 10 }}>⚖️ Balanza</Text>

            <View style={{ height: 120, justifyContent: "flex-end" }}>
                <View style={{ width: 10, height: 60, backgroundColor: "#555", alignSelf: "center" }} />

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
                    <View style={styles.platoIzq}>
                        <Text style={{ marginBottom: 5 }}>{pesoIzq}g</Text>
                        <View style={styles.barraIzq} />
                    </View>
                    <View style={styles.platoDer}>
                        <Text style={{ marginBottom: 5 }}>{pesoDer}g</Text>
                        <View style={styles.barraDer} />
                    </View>
                </Animated.View>
            </View>

            <View style={styles.contenedores}>
                <View ref={refIzq} style={styles.caja}>
                    {renderBloques(bloquesIzq, "izq")}
                </View>
                <View ref={refDer} style={styles.caja}>
                    {renderBloques(bloquesDer, "der")}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { alignItems: "center", marginTop: 30 },
    platoIzq: {
        position: "absolute",
        left: 10,
        bottom: -35,
        alignItems: "center",
    },
    barraIzq: {
        width: 50,
        height: 10,
        backgroundColor: "#f99",
        borderRadius: 5,
    },
    platoDer: {
        position: "absolute",
        right: 10,
        bottom: -35,
        alignItems: "center",
    },
    barraDer: {
        width: 50,
        height: 10,
        backgroundColor: "#99f",
        borderRadius: 5,
    },
    contenedores: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 20,
        paddingHorizontal: 40,
        width: "100%",
    },
    caja: {
        width: 120,
        height: 120,
        backgroundColor: "#eee",
        borderRadius: 10,
        padding: 5,
        flexWrap: "wrap",
        flexDirection: "row",
    },
    miniBloque: {
        width: 20,
        height: 20,
        borderRadius: 4,
        margin: 3,
    },
});
