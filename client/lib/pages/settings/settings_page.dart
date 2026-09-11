import 'package:client/account/account_controller.dart';
import 'package:client/account/models/user_info.dart';
import 'package:client/auth/models/auth_models.dart';
import 'package:client/components/language_dropdown.dart';
import 'package:client/pages/settings/change_email_sheet.dart';
import 'package:client/pages/settings/change_password_sheet.dart';
import 'package:client/pages/settings/change_phone_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

/// Wrap this in AppShell at the route level, same as HomePage:
///   GoRoute(path: '/settings', builder: (context, state) => const AppShell(child: SettingsPage())),
class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  @override
  void initState() {
    super.initState();
    ref.invalidate(userInfoProvider);
  }

  @override
  Widget build(BuildContext context) {
    final userInfoAsync = ref.watch(userInfoProvider);

    return userInfoAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stackTrace) {
        Talker().error('caught error in settings page initial load', error, stackTrace);
        return _RetryState(onRetry: () => ref.invalidate(userInfoProvider));
      },
      data: (userInfo) => _SettingsContent(userInfo: userInfo),
    );
  }
}

class _SettingsContent extends StatelessWidget {
  final UserInfo userInfo;

  const _SettingsContent({required this.userInfo});

  @override
  Widget build(BuildContext context) {
    final isEmailAccount = userInfo.authMethod == AuthMethod.email;

    return ListView(
      children: [
        const _SectionHeader(title: 'Account'),
        _InfoTile(label: 'Plan', value: userInfo.planTitle),
        if (userInfo.username != null) _InfoTile(label: 'Username', value: userInfo.username!),
        const SizedBox(height: 8),

        // Mutually exclusive per the backend schema (authMethod is
        // 'email' XOR 'phone') — email accounts have a password to
        // change, phone accounts are passwordless, so there's nothing
        // to reset there. Never show both sets of sections.
        if (isEmailAccount) ...[
          const _SectionHeader(title: 'Email & password'),
          _SettingsTile(
            icon: Icons.email_outlined,
            title: 'Email',
            subtitle: userInfo.email ?? '—',
            actionLabel: 'Change',
            onTap: () => showChangeEmailSheet(context),
          ),
          _SettingsTile(
            icon: Icons.lock_outline,
            title: 'Password',
            subtitle: '••••••••',
            actionLabel: 'Change',
            onTap: () => showChangePasswordSheet(context),
          ),
        ] else ...[
          const _SectionHeader(title: 'Phone number'),
          _SettingsTile(
            icon: Icons.phone_outlined,
            title: 'Phone number',
            subtitle: userInfo.phoneNumber ?? '—',
            actionLabel: 'Change',
            onTap: () => showChangePhoneSheet(context),
          ),
        ],
        const SizedBox(height: 24),
        const LanguageDropdown(),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
      child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final String label;
  final String value;

  const _InfoTile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      title: Text(label),
      trailing: Text(value, style: Theme.of(context).textTheme.bodyMedium),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback onTap;

  const _SettingsTile({required this.icon, required this.title, required this.subtitle, required this.actionLabel, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: TextButton(onPressed: onTap, child: Text(actionLabel)),
    );
  }
}

class _RetryState extends StatelessWidget {
  final VoidCallback onRetry;

  const _RetryState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text("Couldn't load your account info.", style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
