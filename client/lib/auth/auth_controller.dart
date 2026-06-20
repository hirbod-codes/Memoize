import 'package:client/auth/dio_providers.dart';
import 'package:client/auth/auth_state.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/auth/responses/login_response.dart';
import 'package:client/auth/responses/refresh_response.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AuthController extends Notifier<AuthState> {
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
    final refreshToken = await _storage.getRefreshToken();

    if (refreshToken == null) {
      state = const AuthState(AuthStatus.unauthenticated);
      return;
    }

    try {
      final result = await refresh(refreshToken);

      await _storage.saveAccessToken(result.accessToken);

      state = const AuthState(AuthStatus.authenticated);
    } catch (_) {
      await _storage.clear();

      state = const AuthState(AuthStatus.unauthenticated);
    }
  }

  Future<RefreshResponse> refresh(String refreshToken) async {
    final response = await _authDio.post('/api/auth/refresh', data: {'refreshToken': refreshToken, 'noCookies': 'true'});

    return RefreshResponse(accessToken: response.data['accessToken']);
  }

  Future<void> login(String identifier, String password) async {
    final response = await _authDio.post('/api/auth/login', data: {'identifier': identifier, 'password': password, 'noCookies': 'true'});

    final loginResponse = LoginResponse.fromJson(response.data);

    await _storage.saveAccessToken(loginResponse.accessToken);

    await _storage.saveRefreshToken(loginResponse.refreshToken);

    state = const AuthState(AuthStatus.authenticated);
  }

  Future<void> logout() async {
    state = const AuthState(AuthStatus.unauthenticated);

    final refreshToken = await _storage.getRefreshToken();
    final accessToken = await _storage.getAccessToken();
    await _storage.clear();

    if (refreshToken != null) await _dio.post('/api/auth/logout', data: {'refreshToken': refreshToken, 'accessToken': accessToken});
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);
