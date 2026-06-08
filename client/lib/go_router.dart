import 'package:client/auth_gate.dart';
import 'package:client/pages/home_page.dart';
import 'package:client/pages/settings_page.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

// GoRouter configuration
final goRouter = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const AuthGate(title: Text('Memoize Home Page'), child: HomePage()),
    ),
    GoRoute(
      path: '/notes',
      builder: (context, state) => const AuthGate(title: Text('Memoize Home Page'), child: HomePage()),
    ),
    GoRoute(
      path: '/settings',
      builder: (context, state) => const AuthGate(title: Text('Memoize Home Page'), child: SettingsPage()),
    ),
  ],
);
