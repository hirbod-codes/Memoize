import 'package:client/components/nav_bar.dart';
import 'package:client/components/nav_destinations.dart';
import 'package:client/components/topbar.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_spacing.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The main app chrome: TopBar always on top, NavBar adapting between
/// bottom placement (narrow) and a side rail (medium/wide), wrapping
/// whatever page content is passed in. Used for every authenticated
/// route — pages that shouldn't carry this chrome (a public landing
/// page, say) use a different shell entirely rather than this one with
/// flags to disable pieces of it. See public_shell.dart.
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

        final showNav = navDestinations.length >= 2;
        final placement = NavBar.placementFor(maxWidth);
        final navOnSide = showNav && placement != NavBarPlacement.bottom;
        final navOnBottom = showNav && placement == NavBarPlacement.bottom;

        final content = Container(width: double.infinity, height: double.infinity, padding: EdgeInsetsGeometry.all(spacing.padding), child: child);

        final body = navOnSide
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  NavBar(placement: placement),
                  const VerticalDivider(width: 1),
                  Expanded(child: content),
                ],
              )
            : content;

        return Scaffold(
          backgroundColor: theme.surface,
          appBar: TopBar(title: title),
          body: body,
          bottomNavigationBar: navOnBottom ? const NavBar(placement: NavBarPlacement.bottom) : null,
        );
      },
    );
  }
}
