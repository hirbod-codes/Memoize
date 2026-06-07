import 'package:client/GoRouter.dart';
import 'package:client/theme/AppTheme.dart';
import 'package:client/theme/ThemeModeNotifier.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  runApp(ProviderScope(child: const MyApp()));
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(routerConfig: goRouter, title: 'Memoize', theme: AppTheme.light(), darkTheme: AppTheme.dark(), themeMode: themeMode);
  }
}
