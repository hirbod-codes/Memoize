import 'package:client/api/root_navigator_key.dart';
import 'package:client/auth_gate.dart';
import 'package:client/pages/home_page.dart';
// import 'package:client/pages/settings_page.dart';
import 'package:go_router/go_router.dart';

// GoRouter configuration
final goRouter = GoRouter(
  navigatorKey: rootNavigatorKey,
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const AuthGate(child: HomePage()),
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
