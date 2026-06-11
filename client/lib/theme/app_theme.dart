import 'package:client/theme/theme_colors.dart';
import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData light() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.light(
        brightness: LightTheme().brightness,
        primary: LightTheme().primary,
        onPrimary: LightTheme().onPrimary,
        primaryContainer: LightTheme().primaryContainer,
        onPrimaryContainer: LightTheme().onPrimaryContainer,
        primaryFixed: LightTheme().primaryFixed,
        primaryFixedDim: LightTheme().primaryFixedDim,
        onPrimaryFixed: LightTheme().onPrimaryFixed,
        onPrimaryFixedVariant: LightTheme().onPrimaryFixedVariant,
        secondary: LightTheme().secondary,
        onSecondary: LightTheme().onSecondary,
        secondaryContainer: LightTheme().secondaryContainer,
        onSecondaryContainer: LightTheme().onSecondaryContainer,
        secondaryFixed: LightTheme().secondaryFixed,
        secondaryFixedDim: LightTheme().secondaryFixedDim,
        onSecondaryFixed: LightTheme().onSecondaryFixed,
        onSecondaryFixedVariant: LightTheme().onSecondaryFixedVariant,
        tertiary: LightTheme().tertiary,
        onTertiary: LightTheme().onTertiary,
        tertiaryContainer: LightTheme().tertiaryContainer,
        onTertiaryContainer: LightTheme().onTertiaryContainer,
        tertiaryFixed: LightTheme().tertiaryFixed,
        tertiaryFixedDim: LightTheme().tertiaryFixedDim,
        onTertiaryFixed: LightTheme().onTertiaryFixed,
        onTertiaryFixedVariant: LightTheme().onTertiaryFixedVariant,
        error: LightTheme().error,
        onError: LightTheme().onError,
        errorContainer: LightTheme().errorContainer,
        onErrorContainer: LightTheme().onErrorContainer,
        surface: LightTheme().surface,
        onSurface: LightTheme().onSurface,
        surfaceDim: LightTheme().surfaceDim,
        surfaceBright: LightTheme().surfaceBright,
        surfaceContainerLowest: LightTheme().surfaceContainerLowest,
        surfaceContainerLow: LightTheme().surfaceContainerLow,
        surfaceContainer: LightTheme().surfaceContainer,
        surfaceContainerHigh: LightTheme().surfaceContainerHigh,
        surfaceContainerHighest: LightTheme().surfaceContainerHighest,
        onSurfaceVariant: LightTheme().onSurfaceVariant,
        outline: LightTheme().outline,
        outlineVariant: LightTheme().outlineVariant,
        shadow: LightTheme().shadow,
        scrim: LightTheme().scrim,
        inverseSurface: LightTheme().inverseSurface,
        onInverseSurface: LightTheme().onInverseSurface,
        inversePrimary: LightTheme().inversePrimary,
        surfaceTint: LightTheme().surfaceTint,
      ),
      textTheme: const TextTheme(bodyMedium: TextStyle(fontSize: 14)),
      appBarTheme: AppBarTheme(elevation: 5, shadowColor: LightTheme().shadow),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: LightTheme().primaryContainer,
        indicatorColor: LightTheme().primary,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return IconThemeData(color: LightTheme().onPrimary);
          }
          return IconThemeData(color: LightTheme().onSurfaceVariant);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return TextStyle(color: LightTheme().primary, fontWeight: FontWeight.w600);
          }
          return TextStyle(color: LightTheme().onSurfaceVariant);
        }),
      ),
    );
  }

  static ThemeData dark() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.dark(
        brightness: DarkTheme().brightness,
        primary: DarkTheme().primary,
        onPrimary: DarkTheme().onPrimary,
        primaryContainer: DarkTheme().primaryContainer,
        onPrimaryContainer: DarkTheme().onPrimaryContainer,
        primaryFixed: DarkTheme().primaryFixed,
        primaryFixedDim: DarkTheme().primaryFixedDim,
        onPrimaryFixed: DarkTheme().onPrimaryFixed,
        onPrimaryFixedVariant: DarkTheme().onPrimaryFixedVariant,
        secondary: DarkTheme().secondary,
        onSecondary: DarkTheme().onSecondary,
        secondaryContainer: DarkTheme().secondaryContainer,
        onSecondaryContainer: DarkTheme().onSecondaryContainer,
        secondaryFixed: DarkTheme().secondaryFixed,
        secondaryFixedDim: DarkTheme().secondaryFixedDim,
        onSecondaryFixed: DarkTheme().onSecondaryFixed,
        onSecondaryFixedVariant: DarkTheme().onSecondaryFixedVariant,
        tertiary: DarkTheme().tertiary,
        onTertiary: DarkTheme().onTertiary,
        tertiaryContainer: DarkTheme().tertiaryContainer,
        onTertiaryContainer: DarkTheme().onTertiaryContainer,
        tertiaryFixed: DarkTheme().tertiaryFixed,
        tertiaryFixedDim: DarkTheme().tertiaryFixedDim,
        onTertiaryFixed: DarkTheme().onTertiaryFixed,
        onTertiaryFixedVariant: DarkTheme().onTertiaryFixedVariant,
        error: DarkTheme().error,
        onError: DarkTheme().onError,
        errorContainer: DarkTheme().errorContainer,
        onErrorContainer: DarkTheme().onErrorContainer,
        surface: DarkTheme().surface,
        onSurface: DarkTheme().onSurface,
        surfaceDim: DarkTheme().surfaceDim,
        surfaceBright: DarkTheme().surfaceBright,
        surfaceContainerLowest: DarkTheme().surfaceContainerLowest,
        surfaceContainerLow: DarkTheme().surfaceContainerLow,
        surfaceContainer: DarkTheme().surfaceContainer,
        surfaceContainerHigh: DarkTheme().surfaceContainerHigh,
        surfaceContainerHighest: DarkTheme().surfaceContainerHighest,
        onSurfaceVariant: DarkTheme().onSurfaceVariant,
        outline: DarkTheme().outline,
        outlineVariant: DarkTheme().outlineVariant,
        shadow: DarkTheme().shadow,
        scrim: DarkTheme().scrim,
        inverseSurface: DarkTheme().inverseSurface,
        onInverseSurface: DarkTheme().onInverseSurface,
        inversePrimary: DarkTheme().inversePrimary,
        surfaceTint: DarkTheme().surfaceTint,
      ),
      textTheme: const TextTheme(bodyMedium: TextStyle(fontSize: 14)),
      appBarTheme: AppBarTheme(elevation: 5, shadowColor: DarkTheme().shadow),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: DarkTheme().primaryContainer,
        indicatorColor: DarkTheme().primary,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return IconThemeData(color: DarkTheme().onPrimary);
          }
          return IconThemeData(color: DarkTheme().onSurfaceVariant);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return TextStyle(color: DarkTheme().primary, fontWeight: FontWeight.w600);
          }
          return TextStyle(color: DarkTheme().onSurfaceVariant);
        }),
      ),
    );
  }
}
