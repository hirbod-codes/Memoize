import 'dart:developer';

import 'package:client/components/Button.dart';
import 'package:flutter/material.dart';

class Home extends StatefulWidget {
  const Home({super.key});

  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> {
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
          const Text('You have pushed the button this many times:'),
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
