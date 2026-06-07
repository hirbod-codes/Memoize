import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

int getCurrentIndex(BuildContext context) {
  final location = GoRouterState.of(context).uri.path;

  switch (location) {
    case '/':
      return 0;
    case '/notes':
      return 1;
    case '/settings':
      return 2;
    default:
      return 0;
  }
}

class NavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onChanged;

  const NavBar({super.key, required this.currentIndex, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return NavigationBar(
      selectedIndex: getCurrentIndex(context),
      onDestinationSelected: (index) {
        switch (index) {
          case 0:
            context.go('/');
            break;
          case 1:
            context.go('/notes');
            break;
          case 2:
            context.go('/settings');
            break;
        }
      },
      destinations: const [
        NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
        NavigationDestination(icon: Icon(Icons.note_sharp), label: 'Notes'),
        NavigationDestination(icon: Icon(Icons.settings), label: 'Settings'),
      ],
    );
  }
}
