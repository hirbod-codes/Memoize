import 'package:client/api/action_controller.dart';
import 'package:client/api/controllers/locale_controller.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:client/components/global/notification_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

class LanguageDropdown extends ConsumerWidget {
  const LanguageDropdown({super.key});
  static const languages = {'en': 'English', 'fa': 'فارسی', 'de': 'Deutsch'};
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeProvider);

    final colorScheme = Theme.of(context).colorScheme;

    final actionProvider = instantiateProvider();
    var watchedActionProvider = ref.watch(actionProvider);

    return watchedActionProvider.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      data: (data) {
        return getWidget(locale, colorScheme, ref, actionProvider, watchedActionProvider.isLoading);
      },
      error: (e, st) {
        Talker().error('caught error in action controller of the language drop down component');

        NotificationService.showError(context: context, message: 'system failed to set new language, try again.');

        return getWidget(locale, colorScheme, ref, actionProvider, watchedActionProvider.isLoading);
      },
      skipLoadingOnReload: true,
      skipLoadingOnRefresh: true,
    );
  }

  DropdownMenu<Locale> getWidget(Locale locale, ColorScheme colorScheme, WidgetRef ref, AsyncNotifierProvider<ActionController, void> provider, bool loading) {
    return DropdownMenu<Locale>(
      initialSelection: locale,
      enabled: !loading,
      expandedInsets: EdgeInsets.zero,
      selectOnly: true,
      leadingIcon: const Icon(Icons.language),
      label: const Text('Language'),
      dropdownMenuEntries: languages.entries.map((entry) {
        final languageCode = entry.key;
        final languageLocale = Locale(languageCode);
        final isSelected = locale.languageCode == languageCode;
        return DropdownMenuEntry<Locale>(
          value: languageLocale,
          label: entry.value,
          leadingIcon: Icon(Icons.language, color: isSelected ? colorScheme.primary : colorScheme.onSurfaceVariant),
          trailingIcon: isSelected ? Icon(Icons.check, color: colorScheme.primary) : null,
          style: MenuItemButton.styleFrom(foregroundColor: isSelected ? colorScheme.primary : colorScheme.onSurface),
        );
      }).toList(),
      onSelected: (newLocale) async {
        if (newLocale == null) return;

        await ref.read(provider.notifier).run(() => ref.read(authDioProvider).post('/api/user/preferences'));
        final state = ref.read(provider);
        if (!state.hasError) await ref.read(localeProvider.notifier).setLocale(newLocale);
      },
    );
  }
}
