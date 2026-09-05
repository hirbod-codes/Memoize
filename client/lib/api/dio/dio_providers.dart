import 'package:client/app_config.dart';
import 'package:client/auth/auth_controller.dart';
import 'package:client/api/dio/auth_interceptor.dart';
import 'package:client/api/dio/refresh_interceptor.dart';
import 'package:client/api/dio/global_error_interceptor.dart';
import 'package:client/auth/token_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(baseUrl: AppConfig.apiUrl));

  // Added last: onError handlers run in interceptor-registration order,
  // so anything that can silently recover from a failure (token refresh,
  // retries) needs to run before this one, or the user sees an error
  // toast for something that was actually handled transparently.
  dio.interceptors.add(GlobalErrorInterceptor());

  return dio;
});

final authDioProvider = Provider<Dio>((ref) {
  final storage = ref.read(tokenStorageProvider);

  final dio = Dio(BaseOptions(baseUrl: AppConfig.apiUrl));

  dio.interceptors.add(AuthInterceptor(storage));

  var controller = ref.read(authControllerProvider.notifier);
  dio.interceptors.add(RefreshInterceptor(dio: dio, storage: storage, ref: ref, logout: controller.logout, refresh: controller.refresh));

  // Must be added after RefreshInterceptor — see comment above.
  dio.interceptors.add(GlobalErrorInterceptor());

  return dio;
});
