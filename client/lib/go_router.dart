import 'package:client/api/root_navigator_key.dart';
import 'package:client/app_shell.dart';
import 'package:client/auth/auth_controller.dart';
import 'package:client/auth/auth_state.dart';
import 'package:client/go_router_refresh_notifier.dart';
import 'package:client/pages/app_page.dart';
import 'package:client/pages/auth/auth_page.dart';
import 'package:client/pages/home_page.dart';
import 'package:client/pages/not_found_page.dart';
import 'package:client/pages/plan/pricing_page.dart';
import 'package:client/pages/settings/settings_page.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Routes that don't require authentication. Everything else is
/// protected by default — a new route needs no extra wiring to be
/// gated, it only needs adding here to be made public.
const _publicPaths = {'/auth', '/', '/pricing'};

final goRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    refreshListenable: GoRouterRefreshNotifier(ref),
    redirect: (context, state) async {
      final authStatus = ref.read(authControllerProvider).status;

      if (authStatus == AuthStatus.loading) return null;

      final loggedIn = authStatus == AuthStatus.authenticated;
      final isPublicRoute = _publicPaths.contains(state.matchedLocation);

      if (!loggedIn && !isPublicRoute) {
        final from = Uri.encodeComponent(state.uri.toString());
        return '/auth?from=$from';
      }

      return null;
    },
    initialLocation: '/',
    errorBuilder: (b, c) => const AppShell(child: NotFoundPage()),
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const AppShell(child: HomePage()),
      ),
      GoRoute(
        path: '/app',
        builder: (context, state) => const AppShell(child: AppPage()),
      ),
      GoRoute(
        path: '/pricing',
        builder: (context, state) => AppShell(child: PricingPage(onSelectPlan: (plan) => context.go('/login?plan=${plan.id}'))),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const AppShell(child: SettingsPage()),
      ),
      GoRoute(
        path: '/auth',
        builder: (context, state) {
          final from = state.uri.queryParameters['from'];
          return AppShell(child: AuthPage(onAuthenticated: (_) => context.go((from != null && from.isNotEmpty) ? from : '/app')));
        },
      ),
    ],
  );
});
