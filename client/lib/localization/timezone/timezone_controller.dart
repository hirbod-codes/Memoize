import 'package:client/api/api_call.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:client/localization/calendars/calendar_controller.dart';
import 'package:client/localization/locale_controller.dart';
import 'package:client/localization/timezone/device_timezone.dart';
import 'package:client/localization/timezone/timezone_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class TimezoneController extends Notifier<String> {
  static const _preferencesKey = 'timeZone';
  static const _fallbackZone = 'UTC';

  @override
  String build() {
    _restore();
    return _fallbackZone; // placeholder until the async check below resolves
  }

  Future<void> _restore() async {
    final preferences = await SharedPreferences.getInstance();
    final saved = preferences.getString(_preferencesKey);
    if (saved != null && TimezoneService.allZoneNames.contains(saved)) {
      state = saved;
      return;
    }

    final deviceZone = await deviceTimeZone();
    if (deviceZone != null && TimezoneService.allZoneNames.contains(deviceZone)) {
      state = deviceZone;
    } else {
      state = _fallbackZone;
    }
  }

  Future<void> setZone(String zoneName) async {
    if (!TimezoneService.allZoneNames.contains(zoneName)) return;

    final dio = ref.read(authDioProvider);

    final result = await apiCall(
      () => dio.post(
        '/api/user/preferences',
        data: {'language': ref.read(localeControllerProvider).languageCode, 'calendar': ref.read(calendarControllerProvider).name, 'timezone': zoneName},
      ),
    );
    if (result.isFailure) return;

    state = zoneName;

    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_preferencesKey, zoneName);
  }
}

final timezoneControllerProvider = NotifierProvider<TimezoneController, String>(TimezoneController.new);
