import 'package:client/auth/auth_controller.dart';
import 'package:client/components/button.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
          icon: ref.watch(themeModeProvider).isDark ? Icons.light_mode : Icons.dark_mode,
          color: .primary,
          type: ButtonType.text,
          onPressed: () {
            ref.read(themeModeProvider.notifier).toggle();
          },
        ),
        Button(
          icon: Icons.logout,
          color: .error,
          type: ButtonType.text,
          onPressed: () {
            ref.read(authControllerProvider.notifier).logout();
          },
        ),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
