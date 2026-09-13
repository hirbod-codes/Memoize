import 'package:client/api/dio/global_error_interceptor.dart';
import 'package:client/auth/responses/refresh_response.dart';
import 'package:client/auth/token_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class RefreshInterceptor extends Interceptor {
  final Dio dio;
  final TokenStorage storage;
  final Ref ref;
  final Future<void> Function({bool silent}) logout;
  final Future<RefreshResponse> Function(String? refreshToken, {bool silent}) refresh;

  RefreshInterceptor({required this.dio, required this.storage, required this.ref, required this.logout, required this.refresh});

  bool _isRefreshing = false;

  bool _isSilent = false;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler? handler) {
    _isSilent = options.extra[GlobalErrorInterceptor.silentErrorsKey] == true;

    handler?.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    if (_isRefreshing) {
      handler.next(err);
      return;
    }

    _isRefreshing = true;

    try {
      final refreshToken = await storage.getRefreshToken();

      if (!kIsWeb && refreshToken == null) throw err;

      final response = await refresh(refreshToken, silent: _isSilent);

      final accessToken = response.accessToken;
      await storage.saveAccessToken(accessToken);

      final newRefreshToken = response.refreshToken;
      if (newRefreshToken != null) await storage.saveRefreshToken(newRefreshToken);

      final request = err.requestOptions;

      request.headers['Authorization'] = 'Bearer $accessToken';

      final retryResponse = await dio.fetch(request);

      handler.resolve(retryResponse);
    } catch (e) {
      await storage.clear();

      await logout(silent: _isSilent);

      handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }
}
