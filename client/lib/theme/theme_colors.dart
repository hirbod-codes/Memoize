import 'dart:ui';
import 'package:flutter/material.dart';

enum ThemeColorName {
  primary,
  onPrimary,
  primaryContainer,
  onPrimaryContainer,
  primaryFixed,
  onPrimaryFixed,
  primaryFixedDim,
  onPrimaryFixedVariant,
  inversePrimary,

  secondary,
  onSecondary,
  secondaryContainer,
  onSecondaryContainer,
  secondaryFixed,
  onSecondaryFixed,
  secondaryFixedDim,
  onSecondaryFixedVariant,

  tertiary,
  onTertiary,
  tertiaryContainer,
  onTertiaryContainer,
  tertiaryFixed,
  onTertiaryFixed,
  tertiaryFixedDim,
  onTertiaryFixedVariant,

  error,
  onError,
  errorContainer,
  onErrorContainer,

  outline,
  outlineVariant,

  shadow,
  scrim,

  surfaceTint,
  surface,
  onSurface,
  surfaceVariant,
  onSurfaceVariant,
  inverseSurface,
  surfaceDim,
  surfaceBright,
  surfaceContainerLowest,
  surfaceContainerLow,
  surfaceContainer,
  surfaceContainerHigh,
  surfaceContainerHighest,
  onInverseSurface,

  success,
  onSuccess,
  successContainer,
  onSuccessContainer,
  successFixed,
  onSuccessFixed,
  successFixedDim,
  onSuccessFixedVariant,

  warning,
  onWarning,
  warningContainer,
  onWarningContainer,
  warningFixed,
  onWarningFixed,
  warningFixedDim,
  onWarningFixedVariant,
}

abstract class ITheme {
  late Brightness brightness;

  late Color primary;
  late Color onPrimary;
  late Color primaryContainer;
  late Color onPrimaryContainer;
  late Color primaryFixed;
  late Color onPrimaryFixed;
  late Color primaryFixedDim;
  late Color onPrimaryFixedVariant;

  late Color inversePrimary;

  late Color secondary;
  late Color onSecondary;
  late Color secondaryContainer;
  late Color onSecondaryContainer;
  late Color secondaryFixed;
  late Color onSecondaryFixed;
  late Color secondaryFixedDim;
  late Color onSecondaryFixedVariant;

  late Color tertiary;
  late Color onTertiary;
  late Color tertiaryContainer;
  late Color onTertiaryContainer;
  late Color tertiaryFixed;
  late Color onTertiaryFixed;
  late Color tertiaryFixedDim;
  late Color onTertiaryFixedVariant;

  late Color error;
  late Color onError;
  late Color errorContainer;
  late Color onErrorContainer;

  late Color outline;
  late Color outlineVariant;

  late Color shadow;
  late Color scrim;

  late Color surfaceTint;
  late Color surface;
  late Color onSurface;
  late Color surfaceVariant;
  late Color onSurfaceVariant;
  late Color inverseSurface;
  late Color surfaceDim;
  late Color surfaceBright;
  late Color surfaceContainerLowest;
  late Color surfaceContainerLow;
  late Color surfaceContainer;
  late Color surfaceContainerHigh;
  late Color surfaceContainerHighest;
  late Color onInverseSurface;

  late Color success;
  late Color onSuccess;
  late Color successContainer;
  late Color onSuccessContainer;
  late Color successFixed;
  late Color onSuccessFixed;
  late Color successFixedDim;
  late Color onSuccessFixedVariant;

  late Color warning;
  late Color onWarning;
  late Color warningContainer;
  late Color onWarningContainer;
  late Color warningFixed;
  late Color onWarningFixed;
  late Color warningFixedDim;
  late Color onWarningFixedVariant;

  Color getThemeColor(ThemeColorName name);
  Color getThemeOnColor(ThemeColorName name);
}

class LightTheme implements ITheme {
  @override
  Brightness brightness = Brightness.light;

  @override
  Color primary = Color.fromRGBO(0, 105, 110, 1);
  @override
  Color onPrimary = Color.fromRGBO(255, 255, 255, 1);
  @override
  Color primaryContainer = Color.fromRGBO(156, 240, 246, 1);
  @override
  Color onPrimaryContainer = Color.fromRGBO(0, 79, 83, 1);
  @override
  Color primaryFixed = Color.fromRGBO(156, 240, 246, 1);
  @override
  Color primaryFixedDim = Color.fromRGBO(128, 212, 217, 1);
  @override
  Color onPrimaryFixed = Color.fromRGBO(0, 32, 33, 1);
  @override
  Color onPrimaryFixedVariant = Color.fromRGBO(0, 79, 83, 1);

  @override
  Color inversePrimary = Color.fromRGBO(128, 212, 217, 1);

  @override
  Color secondary = Color.fromRGBO(65, 95, 145, 1);
  @override
  Color onSecondary = Color.fromRGBO(255, 255, 255, 1);
  @override
  Color secondaryContainer = Color.fromRGBO(214, 227, 255, 1);
  @override
  Color onSecondaryContainer = Color.fromRGBO(39, 71, 119, 1);
  @override
  Color secondaryFixed = Color.fromRGBO(214, 227, 255, 1);
  @override
  Color secondaryFixedDim = Color.fromRGBO(170, 199, 255, 1);
  @override
  Color onSecondaryFixed = Color.fromRGBO(0, 27, 62, 1);
  @override
  Color onSecondaryFixedVariant = Color.fromRGBO(39, 71, 119, 1);

  @override
  Color tertiary = Color.fromRGBO(78, 95, 125, 1);
  @override
  Color onTertiary = Color.fromRGBO(255, 255, 255, 1);
  @override
  Color tertiaryContainer = Color.fromRGBO(214, 227, 255, 1);
  @override
  Color onTertiaryContainer = Color.fromRGBO(54, 71, 100, 1);
  @override
  Color tertiaryFixed = Color.fromRGBO(214, 227, 255, 1);
  @override
  Color tertiaryFixedDim = Color.fromRGBO(182, 199, 233, 1);
  @override
  Color onTertiaryFixed = Color.fromRGBO(8, 28, 54, 1);
  @override
  Color onTertiaryFixedVariant = Color.fromRGBO(54, 71, 100, 1);

  @override
  Color error = Color.fromRGBO(186, 26, 26, 1);
  @override
  Color onError = Color.fromRGBO(255, 255, 255, 1);
  @override
  Color errorContainer = Color.fromRGBO(255, 218, 214, 1);
  @override
  Color onErrorContainer = Color.fromRGBO(147, 0, 10, 1);

  @override
  Color surface = Color.fromRGBO(244, 250, 250, 1);
  @override
  Color onSurface = Color.fromRGBO(22, 29, 29, 1);
  @override
  Color surfaceDim = Color.fromRGBO(213, 219, 219, 1);
  @override
  Color surfaceBright = Color.fromRGBO(244, 250, 250, 1);
  @override
  Color surfaceContainerLowest = Color.fromRGBO(255, 255, 255, 1);
  @override
  Color surfaceContainerLow = Color.fromRGBO(239, 245, 245, 1);
  @override
  Color surfaceContainer = Color.fromRGBO(233, 239, 239, 1);
  @override
  Color surfaceContainerHigh = Color.fromRGBO(227, 233, 233, 1);
  @override
  Color surfaceContainerHighest = Color.fromRGBO(221, 228, 228, 1);
  @override
  Color surfaceVariant = Color.fromRGBO(218, 228, 229, 1);
  @override
  Color onSurfaceVariant = Color.fromRGBO(63, 73, 73, 1);
  @override
  Color surfaceTint = Color.fromRGBO(0, 105, 110, 1);
  @override
  Color inverseSurface = Color.fromRGBO(43, 50, 50, 1);
  @override
  Color onInverseSurface = Color.fromRGBO(236, 242, 242, 1);

  @override
  Color outline = Color.fromRGBO(111, 121, 121, 1);
  @override
  Color outlineVariant = Color.fromRGBO(190, 200, 201, 1);

  @override
  Color shadow = Color.fromRGBO(0, 0, 0, 1);
  @override
  Color scrim = Color.fromRGBO(0, 0, 0, 1);

  @override
  Color success = Color.fromRGBO(64, 128, 88, 1);
  @override
  Color onSuccess = Color.fromRGBO(240, 252, 245, 1);
  @override
  Color successContainer = Color.fromRGBO(193, 230, 207, 1);
  @override
  Color onSuccessContainer = Color.fromRGBO(25, 51, 35, 1);
  @override
  Color successFixed = Color.fromRGBO(193, 230, 207, 1);
  @override
  Color onSuccessFixed = Color.fromRGBO(25, 51, 35, 1);
  @override
  Color successFixedDim = Color.fromRGBO(178, 230, 198, 1);
  @override
  Color onSuccessFixedVariant = Color.fromRGBO(51, 102, 70, 1);

  @override
  Color warning = Color.fromRGBO(128, 105, 13, 1);
  @override
  Color onWarning = Color.fromRGBO(252, 248, 230, 1);
  @override
  Color warningContainer = Color.fromRGBO(230, 216, 164, 1);
  @override
  Color onWarningContainer = Color.fromRGBO(51, 42, 5, 1);
  @override
  Color warningFixed = Color.fromRGBO(230, 216, 164, 1);
  @override
  Color onWarningFixed = Color.fromRGBO(51, 42, 5, 1);
  @override
  Color warningFixedDim = Color.fromRGBO(230, 211, 137, 1);
  @override
  Color onWarningFixedVariant = Color.fromRGBO(102, 84, 10, 1);

  @override
  Color getThemeColor(ThemeColorName name) {
    switch (name) {
      case ThemeColorName.primary:
        return primary;
      case ThemeColorName.onPrimary:
        return onPrimary;
      case ThemeColorName.primaryContainer:
        return primaryContainer;
      case ThemeColorName.onPrimaryContainer:
        return onPrimaryContainer;
      case ThemeColorName.primaryFixed:
        return primaryFixed;
      case ThemeColorName.onPrimaryFixed:
        return onPrimaryFixed;
      case ThemeColorName.primaryFixedDim:
        return primaryFixedDim;
      case ThemeColorName.inversePrimary:
        return inversePrimary;
      case ThemeColorName.onPrimaryFixedVariant:
        return onPrimaryFixedVariant;
      case ThemeColorName.secondary:
        return secondary;
      case ThemeColorName.onSecondary:
        return onSecondary;
      case ThemeColorName.secondaryContainer:
        return secondaryContainer;
      case ThemeColorName.onSecondaryContainer:
        return onSecondaryContainer;
      case ThemeColorName.secondaryFixed:
        return secondaryFixed;
      case ThemeColorName.onSecondaryFixed:
        return onSecondaryFixed;
      case ThemeColorName.secondaryFixedDim:
        return secondaryFixedDim;
      case ThemeColorName.onSecondaryFixedVariant:
        return onSecondaryFixedVariant;
      case ThemeColorName.tertiary:
        return tertiary;
      case ThemeColorName.onTertiary:
        return onTertiary;
      case ThemeColorName.tertiaryContainer:
        return tertiaryContainer;
      case ThemeColorName.onTertiaryContainer:
        return onTertiaryContainer;
      case ThemeColorName.tertiaryFixed:
        return tertiaryFixed;
      case ThemeColorName.onTertiaryFixed:
        return onTertiaryFixed;
      case ThemeColorName.tertiaryFixedDim:
        return tertiaryFixedDim;
      case ThemeColorName.onTertiaryFixedVariant:
        return onTertiaryFixedVariant;
      case ThemeColorName.error:
        return error;
      case ThemeColorName.onError:
        return onError;
      case ThemeColorName.errorContainer:
        return errorContainer;
      case ThemeColorName.onErrorContainer:
        return onErrorContainer;
      case ThemeColorName.outline:
        return outline;
      case ThemeColorName.outlineVariant:
        return outlineVariant;
      case ThemeColorName.shadow:
        return shadow;
      case ThemeColorName.scrim:
        return scrim;
      case ThemeColorName.surfaceTint:
        return surfaceTint;
      case ThemeColorName.surface:
        return surface;
      case ThemeColorName.onSurface:
        return onSurface;
      case ThemeColorName.surfaceVariant:
        return surfaceVariant;
      case ThemeColorName.onSurfaceVariant:
        return onSurfaceVariant;
      case ThemeColorName.inverseSurface:
        return inverseSurface;
      case ThemeColorName.surfaceDim:
        return surfaceDim;
      case ThemeColorName.surfaceBright:
        return surfaceBright;
      case ThemeColorName.surfaceContainerLowest:
        return surfaceContainerLowest;
      case ThemeColorName.surfaceContainerLow:
        return surfaceContainerLow;
      case ThemeColorName.surfaceContainer:
        return surfaceContainer;
      case ThemeColorName.surfaceContainerHigh:
        return surfaceContainerHigh;
      case ThemeColorName.surfaceContainerHighest:
        return surfaceContainerHighest;
      case ThemeColorName.onInverseSurface:
        return onInverseSurface;
      case ThemeColorName.success:
        return success;
      case ThemeColorName.onSuccess:
        return onSuccess;
      case ThemeColorName.successContainer:
        return successContainer;
      case ThemeColorName.onSuccessContainer:
        return onSuccessContainer;
      case ThemeColorName.successFixed:
        return successFixed;
      case ThemeColorName.onSuccessFixed:
        return onSuccessFixed;
      case ThemeColorName.successFixedDim:
        return successFixedDim;
      case ThemeColorName.onSuccessFixedVariant:
        return onSuccessFixedVariant;
      case ThemeColorName.warning:
        return warning;
      case ThemeColorName.onWarning:
        return onWarning;
      case ThemeColorName.warningContainer:
        return warningContainer;
      case ThemeColorName.onWarningContainer:
        return onWarningContainer;
      case ThemeColorName.warningFixed:
        return warningFixed;
      case ThemeColorName.onWarningFixed:
        return onWarningFixed;
      case ThemeColorName.warningFixedDim:
        return warningFixedDim;
      case ThemeColorName.onWarningFixedVariant:
        return onWarningFixedVariant;
    }
  }

  @override
  Color getThemeOnColor(ThemeColorName name) {
    switch (name) {
      case ThemeColorName.primary:
        return onPrimary;
      case ThemeColorName.onPrimary:
        return primary;
      case ThemeColorName.primaryContainer:
        return onPrimaryContainer;
      case ThemeColorName.onPrimaryContainer:
        return primaryContainer;
      case ThemeColorName.primaryFixed:
        return onPrimaryFixed;
      case ThemeColorName.onPrimaryFixed:
        return primaryFixed;
      case ThemeColorName.primaryFixedDim:
        return primaryFixedDim;
      case ThemeColorName.inversePrimary:
        return inversePrimary;
      case ThemeColorName.onPrimaryFixedVariant:
        return onPrimaryFixedVariant;
      case ThemeColorName.secondary:
        return onSecondary;
      case ThemeColorName.onSecondary:
        return secondary;
      case ThemeColorName.secondaryContainer:
        return onSecondaryContainer;
      case ThemeColorName.onSecondaryContainer:
        return secondaryContainer;
      case ThemeColorName.secondaryFixed:
        return onSecondaryFixed;
      case ThemeColorName.onSecondaryFixed:
        return secondaryFixed;
      case ThemeColorName.secondaryFixedDim:
        return secondaryFixedDim;
      case ThemeColorName.onSecondaryFixedVariant:
        return onSecondaryFixedVariant;
      case ThemeColorName.tertiary:
        return onTertiary;
      case ThemeColorName.onTertiary:
        return tertiary;
      case ThemeColorName.tertiaryContainer:
        return onTertiaryContainer;
      case ThemeColorName.onTertiaryContainer:
        return tertiaryContainer;
      case ThemeColorName.tertiaryFixed:
        return onTertiaryFixed;
      case ThemeColorName.onTertiaryFixed:
        return tertiaryFixed;
      case ThemeColorName.tertiaryFixedDim:
        return tertiaryFixedDim;
      case ThemeColorName.onTertiaryFixedVariant:
        return onTertiaryFixedVariant;
      case ThemeColorName.error:
        return onError;
      case ThemeColorName.onError:
        return error;
      case ThemeColorName.errorContainer:
        return onErrorContainer;
      case ThemeColorName.onErrorContainer:
        return errorContainer;
      case ThemeColorName.outline:
        return outlineVariant;
      case ThemeColorName.outlineVariant:
        return outline;
      case ThemeColorName.shadow:
        return shadow;
      case ThemeColorName.scrim:
        return scrim;
      case ThemeColorName.surfaceTint:
        return surfaceTint;
      case ThemeColorName.surface:
        return onSurface;
      case ThemeColorName.onSurface:
        return surface;
      case ThemeColorName.surfaceVariant:
        return onSurfaceVariant;
      case ThemeColorName.onSurfaceVariant:
        return surfaceVariant;
      case ThemeColorName.inverseSurface:
        return inverseSurface;
      case ThemeColorName.surfaceDim:
        return surfaceDim;
      case ThemeColorName.surfaceBright:
        return surfaceBright;
      case ThemeColorName.surfaceContainerLowest:
        return onSurface;
      case ThemeColorName.surfaceContainerLow:
        return onSurface;
      case ThemeColorName.surfaceContainer:
        return onSurface;
      case ThemeColorName.surfaceContainerHigh:
        return onSurface;
      case ThemeColorName.surfaceContainerHighest:
        return onSurface;
      case ThemeColorName.onInverseSurface:
        return onInverseSurface;
      case ThemeColorName.success:
        return onSuccess;
      case ThemeColorName.onSuccess:
        return success;
      case ThemeColorName.successContainer:
        return onSuccessContainer;
      case ThemeColorName.onSuccessContainer:
        return successContainer;
      case ThemeColorName.successFixed:
        return onSuccessFixed;
      case ThemeColorName.onSuccessFixed:
        return successFixed;
      case ThemeColorName.successFixedDim:
        return successFixedDim;
      case ThemeColorName.onSuccessFixedVariant:
        return onSuccessFixedVariant;
      case ThemeColorName.warning:
        return onWarning;
      case ThemeColorName.onWarning:
        return warning;
      case ThemeColorName.warningContainer:
        return onWarningContainer;
      case ThemeColorName.onWarningContainer:
        return warningContainer;
      case ThemeColorName.warningFixed:
        return onWarningFixed;
      case ThemeColorName.onWarningFixed:
        return warningFixed;
      case ThemeColorName.warningFixedDim:
        return warningFixedDim;
      case ThemeColorName.onWarningFixedVariant:
        return onWarningFixedVariant;
    }
  }
}

class DarkTheme implements ITheme {
  @override
  Brightness brightness = Brightness.dark;

  @override
  Color primary = Color.fromRGBO(128, 212, 217, 1);
  @override
  Color onPrimary = Color.fromRGBO(0, 55, 57, 1);
  @override
  Color primaryContainer = Color.fromRGBO(0, 79, 83, 1);
  @override
  Color onPrimaryContainer = Color.fromRGBO(156, 240, 246, 1);
  @override
  Color primaryFixed = Color.fromRGBO(156, 240, 246, 1);
  @override
  Color onPrimaryFixed = Color.fromRGBO(0, 32, 33, 1);
  @override
  Color primaryFixedDim = Color.fromRGBO(128, 212, 217, 1);
  @override
  Color onPrimaryFixedVariant = Color.fromRGBO(0, 79, 83, 1);

  @override
  Color inversePrimary = Color.fromRGBO(0, 105, 110, 1);

  @override
  Color secondary = Color.fromRGBO(170, 199, 255, 1);
  @override
  Color onSecondary = Color.fromRGBO(10, 48, 95, 1);
  @override
  Color secondaryContainer = Color.fromRGBO(39, 71, 119, 1);
  @override
  Color onSecondaryContainer = Color.fromRGBO(214, 227, 255, 1);
  @override
  Color secondaryFixed = Color.fromRGBO(214, 227, 255, 1);
  @override
  Color onSecondaryFixed = Color.fromRGBO(0, 27, 62, 1);
  @override
  Color secondaryFixedDim = Color.fromRGBO(170, 199, 255, 1);
  @override
  Color onSecondaryFixedVariant = Color.fromRGBO(39, 71, 119, 1);

  @override
  Color tertiary = Color.fromRGBO(182, 199, 233, 1);
  @override
  Color onTertiary = Color.fromRGBO(31, 49, 76, 1);
  @override
  Color tertiaryContainer = Color.fromRGBO(54, 71, 100, 1);
  @override
  Color onTertiaryContainer = Color.fromRGBO(214, 227, 255, 1);
  @override
  Color tertiaryFixed = Color.fromRGBO(214, 227, 255, 1);
  @override
  Color onTertiaryFixed = Color.fromRGBO(8, 28, 54, 1);
  @override
  Color tertiaryFixedDim = Color.fromRGBO(182, 199, 233, 1);
  @override
  Color onTertiaryFixedVariant = Color.fromRGBO(54, 71, 100, 1);

  @override
  Color error = Color.fromRGBO(255, 180, 171, 1);
  @override
  Color onError = Color.fromRGBO(105, 0, 5, 1);
  @override
  Color errorContainer = Color.fromRGBO(147, 0, 10, 1);
  @override
  Color onErrorContainer = Color.fromRGBO(255, 218, 214, 1);

  @override
  Color outline = Color.fromRGBO(137, 147, 147, 1);
  @override
  Color outlineVariant = Color.fromRGBO(63, 73, 73, 1);

  @override
  Color shadow = Color.fromRGBO(0, 0, 0, 1);
  @override
  Color scrim = Color.fromRGBO(0, 0, 0, 1);

  @override
  Color surfaceTint = Color.fromRGBO(128, 212, 217, 1);
  @override
  Color surface = Color.fromRGBO(14, 20, 21, 1);
  @override
  Color onSurface = Color.fromRGBO(221, 228, 228, 1);
  @override
  Color surfaceVariant = Color.fromRGBO(63, 73, 73, 1);
  @override
  Color onSurfaceVariant = Color.fromRGBO(190, 200, 201, 1);
  @override
  Color inverseSurface = Color.fromRGBO(221, 228, 228, 1);
  @override
  Color surfaceDim = Color.fromRGBO(14, 20, 21, 1);
  @override
  Color surfaceBright = Color.fromRGBO(52, 58, 59, 1);
  @override
  Color surfaceContainerLowest = Color.fromRGBO(9, 15, 16, 1);
  @override
  Color surfaceContainerLow = Color.fromRGBO(22, 29, 29, 1);
  @override
  Color surfaceContainer = Color.fromRGBO(26, 33, 33, 1);
  @override
  Color surfaceContainerHigh = Color.fromRGBO(37, 43, 43, 1);
  @override
  Color surfaceContainerHighest = Color.fromRGBO(48, 54, 54, 1);
  @override
  Color onInverseSurface = Color.fromRGBO(43, 50, 50, 1);

  @override
  Color success = Color.fromRGBO(178, 230, 198, 1);
  @override
  Color onSuccess = Color.fromRGBO(38, 76, 53, 1);
  @override
  Color successContainer = Color.fromRGBO(51, 102, 70, 1);
  @override
  Color onSuccessContainer = Color.fromRGBO(193, 230, 207, 1);
  @override
  Color successFixed = Color.fromRGBO(193, 230, 207, 1);
  @override
  Color onSuccessFixed = Color.fromRGBO(25, 51, 35, 1);
  @override
  Color successFixedDim = Color.fromRGBO(178, 230, 198, 1);
  @override
  Color onSuccessFixedVariant = Color.fromRGBO(51, 102, 70, 1);

  @override
  Color warning = Color.fromRGBO(230, 211, 137, 1);
  @override
  Color onWarning = Color.fromRGBO(76, 63, 8, 1);
  @override
  Color warningContainer = Color.fromRGBO(102, 84, 10, 1);
  @override
  Color onWarningContainer = Color.fromRGBO(230, 216, 164, 1);
  @override
  Color warningFixed = Color.fromRGBO(230, 216, 164, 1);
  @override
  Color onWarningFixed = Color.fromRGBO(51, 42, 5, 1);
  @override
  Color warningFixedDim = Color.fromRGBO(230, 211, 137, 1);
  @override
  Color onWarningFixedVariant = Color.fromRGBO(102, 84, 10, 1);

  @override
  Color getThemeColor(ThemeColorName name) {
    switch (name) {
      case ThemeColorName.primary:
        return primary;
      case ThemeColorName.onPrimary:
        return onPrimary;
      case ThemeColorName.primaryContainer:
        return primaryContainer;
      case ThemeColorName.onPrimaryContainer:
        return onPrimaryContainer;
      case ThemeColorName.primaryFixed:
        return primaryFixed;
      case ThemeColorName.onPrimaryFixed:
        return onPrimaryFixed;
      case ThemeColorName.primaryFixedDim:
        return primaryFixedDim;
      case ThemeColorName.inversePrimary:
        return inversePrimary;
      case ThemeColorName.onPrimaryFixedVariant:
        return onPrimaryFixedVariant;
      case ThemeColorName.secondary:
        return secondary;
      case ThemeColorName.onSecondary:
        return onSecondary;
      case ThemeColorName.secondaryContainer:
        return secondaryContainer;
      case ThemeColorName.onSecondaryContainer:
        return onSecondaryContainer;
      case ThemeColorName.secondaryFixed:
        return secondaryFixed;
      case ThemeColorName.onSecondaryFixed:
        return onSecondaryFixed;
      case ThemeColorName.secondaryFixedDim:
        return secondaryFixedDim;
      case ThemeColorName.onSecondaryFixedVariant:
        return onSecondaryFixedVariant;
      case ThemeColorName.tertiary:
        return tertiary;
      case ThemeColorName.onTertiary:
        return onTertiary;
      case ThemeColorName.tertiaryContainer:
        return tertiaryContainer;
      case ThemeColorName.onTertiaryContainer:
        return onTertiaryContainer;
      case ThemeColorName.tertiaryFixed:
        return tertiaryFixed;
      case ThemeColorName.onTertiaryFixed:
        return onTertiaryFixed;
      case ThemeColorName.tertiaryFixedDim:
        return tertiaryFixedDim;
      case ThemeColorName.onTertiaryFixedVariant:
        return onTertiaryFixedVariant;
      case ThemeColorName.error:
        return error;
      case ThemeColorName.onError:
        return onError;
      case ThemeColorName.errorContainer:
        return errorContainer;
      case ThemeColorName.onErrorContainer:
        return onErrorContainer;
      case ThemeColorName.outline:
        return outline;
      case ThemeColorName.outlineVariant:
        return outlineVariant;
      case ThemeColorName.shadow:
        return shadow;
      case ThemeColorName.scrim:
        return scrim;
      case ThemeColorName.surfaceTint:
        return surfaceTint;
      case ThemeColorName.surface:
        return surface;
      case ThemeColorName.onSurface:
        return onSurface;
      case ThemeColorName.surfaceVariant:
        return surfaceVariant;
      case ThemeColorName.onSurfaceVariant:
        return onSurfaceVariant;
      case ThemeColorName.inverseSurface:
        return inverseSurface;
      case ThemeColorName.surfaceDim:
        return surfaceDim;
      case ThemeColorName.surfaceBright:
        return surfaceBright;
      case ThemeColorName.surfaceContainerLowest:
        return surfaceContainerLowest;
      case ThemeColorName.surfaceContainerLow:
        return surfaceContainerLow;
      case ThemeColorName.surfaceContainer:
        return surfaceContainer;
      case ThemeColorName.surfaceContainerHigh:
        return surfaceContainerHigh;
      case ThemeColorName.surfaceContainerHighest:
        return surfaceContainerHighest;
      case ThemeColorName.onInverseSurface:
        return onInverseSurface;
      case ThemeColorName.success:
        return success;
      case ThemeColorName.onSuccess:
        return onSuccess;
      case ThemeColorName.successContainer:
        return successContainer;
      case ThemeColorName.onSuccessContainer:
        return onSuccessContainer;
      case ThemeColorName.successFixed:
        return successFixed;
      case ThemeColorName.onSuccessFixed:
        return onSuccessFixed;
      case ThemeColorName.successFixedDim:
        return successFixedDim;
      case ThemeColorName.onSuccessFixedVariant:
        return onSuccessFixedVariant;
      case ThemeColorName.warning:
        return warning;
      case ThemeColorName.onWarning:
        return onWarning;
      case ThemeColorName.warningContainer:
        return warningContainer;
      case ThemeColorName.onWarningContainer:
        return onWarningContainer;
      case ThemeColorName.warningFixed:
        return warningFixed;
      case ThemeColorName.onWarningFixed:
        return onWarningFixed;
      case ThemeColorName.warningFixedDim:
        return warningFixedDim;
      case ThemeColorName.onWarningFixedVariant:
        return onWarningFixedVariant;
    }
  }

  @override
  Color getThemeOnColor(ThemeColorName name) {
    switch (name) {
      case ThemeColorName.primary:
        return onPrimary;
      case ThemeColorName.onPrimary:
        return primary;
      case ThemeColorName.primaryContainer:
        return onPrimaryContainer;
      case ThemeColorName.onPrimaryContainer:
        return primaryContainer;
      case ThemeColorName.primaryFixed:
        return onPrimaryFixed;
      case ThemeColorName.onPrimaryFixed:
        return primaryFixed;
      case ThemeColorName.primaryFixedDim:
        return primaryFixedDim;
      case ThemeColorName.inversePrimary:
        return inversePrimary;
      case ThemeColorName.onPrimaryFixedVariant:
        return onPrimaryFixedVariant;
      case ThemeColorName.secondary:
        return onSecondary;
      case ThemeColorName.onSecondary:
        return secondary;
      case ThemeColorName.secondaryContainer:
        return onSecondaryContainer;
      case ThemeColorName.onSecondaryContainer:
        return secondaryContainer;
      case ThemeColorName.secondaryFixed:
        return onSecondaryFixed;
      case ThemeColorName.onSecondaryFixed:
        return secondaryFixed;
      case ThemeColorName.secondaryFixedDim:
        return secondaryFixedDim;
      case ThemeColorName.onSecondaryFixedVariant:
        return onSecondaryFixedVariant;
      case ThemeColorName.tertiary:
        return onTertiary;
      case ThemeColorName.onTertiary:
        return tertiary;
      case ThemeColorName.tertiaryContainer:
        return onTertiaryContainer;
      case ThemeColorName.onTertiaryContainer:
        return tertiaryContainer;
      case ThemeColorName.tertiaryFixed:
        return onTertiaryFixed;
      case ThemeColorName.onTertiaryFixed:
        return tertiaryFixed;
      case ThemeColorName.tertiaryFixedDim:
        return tertiaryFixedDim;
      case ThemeColorName.onTertiaryFixedVariant:
        return onTertiaryFixedVariant;
      case ThemeColorName.error:
        return onError;
      case ThemeColorName.onError:
        return error;
      case ThemeColorName.errorContainer:
        return onErrorContainer;
      case ThemeColorName.onErrorContainer:
        return errorContainer;
      case ThemeColorName.outline:
        return outlineVariant;
      case ThemeColorName.outlineVariant:
        return outline;
      case ThemeColorName.shadow:
        return shadow;
      case ThemeColorName.scrim:
        return scrim;
      case ThemeColorName.surfaceTint:
        return surfaceTint;
      case ThemeColorName.surface:
        return onSurface;
      case ThemeColorName.onSurface:
        return surface;
      case ThemeColorName.surfaceVariant:
        return onSurfaceVariant;
      case ThemeColorName.onSurfaceVariant:
        return surfaceVariant;
      case ThemeColorName.inverseSurface:
        return inverseSurface;
      case ThemeColorName.surfaceDim:
        return surfaceDim;
      case ThemeColorName.surfaceBright:
        return surfaceBright;
      case ThemeColorName.surfaceContainerLowest:
        return onSurface;
      case ThemeColorName.surfaceContainerLow:
        return onSurface;
      case ThemeColorName.surfaceContainer:
        return onSurface;
      case ThemeColorName.surfaceContainerHigh:
        return onSurface;
      case ThemeColorName.surfaceContainerHighest:
        return onSurface;
      case ThemeColorName.onInverseSurface:
        return onInverseSurface;
      case ThemeColorName.success:
        return onSuccess;
      case ThemeColorName.onSuccess:
        return success;
      case ThemeColorName.successContainer:
        return onSuccessContainer;
      case ThemeColorName.onSuccessContainer:
        return successContainer;
      case ThemeColorName.successFixed:
        return onSuccessFixed;
      case ThemeColorName.onSuccessFixed:
        return successFixed;
      case ThemeColorName.successFixedDim:
        return successFixedDim;
      case ThemeColorName.onSuccessFixedVariant:
        return onSuccessFixedVariant;
      case ThemeColorName.warning:
        return onWarning;
      case ThemeColorName.onWarning:
        return warning;
      case ThemeColorName.warningContainer:
        return onWarningContainer;
      case ThemeColorName.onWarningContainer:
        return warningContainer;
      case ThemeColorName.warningFixed:
        return onWarningFixed;
      case ThemeColorName.onWarningFixed:
        return warningFixed;
      case ThemeColorName.warningFixedDim:
        return warningFixedDim;
      case ThemeColorName.onWarningFixedVariant:
        return onWarningFixedVariant;
    }
  }
}
