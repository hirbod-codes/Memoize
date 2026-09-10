import 'dart:async';

import 'package:client/api/root_navigator_key.dart';
import 'package:client/components/button.dart';
import 'package:client/main.dart';
import 'package:client/theme/theme_colors.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';

class NotificationService {
  static OverlayState? _resolveOverlay(BuildContext context) {
    return Overlay.maybeOf(context) ?? rootNavigatorKey.currentState?.overlay;
  }

  static void showError({required BuildContext context, required String message, Duration? duration}) {
    final theme = ThemeModeNotifier.getTheme(container.read(themeModeProvider));

    final overlay = _resolveOverlay(context);
    if (overlay == null) return;

    OverlayEntry? entry;
    Timer? timer;

    // Both the auto-dismiss timer and the manual close button need to
    // remove the same entry, and either one can fire first — a plain
    // `entry?.remove()` in each place would double-remove if the user
    // taps close right before the timer was going to fire anyway.
    // Routing both through one guarded dismiss() makes a second call
    // (from whichever path loses the race) a safe no-op instead of an
    // assertion failure.
    void dismiss() {
      timer?.cancel();
      entry?.remove();
      entry = null;
    }

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
                Expanded(
                  child: Text(message, style: TextStyle(color: theme.onError)),
                ),
                Button(type: ButtonType.text, icon: Icons.close, color: ThemeColorName.onError, onPressed: dismiss),
              ],
            ),
          ),
        ),
      ),
    );

    overlay.insert(entry!);

    timer = Timer(duration ?? const Duration(seconds: 6), dismiss);
  }

  static void showSuccess({required BuildContext context, required String message, Duration? duration}) {
    final theme = ThemeModeNotifier.getTheme(container.read(themeModeProvider));

    final overlay = _resolveOverlay(context);
    if (overlay == null) return;

    OverlayEntry? entry;
    Timer? timer;

    void dismiss() {
      timer?.cancel();
      entry?.remove();
      entry = null;
    }

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
                Expanded(
                  child: Text(message, style: TextStyle(color: theme.onSuccess)),
                ),
                Button(type: ButtonType.text, icon: Icons.close, color: ThemeColorName.onSuccess, onPressed: dismiss),
              ],
            ),
          ),
        ),
      ),
    );

    overlay.insert(entry!);

    timer = Timer(duration ?? const Duration(seconds: 6), dismiss);
  }
}
