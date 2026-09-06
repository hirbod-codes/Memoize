import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/models/auth_models.dart';
import '../auth/widgets/email_password_form.dart';
import '../auth/widgets/phone_otp_form.dart';
import 'supported_auth_methods_provider.dart';

/// Top-level auth page. Toggles between email+password (with its own
/// login/signup toggle and forgot-password link) and passwordless phone
/// OTP (single unified flow, no mode toggle needed) — but only for
/// whichever methods [supportedAuthMethodsProvider] reports the backend
/// actually supports right now. One supported method skips the toggle
/// entirely; zero shows a retry state instead of a broken form.
///
/// [onAuthenticated] fires once tokens are obtained by whichever flow
/// the user completed — wire it to your session/token storage.
class AuthPage extends ConsumerStatefulWidget {
  final ValueChanged<AuthTokens>? onAuthenticated;

  const AuthPage({super.key, this.onAuthenticated});

  @override
  ConsumerState<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends ConsumerState<AuthPage> {
  AuthMethod? _method;
  AuthMode _mode = AuthMode.login;

  @override
  void initState() {
    super.initState();
    // Force a genuinely fresh check every time this page is opened,
    // rather than trusting whatever the provider happened to cache from
    // an earlier visit (or the very first cold-start fetch). Safe to
    // call in initState — this runs once per widget instance, before
    // build()'s ref.watch picks up the freshly-invalidated provider.
    ref.invalidate(supportedAuthMethodsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final methodsAsync = ref.watch(supportedAuthMethodsProvider);

    return Scaffold(
      body: SafeArea(
        child: methodsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => _RetryState(message: "Couldn't check available sign-in methods.", onRetry: () => ref.invalidate(supportedAuthMethodsProvider)),
          data: (methods) {
            if (methods.isEmpty) {
              return _RetryState(message: 'Sign-in is temporarily unavailable. Please try again shortly.', onRetry: () => ref.invalidate(supportedAuthMethodsProvider));
            }

            // Default to whatever's supported, and re-pick if the
            // previously selected method drops out of the supported set
            // (e.g. backend config changes while this page is open).
            // Plain field assignment, not setState — safe during build
            // since it doesn't trigger a rebuild loop, and it's
            // idempotent across repeated builds with the same data.
            if (_method == null || !methods.contains(_method)) {
              _method = methods.first;
            }

            return SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 32),
                  Text(_method == AuthMethod.email ? (_mode == AuthMode.signUp ? 'Create your account' : 'Welcome back') : 'Log in or sign up', style: Theme.of(context).textTheme.headlineSmall, textAlign: TextAlign.center),
                  const SizedBox(height: 32),
                  if (methods.length > 1) ...[
                    Center(
                      child: SegmentedButton<AuthMethod>(
                        segments: [
                          if (methods.contains(AuthMethod.email)) const ButtonSegment(value: AuthMethod.email, label: Text('Email'), icon: Icon(Icons.email_outlined)),
                          if (methods.contains(AuthMethod.phone)) const ButtonSegment(value: AuthMethod.phone, label: Text('Phone'), icon: Icon(Icons.sms_outlined)),
                        ],
                        selected: {_method!},
                        onSelectionChanged: (selection) => setState(() => _method = selection.first),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    child: _method == AuthMethod.email ? EmailPasswordForm(key: const ValueKey('email'), mode: _mode, onModeChanged: (mode) => setState(() => _mode = mode), onAuthenticated: widget.onAuthenticated) : PhoneOtpForm(key: const ValueKey('phone'), onAuthenticated: widget.onAuthenticated),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _RetryState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _RetryState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}
