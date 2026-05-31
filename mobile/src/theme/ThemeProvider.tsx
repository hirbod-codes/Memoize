import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { useColorScheme, View } from "react-native";
import { themes } from "./themes";

type ThemeName = keyof typeof themes;

type ThemeContext = {
    theme: "dark" | "light",
    setTheme: (_: ThemeName) => void,
}

const ThemeContext = createContext<ThemeContext>({
    theme: "dark" as ThemeName,
    setTheme: (_: ThemeName) => { },
});

export function ThemeProvider({ children, }: { children: React.ReactNode; }) {
    const colorScheme = useColorScheme();
    const [theme, setTheme] = useState<ThemeName | undefined>(undefined);

    const value = useMemo(() => ({ theme, setTheme }), [theme]);
    const themeStore = useTheme()

    useEffect(() => {
        if (themeStore?.theme)
            setTheme(themeStore?.theme)
        else {
            let t
            if (colorScheme)
                t = colorScheme
            else
                t = 'dark'

            themeStore.setTheme(t as any)
            setTheme(t as any)
        }
    }, [])

    useEffect(() => {
        if (theme)
            themeStore.setTheme(theme)
    }, [theme])

    return (
        <ThemeContext.Provider value={{ setTheme: value.setTheme, theme: value.theme ?? 'dark' }}>
            {
                theme &&
                <View style={themes[theme]} className="flex-1">
                    {children}
                </View>
            }
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}