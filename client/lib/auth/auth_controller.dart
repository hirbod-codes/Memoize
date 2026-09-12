import 'dart:io';
import 'dart:ui';

import 'package:client/account/account_controller.dart';
import 'package:client/account/user_info_storage.dart';
import 'package:client/auth/auth_api.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:client/api/api_call_extensions.dart';
import 'package:client/auth/auth_state.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/auth/responses/login_response.dart';
import 'package:client/auth/responses/refresh_response.dart';
import 'package:client/auth/models/auth_models.dart';
import 'package:client/localization/calendars/calendar_controller.dart';
import 'package:client/localization/locale_controller.dart';
import 'package:client/localization/timezone_controller.dart';
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
        final result = await refresh(null);
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
      final result = await refresh(refreshToken);
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
    final account = ref.read(accountControllerProvider);
    final userInfo = await account.getUserInfo();

    await UserInfoStorage.save(userInfo);

    if (userInfo.avatarKey != null) {
      final bytes = await account.fetchAvatar(userInfo.avatarKey!);
      ref.read(avatarBytesProvider.notifier).state = bytes;
    }

    // Account is the source of truth once logged in — whatever's saved
    // there overwrites whatever was already on this device.
    if (userInfo.locale != null) {
      await ref.read(localeControllerProvider.notifier).setLocale(Locale(userInfo.locale!));
    }
    if (userInfo.calendarType != null) {
      await ref.read(calendarControllerProvider.notifier).setCalendarType(userInfo.calendarType!);
    }
    if (userInfo.timeZone != null) {
      await ref.read(timezoneControllerProvider.notifier).setZone(userInfo.timeZone!);
    }
  }

  Future<RefreshResponse> refresh(String? refreshToken) async {
    Talker().info('AuthController.refresh called...');

    final response = await _authDio.post('/api/auth/refresh', data: {'refreshToken': kIsWeb ? null : refreshToken, 'client': _client});
    Talker().info('response status code: ${response.statusCode}');

    return RefreshResponse(accessToken: response.data['data']['accessToken'], refreshToken: response.data['data']?['refreshToken']);
  }

  @override
  Future<AuthTokens> loginWithEmail({required String email, required String password}) async {
    final response = await _authDio
        .post('/api/auth/login', data: {'identifier': email, 'password': password, 'client': _client})
        .notifyOnSuccess('Welcome back!');

    final loginResponse = LoginResponse.fromJson(response.data['data']);

    return _completeAuthentication(loginResponse.accessToken, loginResponse.refreshToken);
  }

  Future<void> logout() async {
    state = const AuthState(AuthStatus.unauthenticated);

    final refreshToken = await _storage.getRefreshToken();
    final accessToken = await _storage.getAccessToken();
    await _storage.clear();

    await UserInfoStorage.clear();
    ref.read(avatarBytesProvider.notifier).set(null);

    await _authDio.post('/api/auth/logout', data: {'refreshToken': refreshToken, 'accessToken': accessToken});
  }

  @override
  Future<void> signUpWithEmail({required String email, required String password}) async {
    await _authDio
        .post('/api/auth/email/register', data: {'email': email, 'password': password, 'client': _client})
        .notifyOnSuccess('Verification code sent to your email.');
  }

  @override
  Future<AuthTokens> verifyEmailSignUp({required String email, required String code}) async {
    final response = await _authDio
        .post('/api/auth/email/verify', data: {'email': email, 'code': code, 'client': _client})
        .notifyOnSuccess("You're all set! Account created.");
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
        .notifyOnSuccess('Password updated successfully.');
    final result = LoginResponse.fromJson(response.data['data']);
    await _completeAuthentication(result.accessToken, result.refreshToken);
  }

  @override
  Future<void> sendPhoneOtp({required String phone}) async {
    await _authDio.post('/api/auth/otp/request', data: {'phoneNumber': phone, 'locale': 'fa', 'client': _client}).notifyOnSuccess('Code sent to your phone.');
  }

  @override
  Future<AuthTokens> verifyPhoneOtp({required String phone, required String code}) async {
    final response = await _authDio
        .post('/api/auth/otp/verify', data: {'phoneNumber': phone, 'code': code, 'client': _client})
        .notifyOnSuccess("You're logged in!");
    final result = LoginResponse.fromJson(response.data['data']);
    return _completeAuthentication(result.accessToken, result.refreshToken);
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);
