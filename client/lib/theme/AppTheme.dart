import 'package:client/theme/AppColors.dart';
import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData light() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.light(primary: AppColors.primary),
      textTheme: const TextTheme(bodyMedium: TextStyle(fontSize: 14)),
    );
  }

  static ThemeData dark() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.dark(primary: AppColors.primary),
      textTheme: const TextTheme(bodyMedium: TextStyle(fontSize: 14)),
    );
  }
}
