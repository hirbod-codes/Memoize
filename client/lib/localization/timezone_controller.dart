import 'package:client/localization/timezone_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class TimezoneController extends Notifier<String> {
  static const _prefsKey = 'timeZone';
  static const _defaultZone = 'UTC';

  @override
  String build() {
    _restore();
    return _defaultZone;
    // No device-timezone auto-detection here — Dart/Flutter has no
    // built-in way to read the device's IANA zone name (DateTime only
    // exposes a raw UTC offset, which is ambiguous — several zones
    // share the same offset). Add a package like flutter_timezone if
    // you want the default to start as "whatever zone the device is
    // actually in" instead of UTC.
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefsKey);
    if (saved != null && TimezoneService.allZoneNames.contains(saved)) {
      state = saved;
    }
  }

  Future<void> setZone(String zoneName) async {
    if (!TimezoneService.allZoneNames.contains(zoneName)) return;
    state = zoneName;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, zoneName);
  }
}

final timezoneControllerProvider = NotifierProvider<TimezoneController, String>(TimezoneController.new);