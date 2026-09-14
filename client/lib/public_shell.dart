import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  }
}
