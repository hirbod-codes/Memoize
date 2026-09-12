import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'calendar_system.dart';
import 'gregorian_calendar.dart';
import 'persian_calendar.dart';

const Map<CalendarType, CalendarSystem> calendarSystems = {CalendarType.gregorian: GregorianCalendar(), CalendarType.persian: PersianCalendar()};

class CalendarController extends Notifier<CalendarType> {
  static const _prefsKey = 'calendarType';

  @override
  CalendarType build() {
    _restore();
    return CalendarType.gregorian;
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefsKey);
    if (saved == null) return;

    final match = CalendarType.values.where((t) => t.name == saved);
    if (match.isNotEmpty) state = match.first;
  }

  Future<void> setCalendarType(CalendarType type) async {
    state = type;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, type.name);
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
