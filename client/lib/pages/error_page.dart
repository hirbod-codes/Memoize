import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Generic full-page error display. Worth using this instead of a
/// page-local `_RetryState` widget (pricing_page.dart, auth_page.dart,
/// and settings_page.dart each built their own near-identical version)
/// — one shared widget instead of three copies drifting apart over time.
class ErrorPage extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  final bool showHomeButton;

  const ErrorPage({super.key, this.message = 'Something went wrong.', this.onRetry, this.showHomeButton = false});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: Theme.of(context).colorScheme.error),
              const SizedBox(height: 16),
              Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
              const SizedBox(height: 24),
              Wrap(
                spacing: 12,
                alignment: WrapAlignment.center,
                children: [
                  if (onRetry != null) OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
                  if (showHomeButton) FilledButton(onPressed: () => context.go('/'), child: const Text('Go home')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
