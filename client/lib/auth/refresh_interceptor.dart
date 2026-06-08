import 'package:client/auth/auth_controller.dart';
import 'package:client/auth/token_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class RefreshInterceptor extends Interceptor {
  final Dio dio;
  final TokenStorage storage;
  final Ref ref;

  RefreshInterceptor({required this.dio, required this.storage, required this.ref});

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

      if (refreshToken == null) {
        throw Exception();
      }

      final response = await dio.post('/api/auth/refresh', data: {'refreshToken': refreshToken});

      final accessToken = response.data['accessToken'];

      final newRefreshToken = response.data['refreshToken'];

      await storage.saveAccessToken(accessToken);

      await storage.saveRefreshToken(newRefreshToken);

      final request = err.requestOptions;

      request.headers['Authorization'] = 'Bearer $accessToken';

      final retryResponse = await dio.fetch(request);

      handler.resolve(retryResponse);
    } catch (_) {
      await storage.clear();

      ref.read(authControllerProvider.notifier).logout();

      handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }
}
