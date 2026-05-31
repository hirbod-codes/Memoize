import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View, ViewProps, } from "react-native";
import { cn } from "../lib/utils";

type SlideProps = ViewProps & {
    open: boolean;
    children: React.ReactNode;
    duration?: number;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;

export function Slide({ open, children, duration = 300, style, ...props }: SlideProps) {
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    useEffect(() => {
        Animated.timing(translateY, {
            toValue: open ? 0 : SCREEN_HEIGHT,
            duration,
            useNativeDriver: true,
        }).start();
    }, [open, duration, translateY]);

    return (
        <Animated.View
            {...props}
            className={cn('bg-transparent size-full flex flex-col items-center justify-center px-4 py-10', props.className)}
            style={[
                styles.container,
                style,
                {
                    transform: [{ translateY }],
                },
            ]}
        >
            {children}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 0,
        left: 0,
    },
});