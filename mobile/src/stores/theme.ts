import { create } from "zustand";

export type ThemeModeProps = {
    theme: 'dark' | 'light' | null;
    setTheme: (theme: 'dark' | 'light' | null) => void;
};

export const useThemeMode = create<ThemeModeProps>((set) => ({
    theme: null,
    setTheme: (theme) => set({ theme: theme }),
}));