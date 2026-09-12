import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Add a language here + lib/l10n/app_<code>.arb — everything else
/// (switcher UI, persistence, RTL/LTR direction) adapts automatically.
const List<Locale> supportedLocales = [Locale('en'), Locale('fa'), Locale('de')];

const Map<String, String> localeDisplayNames = {'en': 'English', 'fa': 'فارسی', 'de': 'Deutsch'};

class LocaleController extends Notifier<Locale> {
  static const _prefsKey = 'locale';

  @override
  Locale build() {
    _restore();
    return supportedLocales.first; // English until restore completes
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefsKey);
    if (saved == null) return;

    final match = supportedLocales.where((l) => l.languageCode == saved);
    if (match.isNotEmpty) state = match.first;
  }

  Future<void> setLocale(Locale locale) async {
    if (!supportedLocales.contains(locale)) return;
    state = locale;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, locale.languageCode);
  }
}

final localeControllerProvider = NotifierProvider<LocaleController, Locale>(LocaleController.new);
