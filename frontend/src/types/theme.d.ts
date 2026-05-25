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

export type Palette = {
    "0": string;
    "5": string;
    "10": string;
    "15": string;
    "20": string;
    "25": string;
    "30": string;
    "35": string;
    "40": string;
    "50": string;
    "60": string;
    "70": string;
    "80": string;
    "90": string;
    "95": string;
    "98": string;
    "99": string;
    "100": string;
}
type PaletteName = | 'primary' | 'secondary' | 'tertiary' | 'neutral' | 'neutralVariant'

export type Palettes = {
    [K in PaletteName]: Palette
}
export type ThemeColorsOptions = {
    light: ThemeColors;
    dark: ThemeColors;
    palettes: Palettes
}

export type ThemeColors = {
    "primary": string;
    "surfaceTint": string;
    "onPrimary": string;
    "primaryContainer": string;
    "onPrimaryContainer": string;
    "secondary": string;
    "onSecondary": string;
    "secondaryContainer": string;
    "onSecondaryContainer": string;
    "tertiary": string;
    "onTertiary": string;
    "tertiaryContainer": string;
    "onTertiaryContainer": string;
    "error": string;
    "onError": string;
    "errorContainer": string;
    "onErrorContainer": string;
    "success": string;
    "onSuccess": string;
    "successContainer": string;
    "onSuccessContainer": string;
    "successFixed": string;
    "onSuccessFixed": string;
    "successFixedDim": string;
    "onSuccessFixedVariant": string;
    "background": string;
    "onBackground": string;
    "surface": string;
    "onSurface": string;
    "surfaceVariant": string;
    "onSurfaceVariant": string;
    "outline": string;
    "outlineVariant": string;
    "shadow": string;
    "scrim": string;
    "inverseSurface": string;
    "inverseOnSurface": string;
    "inversePrimary": string;
    "primaryFixed": string;
    "onPrimaryFixed": string;
    "primaryFixedDim": string;
    "onPrimaryFixedVariant": string;
    "secondaryFixed": string;
    "onSecondaryFixed": string;
    "secondaryFixedDim": string;
    "onSecondaryFixedVariant": string;
    "tertiaryFixed": string;
    "onTertiaryFixed": string;
    "tertiaryFixedDim": string;
    "onTertiaryFixedVariant": string;
    "surfaceDim": string;
    "surfaceBright": string;
    "surfaceContainerLowest": string;
    "surfaceContainerLow": string;
    "surfaceContainer": string;
    "surfaceContainerHigh": string;
    "surfaceContainerHighest": string;
}
