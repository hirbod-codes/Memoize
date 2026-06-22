import 'package:client/components/button.dart';
import 'package:client/main.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';

class NotificationService {
  static void showError({required BuildContext context, required String message, Duration? duration}) {
    final theme = ThemeModeNotifier.getTheme(container.read(themeModeProvider));

    final overlay = Overlay.of(context);

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
              mainAxisAlignment: .spaceBetween,
              crossAxisAlignment: .center,
              children: [
                Text(message, style: TextStyle(color: theme.onError)),
                Button(
                  type: .text,
                  icon: Icons.close,
                  color: .onError,
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

    final overlay = Overlay.of(context);

    late OverlayEntry entry;

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
              mainAxisAlignment: .spaceBetween,
              crossAxisAlignment: .center,
              children: [
                Text(message, style: TextStyle(color: theme.onSuccess)),
                Button(
                  type: .text,
                  icon: Icons.close,
                  color: .onSuccess,
                  onPressed: () {
                    entry.remove();
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
      entry.remove();
    });
  }
}
