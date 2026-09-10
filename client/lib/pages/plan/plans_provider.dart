import 'package:client/api/api_call_extensions.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:client/api/models/plan.dart';

/// Public, unauthenticated — uses the plain dioProvider, matching the
/// same pattern as supportedAuthMethodsProvider. autoDispose so pricing
/// changes on the backend aren't stuck cached for the app's entire
/// lifetime; the page's own retry action re-runs this on demand too.
final plansProvider = FutureProvider.autoDispose<List<Plan>>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get('/api/plan');
  final data = response.unwrapData()['plans'] as List<dynamic>;

  return data.toList().map((e) => Plan.fromJson(e)).toList();
});
