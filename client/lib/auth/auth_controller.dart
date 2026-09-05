import 'dart:io';

import 'package:client/auth/auth_api.dart';
import 'package:client/api/dio/dio_providers.dart';
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

  String? _client;

  AuthController() {
    _client = kIsWeb ? 'web' : (Platform.isAndroid || Platform.isIOS ? 'mobile' : 'desktop');
  }

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

  Future<RefreshResponse> refresh(String? refreshToken) async {
    Talker().info('AuthController.refresh called...');
    final response = await _authDio.post('/api/auth/refresh', data: {'refreshToken': kIsWeb ? null : refreshToken, 'client': _client});
    Talker().info('response status code: ${response.statusCode}');

    return RefreshResponse(accessToken: response.data['accessToken']);
  }

  @override
  Future<AuthTokens> loginWithEmail({required String email, required String password}) async {
    final response = await _authDio.post('/api/auth/login', data: {'identifier': email, 'password': password, 'client': _client});

    final loginResponse = LoginResponse.fromJson(response.data);

    return _completeAuthentication(loginResponse.accessToken, loginResponse.refreshToken);
  }

  Future<void> logout() async {
    state = const AuthState(AuthStatus.unauthenticated);

    final refreshToken = await _storage.getRefreshToken();
    final accessToken = await _storage.getAccessToken();
    await _storage.clear();

    await _authDio.post('/api/auth/logout', data: {'refreshToken': refreshToken, 'accessToken': accessToken});
  }

  @override
  Future<void> signUpWithEmail({required String email, required String password}) async {
    await _dio.post('/api/auth/email/register', data: {'email': email, 'password': password, 'client': _client});
  }

  @override
  Future<AuthTokens> verifyEmailSignUp({required String email, required String code}) async {
    final response = await _dio.post('/api/auth/email/verify', data: {'email': email, 'code': code, 'client': _client});
    final result = LoginResponse.fromJson(response.data);
    return _completeAuthentication(result.accessToken, result.refreshToken);
  }

  @override
  Future<void> requestEmailPasswordReset({required String email}) async {
    await _dio.post('/api/auth/email/password-reset', data: {'email': email, 'client': _client});
  }

  /// Assumes the backend logs the user in as part of completing the reset (nicer UX than making them log in again right after).
  @override
  Future<void> completeEmailPasswordReset({required String email, required String code, required String newPassword}) async {
    final response = await _dio.post('/api/auth/email/password-reset/verify', data: {'email': email, 'code': code, 'password': newPassword, 'client': _client});
    final result = LoginResponse.fromJson(response.data);
    await _completeAuthentication(result.accessToken, result.refreshToken);
  }

  @override
  Future<void> sendPhoneOtp({required String phone}) async {
    await _dio.post('/api/auth/otp/request', data: {'phoneNumber': phone, 'locale': 'fa', 'client': _client});
  }

  /// Backend decides whether this creates a new account or logs into an existing one — the client doesn't need to know which happened.
  @override
  Future<AuthTokens> verifyPhoneOtp({required String phone, required String code}) async {
    final response = await _dio.post('/api/auth/otp/verify', data: {'phoneNumber': phone, 'code': code, 'client': _client});
    final result = LoginResponse.fromJson(response.data);
    return _completeAuthentication(result.accessToken, result.refreshToken);
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);
