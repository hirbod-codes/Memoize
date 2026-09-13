import 'package:client/go_router.dart';
import 'package:client/auth/auth_controller.dart';
import 'package:client/auth/auth_state.dart';
import 'package:client/l10n/app_localizations.dart';
import 'package:client/localization/locale_controller.dart';
import 'package:client/localization/timezone/timezone_service.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/app_theme.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_quill/flutter_quill.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:media_kit/media_kit.dart';
import 'package:just_audio_media_kit/just_audio_media_kit.dart';

final container = ProviderContainer();

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  if (!kIsWeb) {
    MediaKit.ensureInitialized();
    JustAudioMediaKit.ensureInitialized();
  }

  runApp(UncontrolledProviderScope(container: container, child: const MyApp()));
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    TimezoneService.initialize();

    final auth = ref.watch(authControllerProvider);

    if (auth.status == AuthStatus.loading) {
      return const MaterialApp(
        home: Scaffold(body: Center(child: CircularProgressIndicator())),
      );
    }

    // Read (not built until now) since the loading branch above already
    // guarantees the initial session check has resolved by this point —
    // goRouterProvider's redirect logic depends on that being settled.
    final router = ref.watch(goRouterProvider);
    final locale = ref.watch(localeControllerProvider);

    return MaterialApp.router(
      locale: locale,
      onGenerateTitle: (context) => AppLocalizations.of(context)!.appTitle,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        FlutterQuillLocalizations.delegate,
      ],
      supportedLocales: supportedLocales,
      routerConfig: router,
      title: 'Memoize',
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ref.watch(themeModeProvider),
      debugShowCheckedModeBanner: false,
    );
  }
}
