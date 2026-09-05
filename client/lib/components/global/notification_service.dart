import 'package:client/api/root_navigator_key.dart';
import 'package:client/components/button.dart';
import 'package:client/main.dart';
import 'package:client/theme/theme_colors.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';

class NotificationService {
  /// Resolves an OverlayState for [context].
  ///
  /// For a context that comes from inside the widget tree (a widget's own
  /// `context`), `Overlay.maybeOf` finds the ancestor Overlay normally.
  ///
  /// For `rootNavigatorKey.currentContext` — the context of the Navigator
  /// widget itself, used by the global error interceptor which has no
  /// widget context of its own — `Overlay.maybeOf` returns null, because
  /// the Overlay a Navigator manages is a *descendant* of the Navigator's
  /// own context, not an ancestor. `NavigatorState.overlay` sidesteps the
  /// ancestor search entirely and hands back the OverlayState directly.
  static OverlayState? _resolveOverlay(BuildContext context) {
    return Overlay.maybeOf(context) ?? rootNavigatorKey.currentState?.overlay;
  }

  static void showError({required BuildContext context, required String message, Duration? duration}) {
    final theme = ThemeModeNotifier.getTheme(container.read(themeModeProvider));

    final overlay = _resolveOverlay(context);
    if (overlay == null) return; // nothing mounted yet to show this on

    OverlayEntry? entry;

    entry = OverlayEntry(
      builder: (_) => Positioned(
        top: MediaQuery.of(context).padding.top + 16,
        left: 16,
        right: 16,
        child: Material(
          elevation: 4,
          borderRadius: BorderRadius.circular(8),
          color: theme.error,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(message, style: TextStyle(color: theme.onError)),
                Button(
                  type: ButtonType.text,
                  icon: Icons.close,
                  color: ThemeColorName.onError,
                  onPressed: () {
                    entry?.remove();
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );

    overlay.insert(entry);

    Future.delayed(duration ?? const Duration(seconds: 6), () {
      entry?.remove();
    });
  }

  static void showSuccess({required BuildContext context, required String message, Duration? duration}) {
    final theme = ThemeModeNotifier.getTheme(container.read(themeModeProvider));

    final overlay = _resolveOverlay(context);
    if (overlay == null) return;

    late OverlayEntry? entry;

    entry = OverlayEntry(
      builder: (_) => Positioned(
        top: MediaQuery.of(context).padding.top + 16,
        left: 16,
        right: 16,
        child: Material(
          elevation: 4,
          borderRadius: BorderRadius.circular(8),
          color: theme.success,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(message, style: TextStyle(color: theme.onSuccess)),
                Button(
                  type: ButtonType.text,
                  icon: Icons.close,
                  color: ThemeColorName.onSuccess,
                  onPressed: () {
                    entry?.remove();
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );

    overlay.insert(entry);

    Future.delayed(duration ?? const Duration(seconds: 6), () {
      entry?.remove();
    });
  }
}
