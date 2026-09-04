import 'package:client/auth/auth_controller.dart';
import 'package:client/auth/auth_action_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'otp_code_input.dart';

enum _Step { enterEmail, enterCodeAndPassword }

/// Bottom sheet: enter email → receive a 6-digit code → enter code +
/// new password in one submit. Same two-step shape as email sign-up
/// and phone auth — every verification flow in this app works this way.
Future<void> showForgotPasswordEmailSheet(BuildContext context) {
  return showModalBottomSheet(context: context, isScrollControlled: true, useSafeArea: true, builder: (_) => const _ForgotPasswordEmailContent());
}

class _ForgotPasswordEmailContent extends ConsumerStatefulWidget {
  const _ForgotPasswordEmailContent();

  @override
  ConsumerState<_ForgotPasswordEmailContent> createState() => _ForgotPasswordEmailContentState();
}

class _ForgotPasswordEmailContentState extends ConsumerState<_ForgotPasswordEmailContent> {
  final _emailFormKey = GlobalKey<FormState>();
  final _passwordFormKey = GlobalKey<FormState>();
  final _otpKey = GlobalKey<OtpCodeInputState>();

  final _emailController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  _Step _step = _Step.enterEmail;
  String _code = '';

  @override
  void dispose() {
    _emailController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    if (!(_emailFormKey.currentState?.validate() ?? false)) return;

    final api = ref.read(authControllerProvider.notifier);
    await  api.requestEmailPasswordReset(email: _emailController.text.trim());

    final state = ref.read(authActionControllerProvider);
    if (!state.hasError && mounted) setState(() => _step = _Step.enterCodeAndPassword);
  }

  Future<void> _resend() async {
    final api = ref.read(authControllerProvider.notifier);
    await  api.resendPasswordResetCode(email: _emailController.text.trim());
  }

  Future<void> _submit() async {
    if (_code.length != 6) return;
    if (!(_passwordFormKey.currentState?.validate() ?? false)) return;

    final api = ref.read(authControllerProvider.notifier);
    await  api.completeEmailPasswordReset(email: _emailController.text.trim(), code: _code, newPassword: _newPasswordController.text);

    final state = ref.read(authActionControllerProvider);
    if (state.hasError) {
      _otpKey.currentState?.clear();
      return;
    }
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final actionState = ref.watch(authActionControllerProvider);
    final isLoading = actionState.isLoading;

    return Padding(
      padding: EdgeInsets.only(left: 24, right: 24, top: 24, bottom: MediaQuery.of(context).viewInsets.bottom + 24),
      child: _step == _Step.enterEmail
          ? Form(
              key: _emailFormKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Reset your password', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text('Enter your email and we\'ll send you a 6-digit code.', style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _emailController,
                    enabled: !isLoading,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) return 'Email is required';
                      if (!value.contains('@')) return 'Enter a valid email';
                      return null;
                    },
                  ),
                  if (actionState.hasError) ...[const SizedBox(height: 12), Text(actionState.error.toString(), style: TextStyle(color: Theme.of(context).colorScheme.error))],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: isLoading ? null : _sendCode,
                    child: isLoading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Send code'),
                  ),
                ],
              ),
            )
          : Form(
              key: _passwordFormKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Enter code & new password', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text('Code sent to ${_emailController.text.trim()}', style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 20),
                  OtpCodeInput(key: _otpKey, enabled: !isLoading, onChanged: (value) => setState(() => _code = value)),
                  Center(
                    child: TextButton(onPressed: isLoading ? null : _resend, child: const Text('Resend code')),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _newPasswordController,
                    enabled: !isLoading,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'New password', border: OutlineInputBorder()),
                    validator: (value) {
                      if (value == null || value.length < 8) return 'At least 8 characters';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _confirmPasswordController,
                    enabled: !isLoading,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Confirm password', border: OutlineInputBorder()),
                    validator: (value) {
                      if (value != _newPasswordController.text) return 'Passwords do not match';
                      return null;
                    },
                  ),
                  if (actionState.hasError) ...[const SizedBox(height: 12), Text(actionState.error.toString(), style: TextStyle(color: Theme.of(context).colorScheme.error))],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: isLoading || _code.length != 6 ? null : _submit,
                    child: isLoading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Reset password'),
                  ),
                ],
              ),
            ),
    );
  }
}
