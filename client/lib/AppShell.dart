import 'package:client/components/NavBar.dart';
import 'package:client/components/TopBar.dart';
import 'package:flutter/material.dart';

class AppShell extends StatelessWidget {
  final Widget child;
  final Widget title;

  const AppShell({super.key, required this.child, required this.title});

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
