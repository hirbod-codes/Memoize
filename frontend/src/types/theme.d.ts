export type ThemeMode = 'light' | 'dark'

export type Color<T> = {
    main: string
    light: T
    'light-shades': { [k: keyof T]: number }
    dark: T
    'dark-shades': { [k: keyof T]: number }
}

export type PaletteVariants = {
    main: string
    foreground: string
    container: string
    'container-foreground': string
    fixed: string
    'fixed-dim': string
    'fixed-foreground': string
    'fixed-foreground-variant': string
}

export type SurfaceVariants = {
    main: string
    dim: string
    bright: string
    'container-highest': string
    'container-high': string
    'container': string
    'container-low': string
    'container-lowest': string
    foreground: string
    'foreground-variant': string
    inverse: string
    'inverse-foreground': string
    'inverse-primary-foreground': string
}

export type ThemeOptions = {
    mode: ThemeMode;
    radius: string;
    scrollbarWidth: string;
    scrollbarHeight: string;
    scrollbarBorderRadius: string;
    scrollbarThumbRounded: string;
}

export type ThemeColorsOptions = {
    light: ThemeColors;
    dark: ThemeColors;
}

export type ThemeColors = {
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondary: string;
    onSecondary: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    tertiary: string;
    onTertiary: string;
    tertiaryContainer: string;
    onTertiaryContainer: string;
    error: string;
    onError: string;
    errorContainer: string;
    onErrorContainer: string;
    background: string;
    onBackground: string;
    surface: string;
    onSurface: string;
    surfaceVariant: string;
    onSurfaceVariant: string;
    outline: string;
    outlineVariant: string;
    shadow: string;
    scrim: string;
    inverseSurface: string;
    inverseOnSurface: string;
    inversePrimary: string;
    onDisabled: string;
    disabled: string;
    success: string;
    onSuccess: string;
    warning: string;
    onWarning: string;
    scrollbarBg: string;
    scrollbarThumbBg: string;
}
