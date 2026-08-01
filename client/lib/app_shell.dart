// import 'package:client/components/navbar.dart';
import 'package:client/components/topbar.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_spacing.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AppShell extends ConsumerWidget {
  final Widget child;
  final Widget? title;

  const AppShell({super.key, required this.child, this.title});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth;
        final spacing = getSpacing(maxWidth);

        return Scaffold(
          backgroundColor: theme.surface,
          appBar: TopBar(title: title),
          body: Container(width: double.infinity, height: double.infinity, padding: EdgeInsetsGeometry.all(spacing.padding), child: child),
          // NavigationBar requires at least two destinations.
          // bottomNavigationBar: NavBar(currentIndex: 0, onChanged: (i) {}),
        );
      },
    );
  }
}
