import 'package:memoize/api/dio/plan_limit_interceptor.dart';
import 'package:memoize/api/dio/web/dio_web_config.dart';
import 'package:memoize/app_config.dart';
import 'package:memoize/auth/auth_controller.dart';
import 'package:memoize/api/dio/auth_interceptor.dart';
import 'package:memoize/api/dio/refresh_interceptor.dart';
import 'package:memoize/api/dio/global_error_interceptor.dart';
import 'package:memoize/auth/token_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:memoize/api/dio/configure_ssl.dart' if (dart.library.js_interop) 'package:memoize/api/dio/configure_ssl_stub.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(baseUrl: AppConfig.apiUrl));

  trustExtraRoot(dio, ref);

  configureDioForWeb(dio);

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

  trustExtraRoot(dio, ref);

  configureDioForWeb(dio);

  dio.interceptors.add(AuthInterceptor(storage));

  var controller = ref.read(authControllerProvider.notifier);
  dio.interceptors.add(RefreshInterceptor(dio: dio, storage: storage, ref: ref, logout: controller.logout, refresh: controller.refresh));

  dio.interceptors.add(PlanLimitInterceptor());

  // Must be added after RefreshInterceptor — see comment above.
  dio.interceptors.add(GlobalErrorInterceptor());

  return dio;
});
