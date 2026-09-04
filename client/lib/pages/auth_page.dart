import 'package:flutter/material.dart';

import '../auth/models/auth_models.dart';
import '../auth/widgets/email_password_form.dart';
import '../auth/widgets/phone_otp_form.dart';

/// Top-level auth page. Toggles between email+password (with its own
/// login/signup toggle and forgot-password link) and passwordless phone
/// OTP (single unified flow, no mode toggle needed).
///
/// [onAuthenticated] fires once tokens are obtained by whichever flow
/// the user completed — wire it to your session/token storage.
class AuthPage extends StatefulWidget {
  final ValueChanged<AuthTokens>? onAuthenticated;

  const AuthPage({super.key, this.onAuthenticated});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  AuthMethod _method = AuthMethod.email;
  AuthMode _mode = AuthMode.login;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              Text(_method == AuthMethod.email ? (_mode == AuthMode.signUp ? 'Create your account' : 'Welcome back') : 'Log in or sign up', style: Theme.of(context).textTheme.headlineSmall, textAlign: TextAlign.center),
              const SizedBox(height: 32),
              Center(
                child: SegmentedButton<AuthMethod>(
                  segments: const [
                    ButtonSegment(value: AuthMethod.email, label: Text('Email'), icon: Icon(Icons.email_outlined)),
                    ButtonSegment(value: AuthMethod.phone, label: Text('Phone'), icon: Icon(Icons.sms_outlined)),
                  ],
                  selected: {_method},
                  onSelectionChanged: (selection) => setState(() => _method = selection.first),
                ),
              ),
              const SizedBox(height: 24),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: _method == AuthMethod.email ? EmailPasswordForm(key: const ValueKey('email'), mode: _mode, onModeChanged: (mode) => setState(() => _mode = mode), onAuthenticated: widget.onAuthenticated) : PhoneOtpForm(key: const ValueKey('phone'), onAuthenticated: widget.onAuthenticated),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
