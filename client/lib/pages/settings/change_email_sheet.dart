import 'package:client/account/account_controller.dart';
import 'package:client/api/action_controller.dart';
import 'package:client/auth/widgets/otp_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> showChangeEmailSheet(BuildContext context) {
  return showModalBottomSheet(context: context, isScrollControlled: true, useSafeArea: true, builder: (_) => const _ChangeEmailContent());
}

class _ChangeEmailContent extends ConsumerStatefulWidget {
  const _ChangeEmailContent();

  @override
  ConsumerState<_ChangeEmailContent> createState() => _ChangeEmailContentState();
}

class _ChangeEmailContentState extends ConsumerState<_ChangeEmailContent> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final newEmail = _emailController.text.trim();
    final account = ref.read(accountControllerProvider);
    final controller = ref.read(authActionControllerProvider.notifier);

    await controller.run(() => account.requestEmailChange(newEmail: newEmail));
    final sendState = ref.read(authActionControllerProvider);
    if (sendState.hasError || !mounted) return;

    final verified = await showOtpSheet(
      context: context,
      destination: newEmail,
      title: 'Verify your new email',
      onVerify: (code) => account.verifyEmailChange(newEmail: newEmail, code: code),
      onResend: () => account.requestEmailChange(newEmail: newEmail),
    );

    if (verified == true && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final actionState = ref.watch(authActionControllerProvider);
    final isLoading = actionState.isLoading;

    return Padding(
      padding: EdgeInsets.only(left: 24, right: 24, top: 24, bottom: MediaQuery.of(context).viewInsets.bottom + 24),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Change email', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text("We'll send a code to your new address to confirm it.", style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 16),
            TextFormField(
              controller: _emailController,
              enabled: !isLoading,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'New email', border: OutlineInputBorder()),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Email is required';
                if (!v.contains('@')) return 'Enter a valid email';
                return null;
              },
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: isLoading ? null : _submit,
              child: isLoading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Send code'),
            ),
          ],
        ),
      ),
    );
  }
}
