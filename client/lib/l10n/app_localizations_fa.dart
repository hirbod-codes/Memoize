// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Persian (`fa`).
class AppLocalizationsFa extends AppLocalizations {
  AppLocalizationsFa([String locale = 'fa']) : super(locale);

  @override
  String get appTitle => 'مموایز';

  @override
  String get login => 'ورود';

  @override
  String get logout => 'خروج';

  @override
  String welcome(String name) {
    return 'خوش آمدید، $name';
  }
}
