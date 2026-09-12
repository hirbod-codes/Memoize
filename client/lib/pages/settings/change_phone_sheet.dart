import 'package:client/account/account_controller.dart';
import 'package:client/api/action_controller.dart';
import 'package:client/auth/components/otp_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> showChangePhoneSheet(BuildContext context) {
  return showModalBottomSheet(context: context, isScrollControlled: true, useSafeArea: true, builder: (_) => const _ChangePhoneContent());
}

class _ChangePhoneContent extends ConsumerStatefulWidget {
  const _ChangePhoneContent();

  @override
  ConsumerState<_ChangePhoneContent> createState() => _ChangePhoneContentState();
}

class _ChangePhoneContentState extends ConsumerState<_ChangePhoneContent> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final newPhone = _phoneController.text.trim();
    final account = ref.read(accountControllerProvider);
    final controller = ref.read(authActionControllerProvider.notifier);

    await controller.run(() => account.requestPhoneChange(newPhone: newPhone));
    final sendState = ref.read(authActionControllerProvider);
    if (sendState.hasError || !mounted) return;

    final verified = await showOtpSheet(
      context: context,
      destination: newPhone,
      title: 'Verify your new number',
      onVerify: (code) => account.verifyPhoneChange(newPhone: newPhone, code: code),
      onResend: () => account.requestPhoneChange(newPhone: newPhone),
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
            Text('Change phone number', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text("We'll text a code to your new number to confirm it.", style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 16),
            TextFormField(
              controller: _phoneController,
              enabled: !isLoading,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'New phone number', border: OutlineInputBorder()),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Phone number is required' : null,
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
