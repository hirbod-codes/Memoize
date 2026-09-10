import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'nav_destinations.dart';

/// Which physical form the nav takes at a given width. AppShell reads
/// this to decide where to place the widget (Scaffold.bottomNavigationBar
/// vs. beside the body in a Row) — NavigationBar and NavigationRail
/// attach to fundamentally different Scaffold slots, so the shell needs
/// to know which one it's dealing with, not just "render a nav".
enum NavBarPlacement { bottom, rail, extendedRail }

class NavBar extends StatelessWidget {
  final NavBarPlacement placement;

  const NavBar({super.key, required this.placement});

  // Standard Material 3 adaptive breakpoints. Align these with your
  // theme_spacing.dart breakpoints if those differ — kept independent
  // here since I don't have that file's exact thresholds.
  static const railBreakpoint = 600.0;
  static const extendedRailBreakpoint = 1024.0;

  static NavBarPlacement placementFor(double width) {
    if (width < railBreakpoint) return NavBarPlacement.bottom;
    if (width < extendedRailBreakpoint) return NavBarPlacement.rail;
    return NavBarPlacement.extendedRail;
  }

  int _selectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final index = navDestinations.indexWhere((d) => d.path == location);
    return index == -1 ? 0 : index;
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = _selectedIndex(context);

    if (placement == NavBarPlacement.bottom) {
      return NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (i) => context.go(navDestinations[i].path),
        destinations: [
          for (final d in navDestinations)
            NavigationDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selectedIcon ?? d.icon), label: d.label),
        ],
      );
    }

    final extended = placement == NavBarPlacement.extendedRail;
    return NavigationRail(
      selectedIndex: selectedIndex,
      onDestinationSelected: (i) => context.go(navDestinations[i].path),
      extended: extended,
      // extended rails show the label inline already — labelType must
      // be none in that case, or Flutter throws an assertion error.
      labelType: extended ? NavigationRailLabelType.none : NavigationRailLabelType.selected,
      destinations: [
        for (final d in navDestinations)
          NavigationRailDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selectedIcon ?? d.icon), label: Text(d.label)),
      ],
    );
  }
}