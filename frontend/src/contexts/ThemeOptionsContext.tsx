import { createContext, useEffect, useState } from "react";
import type { ThemeColorsOptions, ThemeMode, ThemeOptions } from "../types/theme";
import { defaultTheme, themeColors } from "../defaultTheme";
import { ColorStatic } from "../lib/Colors/ColorStatic";

export const ThemeContext = createContext<{ mode: ThemeMode, toggleThemeMode: () => void, themeOptions: ThemeOptions }>({ toggleThemeMode: () => { }, mode: 'dark', themeOptions: defaultTheme });

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
    const [themeOptions, setThemeOptions] = useState<ThemeOptions>(defaultTheme)

    const toggleThemeMode = () => {
        const toggledTheme: ThemeMode = !themeOptions ? (window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') : (themeOptions.mode === 'dark' ? 'light' : 'dark')
        updateCssVars(toggledTheme, themeColors, themeOptions)

        updateCssVars(toggledTheme, themeColors, themeOptions)

        setThemeOptions({ ...themeOptions, mode: toggledTheme })
    }

    const updateCssVars = (mode: ThemeMode, colors: ThemeColorsOptions, options?: ThemeOptions) => {
        console.log('updateCssVars...')

        if (!options)
            return false

        const stringifyColorForTailwind = (color: string) => {
            let hsl = ColorStatic.parse(color).toHsl()
            return `${hsl.getHue()} ${hsl.getSaturation()}% ${hsl.getLightness()}%`
        }
        const setCssVar = (k: string, v: string, isColor = false) => document.documentElement.style.setProperty(`--${k}`, isColor ? stringifyColorForTailwind(v) : v)
        setCssVar('radius', options.radius)
        setCssVar('scrollbarWidth', options['scrollbarWidth'])
        setCssVar('scrollbarHeight', options['scrollbarHeight'])
        setCssVar('scrollbarBorderRadius', options['scrollbarBorderRadius']);
        setCssVar('scrollbarThumbRounded', options['scrollbarThumbRounded']);

        Object.keys(colors[mode]).forEach((k) => { document.documentElement.style.setProperty(`--${k}`, (colors[mode] as any)[k]) });
    }

    useEffect(() => {
        const storedThemeMode: ThemeMode = window.localStorage.getItem('themeMode') as any;
        const mode: ThemeMode = storedThemeMode !== null ? storedThemeMode : window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'
        console.log('themeMode', window.localStorage.getItem('themeMode'), mode);

        const options: ThemeOptions = {
            ...defaultTheme,
            mode
        }

        updateCssVars(mode, themeColors, options)

        setThemeOptions(options)
    }, [])

    useEffect(() => {
        window.localStorage.setItem('themeMode', themeOptions.mode)
    }, [themeOptions.mode])

    console.log('ThemeContextProvider', { themeOptions })

    return (
        <ThemeContext.Provider value={{ mode: themeOptions.mode, toggleThemeMode, themeOptions }}>
            {toggleThemeMode !== undefined && children}
        </ThemeContext.Provider>
    )
}
