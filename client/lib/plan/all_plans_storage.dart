import 'dart:convert';

import 'package:client/api/models/plan.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Local cache of the last-fetched Plan. Two uses: lets the app
/// show something (name, plan, avatar key) instantly on next launch
/// before the network round-trip in _onAuthenticated() completes, and
/// gives other parts of the app a synchronous read instead of needing
/// to await userInfoProvider every time.
class AllPlansStorage {
  static const _preferencesKey = 'userInfo';

  static Future<void> save(Plan? plan) async {
    if (plan == null) {
      await clear();
      return;
    }
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_preferencesKey, jsonEncode(plan.toJson()));
  }

  static Future<Plan?> load() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_preferencesKey);
    if (raw == null) return null;

    try {
      return Plan.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null; // corrupted or outdated cache shape — treat as absent
    }
  }

  static Future<void> clear() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(_preferencesKey);
  }
}
