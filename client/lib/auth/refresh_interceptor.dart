import 'package:client/auth/responses/refresh_response.dart';
import 'package:client/auth/token_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class RefreshInterceptor extends Interceptor {
  final Dio dio;
  final TokenStorage storage;
  final Ref ref;
  final Future<void> Function() logout;
  final Future<RefreshResponse> Function(String? refreshToken) refresh;

  RefreshInterceptor({required this.dio, required this.storage, required this.ref, required this.logout, required this.refresh});

  bool _isRefreshing = false;

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

      if (kIsWeb && refreshToken == null) {
        throw Exception();
      }

      final response = await refresh(refreshToken);

      final accessToken = response.accessToken;

      await storage.saveAccessToken(accessToken);

      final request = err.requestOptions;

      request.headers['Authorization'] = 'Bearer $accessToken';

      final retryResponse = await dio.fetch(request);

      handler.resolve(retryResponse);
    } catch (e) {
      await storage.clear();

      await logout();

      handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }
}
