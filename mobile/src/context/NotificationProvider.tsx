import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import React, { createContext, useContext, useState, useCallback } from "react";
import { View, Text } from "react-native";
import { Button } from "../components/Button";
import { ThemeColors } from "../theme/theme";
import { themeColors } from "../theme/themes";
import { useTheme } from "../theme/ThemeProvider";

type Notification = {
    message: string;
    bg?: keyof ThemeColors;
    fg?: keyof ThemeColors;
};

type NotificationContextType = { notify: (notification: Notification) => void };

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotification = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used within Provider");
    return ctx;
};

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
    const [notifications, setNotifications] = useState<(Notification & { id: string })[]>([]);

    const removeNotification = useCallback((id: string) => { setNotifications((prev) => prev.filter((n) => n.id !== id)); }, []);

    const notify = useCallback((notification: Notification) => {
        const id = Math.random().toString(36).substring(2, 9);
        setNotifications((prev) => [...prev, { ...notification, id }]);
    }, []);

    return (
        <NotificationContext.Provider value={{ notify }}>
            {children}

            <Animated.View
                layout={LinearTransition.springify()}
                pointerEvents={'box-none'}
                className='absolute top-0 left-0 pt-16 size-full items-center border-4 border-white transition-transform'
            >
                <Animated.View layout={LinearTransition.springify()} pointerEvents={'box-none'} className='border-4 border-white relative w-full'>
                    {notifications.map((n, idx) => (<NotificationItem key={n.id} id={n.id} notification={n} onClose={() => removeNotification(n.id)} />))}
                </Animated.View>
            </Animated.View>
        </NotificationContext.Provider>
    );
};

const NotificationItem = ({ notification, onClose, id }: { notification: Notification; onClose?: () => void; id: any }) => {
    const { theme: mode } = useTheme()

    const bg = notification?.bg ?? 'surfaceContainer'

    let fg: keyof ThemeColors | undefined = notification?.fg
    if (!fg)
        if (bg === 'surfaceContainer')
            fg = 'onSurface'
        else if (bg.includes('on'))
            fg = `${bg.replace('on', '')[0].toLowerCase()}${bg.replace('on', '').slice(1)}` as keyof ThemeColors
        else
            fg = `on${bg[0].toUpperCase() + bg.slice(1)}` as keyof ThemeColors

    let cssBg = `rgb(${themeColors[mode][bg]})`
    let cssFg = `rgb(${themeColors[mode][fg]})`

    return (
        <Animated.View
            entering={FadeInUp}
            exiting={FadeOutUp}
            layout={LinearTransition.springify()}
            className='w-full px-4 mb-2 relative left-0 border-4 border-white'
            style={{ backgroundColor: cssBg }}>
            <View className="rounded-lg items-center justify-between flex flex-row" style={{ backgroundColor: cssBg }}>
                <Text className="text-xl font-bold" style={{ color: cssFg }}>{notification.message + ' ' + id}</Text>

                <Button icon='close' bg={bg} fg={fg} onPress={() => { console.log('X clicked'); onClose?.() }} />
            </View>
        </Animated.View>
    );
};
