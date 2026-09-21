// Holds the current Plan (plan, name, etc.) as Riverpod state so any
// widget can `ref.watch(userInfoProvider)` and react when it changes —
// instead of every screen needing its own fetch/cache logic.
//
// - On first read, seeds itself from the on-disk cache (AllPlansStorage)
//   so the UI has something to show instantly.
// - `refresh()` hits the server for the latest value, persists it to
//   AllPlansStorage on success, and updates state for every watcher.
// - `info` is preserved across refresh/error so screens that just want
//   to *display* the user's info don't flicker to nothing while a
//   background refresh (e.g. the resume plan-check) is in flight.

import 'package:client/api/api_call.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:client/plan/models/plan.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'all_plans_storage.dart';

class AllPlansState {
  final List<Plan>? plans;
  final bool isLoading;
  final String? error;

  const AllPlansState({this.plans, this.isLoading = false, this.error});

  AllPlansState copyWith({List<Plan>? info, bool clearInfo = false, bool? isLoading, String? error, bool clearError = false}) {
    return AllPlansState(
      plans: clearInfo ? null : (info ?? this.plans),
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class AllPlansNotifier extends Notifier<AllPlansState> {
  @override
  AllPlansState build() {
    // Fire-and-forget: seed state from disk cache as soon as it loads.
    _loadCached();
    return const AllPlansState();
  }

  Future<void> _loadCached() async {
    final cached = await AllPlansStorage.load();
    if (cached != null) {
      state = state.copyWith(info: cached);
    }
  }

  /// Hits the server for the latest user/plan info. Called by the
  /// resume-gate, but any widget could call this too (e.g. pull-to-refresh
  /// on a settings screen) — all watchers update together.
  Future<bool> refresh() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final info = await _fetchFromServer();
      await AllPlansStorage.save(info);
      state = state.copyWith(info: info, isLoading: false, clearError: true);
      return true;
    } catch (_) {
      state = state.copyWith(isLoading: false, error: 'Failed to verify your plan.');
      return false;
    }
  }

  Future<List<Plan>?> _fetchFromServer() async {
    final dio = await ref.read(dioProvider);
    final result = await apiCall(() => dio.get('/api/plan'));
    return result.dataOrNull?['plans'];
  }

  /// Call on logout.
  Future<void> clear() async {
    await AllPlansStorage.clear();
    state = const AllPlansState();
  }
}

final allPlansProvider = NotifierProvider<AllPlansNotifier, AllPlansState>(AllPlansNotifier.new);
