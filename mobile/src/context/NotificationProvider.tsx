import React, { createContext, useContext, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, Animated, Dimensions, } from "react-native";

type Notification = {
    id: string;
    title?: string;
    message: string;
};

type NotificationContextType = {
    notify: (message: string, title?: string) => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used within Provider");
    return ctx;
};

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const removeNotification = useCallback((id: string) => { setNotifications((prev) => prev.filter((n) => n.id !== id)); }, []);

    const notify = useCallback((message: string, title?: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setNotifications((prev) => [...prev, { id, title, message }]);

        setTimeout(() => removeNotification(id), 5000);
    }, [removeNotification]);

    return (
        <NotificationContext.Provider value={{ notify }}>
            {children}
            <View className='absolute top-50 w-full items-center z-[9999]'>
                {notifications.map((n, idx) => (<NotificationItem key={n.id} notification={n} index={idx} onClose={() => removeNotification(n.id)} />))}
            </View>
        </NotificationContext.Provider>
    );
};

const NotificationItem = ({ notification, index, onClose, }: { notification: Notification; index: number; onClose: () => void; }) => {
    const translateY = new Animated.Value(-100);

    React.useEffect(() => {
        Animated.spring(translateY, {
            toValue: index * 70,
            useNativeDriver: true,
        }).start();
    }, [index]);

    return (
        <Animated.View className='w-[90%] p-2 rounded-lg mb-2 items-center flex flex-row' style={{ transform: [{ translateY }] }}>
            <View style={{ flex: 1 }}>
                {notification.title && <Text className="font-bold mb-2">{notification.title}</Text>}
                <Text>{notification.message}</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="ml-4 p-2">
                <Text style={{ fontWeight: "bold" }}>X</Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const { width } = Dimensions.get("window");