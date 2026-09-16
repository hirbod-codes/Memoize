import 'package:client/auth/auth_controller.dart';
import 'package:client/auth/auth_state.dart';
import 'package:client/components/button.dart';
import 'package:client/components/nav_bar.dart';
import 'package:client/components/nav_destinations.dart';
import 'package:client/components/topbar.dart';
import 'package:client/l10n/app_localizations.dart';
import 'package:client/localization/components/locale_switcher.dart';
import 'package:client/theme/theme_colors.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_spacing.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
    final theme = Theme.of(context);
    final iTheme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    final maxWidth = context.size?.width ?? 0;
    final spacing = getSpacing(maxWidth);

    final content = Container(width: double.infinity, height: double.infinity, padding: EdgeInsetsGeometry.all(spacing.padding), child: child);

    bool unauthenticated = ref.read(authControllerProvider).status == AuthStatus.unauthenticated;
    if (unauthenticated) {
      AppLocalizations l10n = AppLocalizations.of(context)!;

      return Scaffold(
        backgroundColor: iTheme.surface,
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Text('Memoize', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                  const Spacer(),
                  const LocaleSwitcher(),
                  const SizedBox(width: 4),
                  Button(
                    icon: ref.watch(themeModeProvider) == ThemeMode.dark ? Icons.light_mode : Icons.dark_mode,
                    color: ThemeColorName.primary,
                    type: ButtonType.text,
                    onPressed: () => ref.read(themeModeProvider.notifier).toggle(),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(onPressed: () => context.go('/login'), child: Text(l10n.login)),
                ],
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Wrap(
                spacing: 8,
                children: [
                  TextButton(onPressed: () => context.go('/pricing'), child: Text(l10n.title_pricing)),
                  TextButton(onPressed: () => context.go('/about'), child: Text(l10n.title_about_us)),
                  TextButton(onPressed: () => context.go('/contact'), child: Text(l10n.title_contact_us)),
                ],
              ),
            ),
            Expanded(child: SingleChildScrollView(child: child)),
          ],
        ),
      );
    } else {
      final showNav = navDestinations.length >= 2;
      final placement = NavBar.placementFor(maxWidth);
      final navOnSide = showNav && placement != NavBarPlacement.bottom;
      final navOnBottom = showNav && placement == NavBarPlacement.bottom;

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
        backgroundColor: iTheme.surface,
        appBar: TopBar(title: title),
        body: Expanded(child: SingleChildScrollView(child: body)),
        bottomNavigationBar: (navOnBottom ? const NavBar(placement: NavBarPlacement.bottom) : null),
      );
    }

    // return LayoutBuilder(
    //   builder: (context, constraints) {
    //     final maxWidth = constraints.maxWidth;
    //     final spacing = getSpacing(maxWidth);

    //     final showNav = navDestinations.length >= 2;
    //     final placement = NavBar.placementFor(maxWidth);
    //     final navOnSide = showNav && placement != NavBarPlacement.bottom;
    //     final navOnBottom = showNav && placement == NavBarPlacement.bottom;

    //     final content = Container(width: double.infinity, height: double.infinity, padding: EdgeInsetsGeometry.all(spacing.padding), child: child);

    //     bool unauthenticated = ref.read(authControllerProvider).status == AuthStatus.unauthenticated;

    //     final body = unauthenticated
    //         ? content
    //         : (navOnSide
    //               ? Row(
    //                   crossAxisAlignment: CrossAxisAlignment.stretch,
    //                   children: [
    //                     NavBar(placement: placement),
    //                     const VerticalDivider(width: 1),
    //                     Expanded(child: content),
    //                   ],
    //                 )
    //               : content);

    //     return Scaffold(
    //       backgroundColor: theme.surface,
    //       appBar: TopBar(title: title),
    //       body: Expanded(child: SingleChildScrollView(child: body)),
    //       // SingleChildScrollView(child: body),
    //       bottomNavigationBar: unauthenticated ? null : (navOnBottom ? const NavBar(placement: NavBarPlacement.bottom) : null),
    //     );
    //   },
    // );
  }
}
