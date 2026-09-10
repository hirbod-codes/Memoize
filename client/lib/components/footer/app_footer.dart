import 'package:client/components/footer/enamad/badge.dart';
import 'package:flutter/material.dart';

/// Renders nothing on mobile/desktop — a footer bar makes sense on a
/// web page, not inside a native app's screen. This check alone is
/// enough here (unlike FooterBadge, this widget doesn't touch dart:html
/// directly, so a plain runtime kIsWeb check compiles fine everywhere).
class AppFooter extends StatelessWidget {
  const AppFooter({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: theme.dividerColor)),
      ),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        runSpacing: 12,
        children: [
          Text('© ${DateTime.now().year} Memoize', style: theme.textTheme.bodySmall),
          const FooterBadge(),
          Text('© ${DateTime.now().year} Memoize', style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }
}
