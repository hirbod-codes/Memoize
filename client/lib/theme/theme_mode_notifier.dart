import 'package:client/theme/theme_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ThemeModeNotifier extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    return ThemeMode.system;
  }

  void toggle() {
    state = switch (state) {
      ThemeMode.light => ThemeMode.dark,
      ThemeMode.dark => ThemeMode.light,
      ThemeMode.system => ThemeMode.dark,
    };
  }

  void setTheme(ThemeMode mode) {
    state = mode;
  }

  static ITheme getTheme(ThemeMode state) {
    if (state == ThemeMode.dark) return DarkTheme();
    if (state == ThemeMode.light) return LightTheme();
    if (state == ThemeMode.system) return DarkTheme();

    throw Exception();
  }
}

final themeModeProvider = NotifierProvider<ThemeModeNotifier, ThemeMode>(ThemeModeNotifier.new);
