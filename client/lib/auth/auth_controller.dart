import 'dart:io';

import 'package:client/auth/auth_api.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:client/auth/auth_state.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/auth/responses/login_response.dart';
import 'package:client/auth/responses/refresh_response.dart';
import 'package:client/auth/models/auth_models.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

class AuthController extends Notifier<AuthState> implements AuthApi {
  late final TokenStorage _storage;
  late final Dio _authDio;
  late final Dio _dio;

  @override
  AuthState build() {
    _storage = ref.read(tokenStorageProvider);
    _dio = ref.watch(dioProvider);
    _authDio = ref.watch(authDioProvider);

    _initialize();

    return const AuthState(AuthStatus.loading);
  }

  Future<void> _initialize() async {
    Talker().info('AuthController._initialize called...');

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

      await _storage.saveAccessToken(result.accessToken);

      state = const AuthState(AuthStatus.authenticated);
    } catch (e) {
      Talker().error('error: $e');

      await _storage.clear();

      state = const AuthState(AuthStatus.unauthenticated);
    }

    Talker().info('AuthController._initialize ended');
  }

  // ---------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------

  /// Persists tokens and flips global session state to authenticated.
  /// Every flow that ends with the user logged in (password login, phone
  /// OTP, email signup verification, password reset) funnels through
  /// here so there's exactly one place session state actually changes.
  Future<AuthTokens> _completeAuthentication(String accessToken, String? refreshToken) async {
    await _storage.saveAccessToken(accessToken);
    if (refreshToken != null) await _storage.saveRefreshToken(refreshToken);

    state = const AuthState(AuthStatus.authenticated);

    return AuthTokens(accessToken: accessToken, refreshToken: refreshToken);
  }

  /// Converts a DioException into the user-facing AuthException the UI
  /// layer expects (see AuthApi's contract). Adjust the field names here
  /// to match your actual error response shape — assumes
  /// `{ "message": "..." }` or `{ "errors": ["..."] }`, matching the
  /// pattern used elsewhere in your backend (e.g. the video upload route).
  AuthException _mapError(DioException e) {
    final data = e.response?.data;
    if (data is Map) {
      final message = data['message'];
      if (message is String && message.isNotEmpty) return AuthException(message);

      final errors = data['errors'];
      if (errors is List && errors.isNotEmpty) {
        return AuthException(errors.map((e) => e.toString()).join(', '));
      }
    }
    return const AuthException('Something went wrong. Please try again.');
  }

  Future<T> _guarded<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  // ---------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------

  Future<RefreshResponse> refresh(String? refreshToken) async {
    Talker().info('AuthController.refresh called...');
    final response = await _authDio.post('/api/auth/refresh', data: {'refreshToken': kIsWeb ? null : refreshToken, 'client': kIsWeb ? 'web' : (Platform.isAndroid || Platform.isIOS ? 'mobile' : 'desktop')});
    Talker().info('response status code: ${response.statusCode}');

    return RefreshResponse(accessToken: response.data['accessToken']);
  }

  @override
  Future<AuthTokens> loginWithEmail({required String email, required String password}) async {
    final response = await _authDio.post('/api/auth/login', data: {'identifier': email, 'password': password, 'client': kIsWeb ? 'web' : (Platform.isAndroid || Platform.isIOS ? 'mobile' : 'desktop')});

    final loginResponse = LoginResponse.fromJson(response.data);

    await _completeAuthentication(loginResponse.accessToken, loginResponse.refreshToken);

    final access = await _storage.getAccessToken();
    final refresh = await _storage.getRefreshToken();
    return AuthTokens(accessToken: access ?? '', refreshToken: refresh ?? '');
  }

  Future<void> logout() async {
    state = const AuthState(AuthStatus.unauthenticated);

    final refreshToken = await _storage.getRefreshToken();
    final accessToken = await _storage.getAccessToken();
    await _storage.clear();

    await _dio.post('/api/auth/logout', data: {'refreshToken': refreshToken, 'accessToken': accessToken});
  }

  @override
  Future<void> signUpWithEmail({required String email, required String password}) => _guarded(() async {
    await _authDio.post('/api/auth/email/register', data: {'email': email, 'password': password});
  });

  @override
  Future<AuthTokens> verifyEmailSignUp({required String email, required String code}) => _guarded(() async {
    final response = await _authDio.post('/api/auth/email/verify', data: {'email': email, 'code': code});
    final result = LoginResponse.fromJson(response.data);
    return _completeAuthentication(result.accessToken, result.refreshToken);
  });

  @override
  Future<void> resendSignUpVerificationCode({required String email}) => _guarded(() async {
    await _authDio.post('/api/auth/email/signup/resend', data: {'email': email});
  });

  @override
  Future<void> requestEmailPasswordReset({required String email}) => _guarded(() async {
    await _authDio.post('/api/auth/email/password-reset', data: {'email': email});
  });

  /// Assumes the backend logs the user in as part of completing the reset (nicer UX than making them log in again right after).
  @override
  Future<void> completeEmailPasswordReset({required String email, required String code, required String newPassword}) => _guarded(() async {
    final response = await _authDio.post('/api/auth/email/password-reset/verify', data: {'email': email, 'code': code, 'password': newPassword});
    final result = LoginResponse.fromJson(response.data);
    await _completeAuthentication(result.accessToken, result.refreshToken);
  });

  @override
  Future<void> resendPasswordResetCode({required String email}) => _guarded(() async {
    await _authDio.post('/api/auth/email/password-reset/resend', data: {'email': email});
  });

  @override
  Future<void> sendPhoneOtp({required String phone}) => _guarded(() async {
    await _authDio.post('/api/auth/otp/request', data: {'phoneNumber': phone, 'locale': 'fa'});
  });

  /// Backend decides whether this creates a new account or logs into an existing one — the client doesn't need to know which happened.
  @override
  Future<AuthTokens> verifyPhoneOtp({required String phone, required String code}) => _guarded(() async {
    final response = await _authDio.post('/api/auth/otp/verify', data: {'phoneNumber': phone, 'code': code});
    final result = LoginResponse.fromJson(response.data);
    return _completeAuthentication(result.accessToken, result.refreshToken);
  });

  @override
  Future<void> resendPhoneOtp({required String phone}) => _guarded(() async {
    await _authDio.post('/api/auth/phone/otp/resend', data: {'phone': phone});
  });
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);
