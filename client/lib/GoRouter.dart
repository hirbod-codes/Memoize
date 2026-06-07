import 'package:client/AppShell.dart';
import 'package:client/routes/Home.dart';
import 'package:client/routes/Settings.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

// GoRouter configuration
final goRouter = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const AppShell(title: Text('Memoize Home Page'), child: Home()),
    ),
    GoRoute(
      path: '/notes',
      builder: (context, state) => const AppShell(title: Text('Memoize Home Page'), child: Home()),
    ),
    GoRoute(
      path: '/settings',
      builder: (context, state) => const AppShell(title: Text('Memoize Home Page'), child: Settings()),
    ),
  ],
);
