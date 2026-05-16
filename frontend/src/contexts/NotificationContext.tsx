import { createContext, useContext, useState, useCallback } from "react";
import { NotificationContainer } from "../components/NotificationContainer";

export type MessageType = "success" | "error" | "warning" | "primary" | "secondary" | "primary-container" | "secondary-container" | "surface" | "surface-variant" | "inverse-surface"

export type Notification = {
    id: number;
    message: string;
    type?: MessageType;
};

export type ContextType = {
    notify: (message: string, duration?: number, type?: MessageType) => void;
};

const NotificationContext = createContext<ContextType | null>(null);

export function useNotification() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotification must be used inside provider");
    return ctx;
}

let idCounter = 0;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const notify = useCallback((message: string, duration = 3000, type?: MessageType) => {
        const id = ++idCounter;

        setNotifications((prev) => [...prev, { id, message, type }]);

        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, duration);
    }, []);

    console.log('NotificationProvider', { notifications })

    return (
        <NotificationContext.Provider value={{ notify }}>
            {children}
            <div className="pointer-events-none absolute bottom-0 left-0 flex flex-col gap-3">
                <NotificationContainer notifications={notifications} onClose={(id) => {
                    setNotifications((prev) => prev.filter((n) => n.id !== id));
                }} />
            </div>
        </NotificationContext.Provider>
    );
}