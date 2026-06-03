import { createContext, useContext, useEffect, useState } from "react";
import { useAccessToken } from "../stores/accessToken";
import { Slide } from "../components/Slide";
import { Auth } from "../components/auth/Auth";
import { refreshAccessToken } from "../services/auth";
import { ActivityIndicator, View } from "react-native";
import { useNotification } from "./NotificationProvider";

type ContextType = {
    open: (state: boolean) => void
}

const AuthContext = createContext<ContextType | null>(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside provider");
    return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { notify } = useNotification();
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(true)

    const init = async () => {
        try {
            if (!useAccessToken.getState().accessToken)
                await refreshAccessToken()
            notify({ bg: 'success', message: 'Logged in' })
            setLoading(false)
        } catch (error) {
            notify({ bg: 'error', message: 'Login failed!' })
            console.error(error);
            setOpen(true)
            setLoading(false)
        }
    }

    useEffect(() => {
        init()
    }, [])

    console.log('AuthProvider', { open, loading })

    return (
        <AuthContext.Provider value={{ open: (state) => setOpen(state) }}>
            {
                loading &&
                <View className="absolute size-full top-0 left-0 flex flex-col items-center justify-center z-[9999]">
                    <ActivityIndicator size="large" animating={true} />
                </View>
            }
            {!open && children}

            <Slide open={open}>
                <Auth onClose={() => setOpen(false)} />
            </Slide>
        </AuthContext.Provider>
    );
}