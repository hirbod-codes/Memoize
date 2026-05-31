import { create } from "zustand";

export type AccessTokenProps = {
    accessToken: string | null;
    setAccessToken: (token: string | null) => void;
};

export const useAccessToken = create<AccessTokenProps>((set) => ({
    accessToken: null,
    setAccessToken: (token) => set({ accessToken: token }),
}));