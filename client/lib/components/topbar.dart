import 'package:client/auth/auth_controller.dart';
import 'package:client/auth/auth_state.dart';
import 'package:client/components/button.dart';
import 'package:client/theme/theme_colors.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class TopBar extends ConsumerWidget implements PreferredSizeWidget {
  final Widget? title;

  const TopBar({super.key, this.title});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppBar(
      title: title,
      centerTitle: false,
      actions: [
        Button(
          icon: ref.watch(themeModeProvider) == ThemeMode.dark ? Icons.light_mode : Icons.dark_mode,
          color: ThemeColorName.primary,
          type: ButtonType.text,
          onPressed: () {
            ref.read(themeModeProvider.notifier).toggle();
          },
        ),
        if (ref.watch(authControllerProvider).status == AuthStatus.unauthenticated)
          Button(
            icon: Icons.login,
            color: ThemeColorName.success,
            type: ButtonType.text,
            onPressed: () {
              context.go('/auth');
            },
          ),
        if (ref.watch(authControllerProvider).status == AuthStatus.authenticated)
          Button(
            icon: Icons.logout,
            color: ThemeColorName.error,
            type: ButtonType.text,
            onPressed: () {
              ref.read(authControllerProvider.notifier).logout();
            },
          ),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(40);
}
