import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Generic loading/error wrapper for a single in-flight auth action
/// (login, signup, send-otp, verify-otp, reset-password — whichever
/// button was last pressed). One instance is reused across the whole
/// auth page rather than one per form, since only one action is ever
/// in flight at a time on this page.
///
/// This is deliberately separate from AuthState (lib/auth/auth_state.dart)
/// — that one tracks the app-wide session (logged in or not), this one
/// tracks whether *this specific button* is mid-request. They never need
/// to agree with each other; a signup-code-verify request can be loading
/// here while the global session is still `unauthenticated`.
class AuthActionController extends AsyncNotifier<void> {
  @override
  FutureOr<void> build() {}

  /// Runs [action], exposing loading/error state via [state] so widgets
  /// can watch it (spinner on the button, error text below it) without
  /// each form needing its own try/catch/setState boilerplate.
  Future<void> run(Future<void> Function() action) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(action);
  }
}

final authActionControllerProvider = AsyncNotifierProvider.autoDispose<AuthActionController, void>(AuthActionController.new);
