import 'package:client/api/root_navigator_key.dart';
import 'package:client/app_shell.dart';
import 'package:client/auth/auth_controller.dart';
import 'package:client/auth/auth_state.dart';
import 'package:client/go_router_refresh_notifier.dart';
import 'package:client/pages/auth_page.dart';
import 'package:client/pages/home_page.dart';
// import 'package:client/pages/settings_page.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Routes that don't require authentication. Everything else is
/// protected by default — a new route needs no extra wiring to be
/// gated, it only needs adding here to be made public.
const _publicPaths = {'/login'};

final goRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    refreshListenable: GoRouterRefreshNotifier(ref),
    redirect: (context, state) {
      final authStatus = ref.read(authControllerProvider).status;

      if (authStatus == AuthStatus.loading) return null;

      final loggedIn = authStatus == AuthStatus.authenticated;
      print('state.matchedLocation --------------------->  ${state.matchedLocation} ${state.path} ${state.uri}');
      final isPublicRoute = _publicPaths.contains(state.matchedLocation);

      if (!loggedIn && !isPublicRoute) {
        final from = Uri.encodeComponent(state.uri.toString());
        return '/login?from=$from';
      }

      if (loggedIn && isPublicRoute) {
        final from = state.uri.queryParameters['from'];
        return (from != null && from.isNotEmpty) ? from : '/';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) {
          final from = state.uri.queryParameters['from'];
          return AuthPage(onAuthenticated: (_) => context.go((from != null && from.isNotEmpty) ? from : '/'));
        },
      ),
      GoRoute(
        path: '/',
        builder: (context, state) => const AppShell(child: HomePage()),
      ),
      // GoRoute(
      //   path: '/notes',
      //   builder: (context, state) => const AuthGate(child: HomePage()),
      // ),
      // GoRoute(
      //   path: '/settings',
      //   builder: (context, state) => const AuthGate(child: SettingsPage()),
      // ),
    ],
  );
});
