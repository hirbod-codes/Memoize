import 'package:client/components/button.dart';
import 'package:client/l10n/app_localizations.dart';
import 'package:client/localization/components/locale_switcher.dart';
import 'package:client/theme/theme_colors.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Shell for public/unauthenticated pages — carries the shared
/// two-row header (app name + locale/theme controls + "Log in" on the
/// first row, marketing nav links on the second) so every public page
/// gets consistent navigation instead of each one rebuilding it.
///
/// The header is fixed/pinned; only [child] scrolls, and this is the
/// ONLY place scrolling should happen for public pages now — a page
/// like LandingPage should NOT wrap itself in its own
/// SingleChildScrollView anymore. Nesting one scrollable inside
/// another with no bounded height in between is exactly what caused
/// the original bug: a SingleChildScrollView placed as a plain Column
/// child, with no Expanded around it, has no idea how much space it
/// actually has.
class PublicShell extends ConsumerWidget {
  final Widget child;

  const PublicShell({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final iTheme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

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
  }
}
