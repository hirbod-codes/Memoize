import { createContext, useContext, useEffect, useState } from "react";
import { useAccessToken } from "../stores/accessToken";
import { Slide } from "../components/Slide";
import { Auth } from "../components/auth/Auth";
import { refreshAccessToken } from "../services/auth";

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
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (!useAccessToken.getState().accessToken)
            refreshAccessToken()
                .catch(error => {
                    console.error(error);
                    setOpen(true)
                })
    }, [])

    console.log('AuthProvider', { open })

    return (
        <AuthContext.Provider value={{ open: (state) => setOpen(state) }}>
            {!open && children}

            <Slide open={open}>
                <Auth onClose={() => setOpen(false)} />
            </Slide>
        </AuthContext.Provider>
    );
}