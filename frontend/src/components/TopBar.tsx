import { useContext } from "react";
import { AuthButtons } from "./Auth/AuthButtons";
import { ThemeContext } from "../contexts/ThemeOptionsContext";
import { Sun } from "../assets/icons/Sun";
import { Moon } from "../assets/icons/Moon";
import { Button } from "./Button";

export function TopBar() {
    const { themeOptions, toggleThemeMode } = useContext(ThemeContext)

    return (
        <div className="text-on-surface bg-surface-container p-3 flex flex-row items-center justify-start *:p-1">
            <Button variant="text" color="on-surface" isIcon onPointerDown={() => { console.log('clicked', toggleThemeMode); toggleThemeMode?.() }}>
                {themeOptions.mode === 'light'
                    ? <Sun />
                    : <Moon />
                }
            </Button>

            <div className="grow" />

            <AuthButtons />
        </div>
    )
}
