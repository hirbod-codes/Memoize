import 'package:client/app_config.dart';
import 'package:client/auth/auth_controller.dart';
import 'package:client/auth/auth_interceptor.dart';
import 'package:client/auth/refresh_interceptor.dart';
import 'package:client/auth/token_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final dioProvider = Provider<Dio>((ref) {
  return Dio(BaseOptions(baseUrl: AppConfig.apiUrl));
});

final authDioProvider = Provider<Dio>((ref) {
  final storage = ref.read(tokenStorageProvider);

  final dio = Dio(BaseOptions(baseUrl: AppConfig.apiUrl));

  dio.interceptors.add(AuthInterceptor(storage));

  var controller = ref.read(authControllerProvider.notifier);
  dio.interceptors.add(RefreshInterceptor(dio: dio, storage: storage, ref: ref, logout: controller.logout, refresh: controller.refresh));

  return dio;
});
