import 'package:client/components/navbar.dart';
import 'package:client/components/topbar.dart';
import 'package:flutter/material.dart';

class AppShell extends StatelessWidget {
  final Widget child;
  final Widget title;

  const AppShell({super.key, required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: TopBar(title: title),
      body: child,
      // FloatingActionButton(backgroundColor: AppColors.primary, onPressed: _incrementCounter, tooltip: 'Increment', child: const Icon(Icons.add)),
      bottomNavigationBar: NavBar(currentIndex: 0, onChanged: (i) {}),
    );
  }
}
