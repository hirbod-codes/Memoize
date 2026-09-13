import 'package:client/api/api_call.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:client/localization/device_defaults.dart';
import 'package:client/localization/locale_controller.dart';
import 'package:client/localization/timezone/timezone_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'calendar_system.dart';
import 'gregorian_calendar.dart';
import 'persian_calendar.dart';

const Map<CalendarType, CalendarSystem> calendarSystems = {CalendarType.gregorian: GregorianCalendar(), CalendarType.persian: PersianCalendar()};

class CalendarController extends Notifier<CalendarType> {
  static const _preferencesKey = 'calendarType';

  @override
  CalendarType build() {
    _restore();
    final (_, calendar) = defaultLocaleAndCalendarForDevice();
    return calendar;

  }

  Future<void> _restore() async {
    final preferences = await SharedPreferences.getInstance();
    final saved = preferences.getString(_preferencesKey);
    if (saved == null) return;

    final match = CalendarType.values.where((t) => t.name == saved);
    if (match.isNotEmpty) state = match.first;
  }

  Future<void> setCalendarType(CalendarType type) async {
    final dio = ref.read(authDioProvider);

    final result = await apiCall(
      () => dio.post(
        '/api/user/preferences',
        data: {'language': ref.read(localeControllerProvider).languageCode, 'calendar': type.name, 'timezone': ref.read(timezoneControllerProvider)},
      ),
    );
    if (result.isFailure) return;

    state = type;
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_preferencesKey, type.name);
  }
}

final calendarControllerProvider = NotifierProvider<CalendarController, CalendarType>(CalendarController.new);

/// The currently-selected CalendarSystem instance, derived from
/// calendarControllerProvider — this is what UI code should actually
/// watch/use for conversions rather than looking up the map itself.
final activeCalendarProvider = Provider<CalendarSystem>((ref) {
  final type = ref.watch(calendarControllerProvider);
  return calendarSystems[type]!;
});
