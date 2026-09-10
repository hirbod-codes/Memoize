import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'error_page.dart';

/// Shown by GoRouter's errorBuilder when no route matches the current
/// location. go_router routes both "unmatched path" and "an error was
/// thrown during redirect/build" through this same builder — there's
/// no separate not-found-specific hook — so [state] and its `.error`
/// are optional here in case this ever gets reused for a non-routing
/// error path too.
class NotFoundPage extends StatelessWidget {
  final GoRouterState? state;

  const NotFoundPage({super.key, this.state});

  @override
  Widget build(BuildContext context) {
    final path = state?.uri.toString();
    return ErrorPage(message: path != null ? "We couldn't find \"$path\"." : "We couldn't find that page.", showHomeButton: true);
  }
}
