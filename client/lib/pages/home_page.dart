import 'dart:developer';

import 'package:client/components/button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  int _counter = 0;

  void _incrementCounter() {
    setState(() {
      _counter++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: .center,
        spacing: 5,
        children: [
          const Text('You have pushed the button many times:'),
          Text('$_counter', style: Theme.of(context).textTheme.headlineMedium),
          Button(
            label: 'Add',
            color: ButtonColor.success,
            type: ButtonType.outlined,
            onPressed: () {
              _incrementCounter();
              log('clicked');
            },
          ),
        ],
      ),
    );
  }
}
