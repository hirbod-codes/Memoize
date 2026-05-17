import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Auth } from "../components/Auth/Auth";
import { Slide } from "../components/new/Slide";

type ContextType = {
    open: (state: boolean) => void
    accessToken: string | undefined
    setAccessToken: React.Dispatch<React.SetStateAction<string | undefined>>
    refreshAccessToken: () => Promise<false | string>
    authFetch: (url: RequestInfo | URL, options?: RequestInit, credentials?: 'omit' | 'same-origin' | 'include', accessToken?: string) => Promise<false | Promise<Response> | Response>
    jsonFetch: (url: RequestInfo | URL, options?: RequestInit) => Promise<Response>
    jsonAuthFetch: (url: RequestInfo | URL, options?: RequestInit) => Promise<false | Response>
}

const AuthContext = createContext<ContextType | null>(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside provider");
    return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    const [fetching, setFetching] = useState(false)
    const [accessToken, setAccessToken] = useState<string | undefined>(undefined)
    const accessTokenRef = useRef<string | undefined>(undefined)

    const isRefreshing = useRef(false)
    const refreshPromise = useRef<Promise<false | string> | null>(null)

    const refreshAccessToken = async (): Promise<false | string> => {
        try {
            const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
            if (!res.ok)
                return false

            const data = await res.json();

            return data.accessToken
        } catch (err) {
            console.error(err);
            return false
        }
    }

    const authFetch = async (url: RequestInfo | URL, options: RequestInit = {}, credentials: 'omit' | 'same-origin' | 'include' = 'omit'): Promise<false | Promise<Response> | Response> => {
        const config: RequestInit = {
            ...options,
            credentials,
        };

        if (isRefreshing.current) {
            const r = await refreshPromise.current;
            if (!r) {
                setOpen(true)
                return false
            }
        }

        if (accessTokenRef.current !== undefined)
            config.headers = {
                Authorization: `Bearer ${accessTokenRef.current}`,
                ...(options.headers || {})
            }
        else if (!isRefreshing.current) { // Is not refreshing and no access token
            isRefreshing.current = true;

            refreshPromise.current = refreshAccessToken()
            refreshPromise.current
                .then(res => {
                    if (res === false)
                        throw new Error('Refresh failed');
                    else {
                        accessTokenRef.current = res
                        config.headers = {
                            Authorization: `Bearer ${accessTokenRef.current}`,
                            ...(options.headers || {})
                        }
                    }
                })
                .finally(() => {
                    isRefreshing.current = false;
                });

            try {
                await refreshPromise.current;
            } catch (err) {
                setOpen(true)
                return false
            }
        }

        let response = await fetch(url, config);
        if (response.status !== 401) {
            return response;
        }

        if (isRefreshing.current) {
            const r = await refreshPromise.current;
            if (!r) {
                setOpen(true)
                return false
            }
        } else {
            isRefreshing.current = true;

            refreshPromise.current = refreshAccessToken()
            refreshPromise.current
                .then(res => {
                    if (res === false)
                        throw new Error('Refresh failed');
                    else {
                        accessTokenRef.current = res
                        config.headers = {
                            Authorization: `Bearer ${accessTokenRef.current}`,
                            ...(options.headers || {})
                        }
                    }
                })
                .finally(() => {
                    isRefreshing.current = false;
                });

            try {
                await refreshPromise.current;
            } catch (err) {
                setOpen(true)
                return false
            }
        }

        return fetch(url, config);
    }

    useEffect(() => {
        accessTokenRef.current = accessToken
    }, [accessToken])

    const jsonFetch = async (url: RequestInfo | URL, options: RequestInit = {}) => {
        return fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
        })
    }

    const jsonAuthFetch = async (url: RequestInfo | URL, options: RequestInit = {}) => {
        return authFetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
        })
    }

    const checkAuth = async () => {
        try {
            if (accessToken)
                return

            const r = await fetch('/api/auth/hasRefreshToken', { credentials: 'include' })

            if (r.ok) {
                const token = await refreshAccessToken()
                if (!token)
                    setOpen(true)
                else {
                    accessTokenRef.current = token
                    setAccessToken(token)
                }
            } else
                setOpen(true)

            setFetching(false)
        } catch (error) {
            console.error(error);
            setOpen(true)
            setFetching(false)
        }
    }

    useEffect(() => { checkAuth() }, [])

    console.log('AuthProvider', { open, accessToken, accessTokenRef: accessTokenRef.current })

    return (
        <AuthContext.Provider value={{ open: (state) => setOpen(state), accessToken, setAccessToken, refreshAccessToken, authFetch, jsonFetch, jsonAuthFetch }}>
            {
                fetching
                    ? <div className="absolute top-0 left-0 size-full bg-surface flex flex-col items-center justify-center">
                        <div className="size-20 border-4 border-on-surface border-t-primary rounded-full animate-spin" />
                    </div>
                    : children
            }

            <div className="pointer-events-none absolute size-full top-0 left-0">
                <Slide open={open} className='overflow-auto pointer-events-auto' position="10vh" style={{ height: '60%', marginTop: '0.7cm' }}>
                    <Auth onClose={() => setOpen(false)} />
                </Slide>
            </div>
        </AuthContext.Provider>
    );
}