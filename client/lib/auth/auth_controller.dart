import 'dart:io';
import 'dart:ui';

import 'package:client/account/avatar/avatar_bytes_notifier.dart';
import 'package:client/account/models/user_info.dart';
import 'package:client/account/user_info_notifier.dart';
import 'package:client/account/user_usage_notifier.dart';
import 'package:client/api/api_call.dart';
import 'package:client/api/root_navigator_key.dart';
import 'package:client/auth/auth_api.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:client/api/api_call_extensions.dart';
import 'package:client/auth/auth_state.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/auth/responses/login_response.dart';
import 'package:client/auth/responses/refresh_response.dart';
import 'package:client/auth/models/auth_models.dart';
import 'package:client/l10n/app_localizations.dart';
import 'package:client/localization/calendars/calendar_controller.dart';
import 'package:client/localization/locale_controller.dart';
import 'package:client/localization/timezone/timezone_controller.dart';
import 'package:client/subscription/subscription_notifier.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

class AuthController extends Notifier<AuthState> implements AuthApi {
  late final TokenStorage _storage;
  late final Dio _authDio;

  String? _client;

  AuthController() {
    _client = kIsWeb ? 'web' : (Platform.isAndroid || Platform.isIOS ? 'mobile' : 'desktop');
  }

  @override
  AuthState build() {
    _storage = ref.read(tokenStorageProvider);
    _authDio = ref.watch(authDioProvider);

    _initialize();

    return const AuthState(AuthStatus.loading);
  }

  Future<void> _initialize() async {
    Talker().info('kIsWeb: $kIsWeb, AuthController._initialize called...');

    if (kIsWeb) {
      try {
        final result = await refresh(null, silent: true);
        Talker().info('refresh result: $result');

        await _completeAuthentication(result.accessToken, null);
      } catch (e) {
        Talker().error('error: $e');
        await _storage.clear();
        state = const AuthState(AuthStatus.unauthenticated);
      }
      Talker().info('AuthController._initialize ended (web)');
      return;
    }

    // Mobile/desktop: no cookie jar, so a refresh attempt is only
    // worth making if we actually have a token to send.
    final refreshToken = await _storage.getRefreshToken();
    Talker().info('refreshToken: $refreshToken');

    if (refreshToken == null) {
      state = const AuthState(AuthStatus.unauthenticated);
      Talker().info('AuthController._initialize ended');
      return;
    }

    try {
      final result = await refresh(refreshToken, silent: true);
      Talker().info('refresh result: $result');

      await _completeAuthentication(result.accessToken, result.refreshToken);
    } catch (e) {
      Talker().error('error: $e');

      await _storage.clear();

      state = const AuthState(AuthStatus.unauthenticated);
    }

    Talker().info('AuthController._initialize ended');
  }

  /// Persists tokens and flips global session state to authenticated.
  /// Every flow that ends with the user logged in (password login, phone
  /// OTP, email signup verification, password reset) funnels through
  /// here so there's exactly one place session state actually changes.
  Future<AuthTokens> _completeAuthentication(String accessToken, String? refreshToken) async {
    await _storage.saveAccessToken(accessToken);
    if (refreshToken != null) await _storage.saveRefreshToken(refreshToken);

    await _onAuthenticated();

    state = const AuthState(AuthStatus.authenticated);

    return AuthTokens(accessToken: accessToken, refreshToken: refreshToken);
  }

  Future<void> _onAuthenticated() async {
    try {
      await Future.wait([
        ref.read(userUsageProvider.notifier).refresh().catchError((e) {
          Talker().error('error caught in _onAuthenticated method of AuthController class', e);
          return false;
        }),
        ref.read(subscriptionProvider.notifier).refresh().catchError((e) {
          Talker().error('error caught in _onAuthenticated method of AuthController class', e);
          return false;
        }),
        ref.read(userInfoProvider.notifier).refresh().catchError((e) {
          Talker().error('error caught in _onAuthenticated method of AuthController class', e);
          return false;
        }),
      ]);

      ref.listen(userInfoProvider, (previous, next) async {
        if (next.isLoading || next.error != null || next.info == null) return;

        UserInfo userInfo = next.info!;

        final avatarBytesNotifier = ref.read(avatarBytesProvider.notifier);
        if (userInfo.avatarKey != (await avatarBytesNotifier.getCachedAvatarKey())) {
          await avatarBytesNotifier.refresh();
        }

        // Account is the source of truth once logged in — whatever's saved
        // there overwrites whatever was already on this device.
        await Future.wait([
          ref
              .read(localeControllerProvider.notifier)
              .setLocale(userInfo.locale != null ? Locale(userInfo.locale!) : ref.read(localeControllerProvider))
              .catchError((e) => Talker().error('error caught in _onAuthenticated method of AuthController class', e)),
          ref
              .read(calendarControllerProvider.notifier)
              .setCalendarType(userInfo.calendarType != null ? userInfo.calendarType! : ref.read(calendarControllerProvider))
              .catchError((e) => Talker().error('error caught in _onAuthenticated method of AuthController class', e)),
          ref
              .read(timezoneControllerProvider.notifier)
              .setZone(userInfo.timeZone != null ? userInfo.timeZone! : ref.read(timezoneControllerProvider))
              .catchError((e) => Talker().error('error caught in _onAuthenticated method of AuthController class', e)),
        ]);
      });
    } catch (e) {
      Talker().error('error caught in _onAuthenticated method of AuthController class', e);
    }
  }

  Future<RefreshResponse> refresh(String? refreshToken, {bool silent = false}) async {
    Talker().info('AuthController.refresh called...');

    final response = await _authDio.post(
      '/api/auth/refresh',
      data: {'refreshToken': kIsWeb ? null : refreshToken, 'client': _client},
      options: Options(extra: {'silentErrors': silent}),
    );
    Talker().info('response status code: ${response.statusCode}');

    return RefreshResponse(accessToken: response.data['data']['accessToken'], refreshToken: response.data['data']?['refreshToken']);
  }

  @override
  Future<AuthTokens> loginWithEmail({required String email, required String password}) async {
    final response = await _authDio
        .post('/api/auth/login', data: {'identifier': email, 'password': password, 'client': _client})
        .notifyOnSuccess(rootContext == null ? 'Welcome back!' : AppLocalizations.of(rootContext!)?.welcomeBack ?? 'Welcome back!');

    final loginResponse = LoginResponse.fromJson(response.data['data']);

    return _completeAuthentication(loginResponse.accessToken, loginResponse.refreshToken);
  }

  Future<void> logout({bool silent = false}) async {
    final refreshToken = await _storage.getRefreshToken();
    final accessToken = await _storage.getAccessToken();

    final result = await apiCall(() {
      final r = _authDio.post(
        '/api/auth/logout',
        data: {'refreshToken': refreshToken, 'accessToken': accessToken},
        options: Options(extra: {'silentErrors': silent}),
      );

      if (!silent && rootContext != null) r.notifyOnSuccess(AppLocalizations.of(rootContext!)!.logout_success);

      return r;
    });
    if (result.isFailure) return;

    state = const AuthState(AuthStatus.unauthenticated);

    await _storage.clear();

    await ref.read(avatarBytesProvider.notifier).clear();
    await ref.read(userInfoProvider.notifier).clear();
    await ref.read(userUsageProvider.notifier).clear();
  }

  @override
  Future<void> signUpWithEmail({required String email, required String password}) async {
    await _authDio
        .post('/api/auth/email/register', data: {'email': email, 'password': password, 'client': _client})
        .notifyOnSuccess(
          rootContext == null
              ? 'Verification code sent to your email.'
              : AppLocalizations.of(rootContext!)?.code_sent_to_email ?? 'Verification code sent to your email.',
        );
  }

  @override
  Future<AuthTokens> verifyEmailSignUp({required String email, required String code}) async {
    final response = await _authDio
        .post('/api/auth/email/verify', data: {'email': email, 'code': code, 'client': _client})
        .notifyOnSuccess(
          rootContext == null ? "You're all set! Account created." : AppLocalizations.of(rootContext!)?.account_created ?? "You're all set! Account created.",
        );
    final result = LoginResponse.fromJson(response.data['data']);
    return _completeAuthentication(result.accessToken, result.refreshToken);
  }

  @override
  Future<void> requestEmailPasswordReset({required String email}) async {
    await _authDio.post('/api/auth/email/password-reset', data: {'email': email, 'client': _client}).notifyOnSuccess('Reset code sent to your email.');
  }

  @override
  Future<void> completeEmailPasswordReset({required String email, required String code, required String newPassword}) async {
    final response = await _authDio
        .post('/api/auth/email/password-reset/verify', data: {'email': email, 'code': code, 'password': newPassword, 'client': _client})
        .notifyOnSuccess(
          rootContext == null ? 'Password updated successfully.' : AppLocalizations.of(rootContext!)?.password_updated ?? 'Password updated successfully.',
        );
    final result = LoginResponse.fromJson(response.data['data']);
    await _completeAuthentication(result.accessToken, result.refreshToken);
  }

  @override
  Future<void> sendPhoneOtp({required String phone}) async {
    await _authDio
        .post('/api/auth/otp/request', data: {'phoneNumber': phone, 'locale': 'fa', 'client': _client})
        .notifyOnSuccess(
          rootContext == null ? 'Code sent to your phone.' : AppLocalizations.of(rootContext!)?.code_sent_to_phone ?? 'Code sent to your phone.',
        );
  }

  @override
  Future<AuthTokens> verifyPhoneOtp({required String phone, required String code}) async {
    final response = await _authDio
        .post('/api/auth/otp/verify', data: {'phoneNumber': phone, 'code': code, 'client': _client})
        .notifyOnSuccess(rootContext == null ? "You're logged in!" : AppLocalizations.of(rootContext!)?.login_success ?? "You're logged in!");
    final result = LoginResponse.fromJson(response.data['data']);
    return _completeAuthentication(result.accessToken, result.refreshToken);
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);
