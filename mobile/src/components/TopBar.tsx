import { useTheme } from "../theme/ThemeProvider";
import { View } from "react-native";
import { Button } from "./Button";
import { AuthButtons } from "./auth/AuthButtons";

export function TopBar() {
    const { theme, setTheme } = useTheme()

    return (
        <View className="p-4 pt-12 text-on-surface bg-surface-container px-3 flex flex-row items-center justify-start">
            <Button bg="onSurface" variant="text" icon={theme === 'light' ? 'light-mode' : 'dark-mode'} onPress={() => { setTheme(theme === 'dark' ? 'light' : 'dark') }} />

            <View className="grow" />

            <AuthButtons />
        </View>
    )
}
