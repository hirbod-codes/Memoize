import { useContext } from "react";
import { AuthButtons } from "./Auth/AuthButtons";
import { Ripple } from "./Ripple";
import { ThemeContext } from "../contexts/ThemeOptionsContext";
import { Sun } from "../assets/icons/Sun";
import { Moon } from "../assets/icons/Moon";

export function TopBar() {
    const { themeOptions, toggleThemeMode } = useContext(ThemeContext)

    return (
        <div className="text-on-primary-container bg-primary-container p-3 shadow-2xl flex flex-row items-center justify-start *:p-1">
            <Ripple className='aspect-square rounded-full p-2'>
                <button className='cursor-pointer' onClick={() => { console.log('clicked', toggleThemeMode); toggleThemeMode?.() }}>
                    {themeOptions.mode === 'light'
                        ? <Sun className='text-on-primary-container' />
                        : <Moon className='text-on-primary-container' />
                    }
                </button>
            </Ripple>

            <div className="grow" />

            <AuthButtons />
        </div>)
}
