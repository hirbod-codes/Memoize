import { useTheme } from "../theme/ThemeProvider";
import { View } from "react-native";
import { Button } from "./Button";
import { AuthButtons } from "./auth/AuthButtons";

export function TopBar() {
    const { theme, setTheme } = useTheme()

    return (
        <View className="pt-8 text-on-surface bg-surface-container px-3 flex flex-row items-center justify-start">
            <Button color="onSurface" variant="text" icon={theme === 'light' ? 'light-mode' : 'dark-mode'} onPress={() => { setTheme(theme === 'dark' ? 'light' : 'dark') }} />

            <View className="grow" />

            <AuthButtons />
        </View>
    )
}
