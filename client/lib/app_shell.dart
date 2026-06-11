import 'package:client/components/navbar.dart';
import 'package:client/components/topbar.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AppShell extends ConsumerWidget {
  final Widget child;
  final Widget? title;

  const AppShell({super.key, required this.child, this.title});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));
    return Scaffold(
      backgroundColor: theme.surface,
      appBar: TopBar(title: title),
      body: Container(width: .infinity, height: .infinity, padding: EdgeInsetsGeometry.all(20), child: child),
      bottomNavigationBar: NavBar(currentIndex: 0, onChanged: (i) {}),
    );
  }
}
