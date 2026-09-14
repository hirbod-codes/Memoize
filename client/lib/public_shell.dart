import 'package:client/components/button.dart';
import 'package:client/localization/components/locale_switcher.dart';
import 'package:client/theme/theme_colors.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Minimal shell for pages that shouldn't carry AppShell's chrome — no
/// NavBar, no logout/theme-toggle actions from TopBar. A public
/// landing page or marketing home doesn't want a logout button before
/// the visitor has even signed up.
///
/// Deliberately bare: no AppBar at all here. If a page using this shell
/// needs its own header (logo + "Log in" CTA, say), build that inside
/// [child] rather than adding flags to this shell — different pages
/// using PublicShell will likely want different headers, and a
/// one-size-fits-all header here would just turn into the same
/// flag-sprawl problem AppShell was avoided.
class PublicShell extends ConsumerWidget {
  final Widget child;

  const PublicShell({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    return Scaffold(backgroundColor: theme.surface, body: child);

    // return Scaffold(
    //   backgroundColor: theme.surface,
    //   body: Column(
    //     children: [
    //       Padding(
    //         padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    //         child: Row(
    //           children: [
    //             Text(
    //               'Memoize',
    //               style: TextStyle(fontWeight: FontWeight.bold, color: theme.onSurface),
    //             ),
    //             const Spacer(),
    //             const LocaleSwitcher(),
    //             const SizedBox(width: 4),
    //             Button(
    //               icon: ref.watch(themeModeProvider) == ThemeMode.dark ? Icons.light_mode : Icons.dark_mode,
    //               color: ThemeColorName.primary,
    //               type: ButtonType.text,
    //               onPressed: () => ref.read(themeModeProvider.notifier).toggle(),
    //             ),
    //             const SizedBox(width: 8),
    //             FilledButton(onPressed: () => context.go('/login'), child: const Text('Log in')),
    //           ],
    //         ),
    //       ),
    //       const Divider(height: 1),
    //       Padding(
    //         padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    //         child: Wrap(
    //           spacing: 8,
    //           children: [
    //             TextButton(onPressed: () => context.go('/pricing'), child: const Text('Pricing')),
    //             TextButton(onPressed: () => context.go('/about'), child: const Text('About us')),
    //             TextButton(onPressed: () => context.go('/contact'), child: const Text('Contact us')),
    //           ],
    //         ),
    //       ),
    //       child,
    //     ],
    //   ),
    // );
  }
}
