import 'package:client/auth_gate.dart';
import 'package:client/pages/home_page.dart';
import 'package:client/pages/settings_page.dart';
import 'package:go_router/go_router.dart';

// GoRouter configuration
final goRouter = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const AuthGate(child: MobileHomePage()),
    ),
    GoRoute(
      path: '/notes',
      builder: (context, state) => const AuthGate(child: MobileHomePage()),
    ),
    GoRoute(
      path: '/settings',
      builder: (context, state) => const AuthGate(child: SettingsPage()),
    ),
  ],
);
