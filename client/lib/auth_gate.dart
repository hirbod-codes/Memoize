import 'package:client/app_shell.dart';
import 'package:client/auth/auth_controller.dart';
import 'package:client/auth/auth_state.dart';
import 'package:client/pages/login_page.dart';
import 'package:client/pages/splash_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AuthGate extends ConsumerWidget {
  final Widget title;
  final Widget child;

  const AuthGate({super.key, required this.title, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);

    switch (auth.status) {
      case AuthStatus.loading:
        return const SplashPage();

      case AuthStatus.authenticated:
        return AppShell(title: title, child: child);

      case AuthStatus.unauthenticated:
        return const LoginPage();
    }
  }
}
