import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { cn } from "../lib/utils";
import { ThemeColors } from "../theme/theme";
import { useTheme } from "../theme/ThemeProvider";
import { themeColors } from "../theme/themes";

type Variant = | "filled" | "outlined" | "tonal" | "text" | "elevated";

type Props = {
    title?: string;
    icon?: keyof typeof MaterialIcons.glyphMap;
    bg?: keyof ThemeColors;
    fg?: keyof ThemeColors;
    variant?: Variant;
    onPress?: () => void;
    disabled?: boolean;
    className?: string;
};

export function Button({ title, icon, bg = "onSurface", fg: inputFg, variant = "filled", onPress, disabled = false, className = '', ...props }: Props) {
    const { theme: mode } = useTheme()

    const fg: keyof ThemeColors = inputFg ? inputFg : (
        bg.includes('on')
            ? `${bg.replace('on', '')[0].toLowerCase()}${bg.replace('on', '').slice(1)}`
            : `on${bg[0].toUpperCase() + bg.slice(1)}`
    ) as any

    let cssColor = `rgba(${themeColors[mode][bg]}${disabled ? '/ 0.12' : '/ 1'})`
    let cssOnColor = `rgba(${themeColors[mode][fg]}${disabled ? '/ 0.38' : '/ 1'})`

    if (variant === 'tonal' && !bg.includes('Container')) {
        cssColor = `rgba(${(themeColors[mode] as any)[bg + 'Container']}${disabled ? '/ 0.12' : '/ 1'})`
        cssOnColor = `rgba(${(themeColors[mode] as any)[fg + 'Container']}${disabled ? '/ 0.38' : '/ 1'})`
    }

    const variantColors: Record<Variant, { bg?: string, fg?: string, borderColor?: string }> = {
        filled: {
            bg: cssColor,
            fg: cssOnColor,
        },
        outlined: {
            fg: cssColor,
            borderColor: cssColor,
        },
        tonal: {
            bg: cssColor,
            fg: cssOnColor,
        },
        text: {
            fg: cssColor,
        },
        elevated: {
            bg: cssColor,
            fg: cssOnColor,
        }
    }

    const elevatedStyles = { elevation: 1, shadowOpacity: 0.1 }

    return (
        <Pressable
            disabled={disabled}
            onPress={onPress}
            android_ripple={{ color: "rgba(255,255,255,0.12)" }}
            className={cn(`min-h-[40px] px-6 rounded-full justify-center`, className)}
            style={{
                backgroundColor: variantColors[variant].bg,
                borderColor: variantColors[variant].borderColor,
                ...{ elevatedStyles }
            }}
            {...props}
        >
            <View className="flex-row items-center justify-center gap-2 h-10">
                {icon && <MaterialIcons name={icon} size={18} style={{ color: variantColors[variant].fg }} />}

                {title && <Text className={`font-semibold`} style={{ color: variantColors[variant].fg }}>{title}</Text>}
            </View>
        </Pressable >
    );
}