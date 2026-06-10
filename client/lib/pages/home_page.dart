import 'dart:developer';

import 'package:client/api/folder_cotroller.dart';
import 'package:client/api/leaf_controller.dart';
import 'package:client/api/models/folder.dart';
import 'package:client/api/models/leaf.dart';
import 'package:client/components/button.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  final TextEditingController _searchController = TextEditingController();
  String _searchText = '';
  bool _fetching = false;
  List<Folder> _folders = [];
  List<Leaf>? _leafs;

  @override
  void initState() {
    super.initState();

    // Runs once when the widget is inserted
    _initialize();
  }

  Future<void> _initialize() async {
    final folderController = ref.read(folderControllerProvider);

    setState(() {
      _fetching = true;
    });

    final folders = await folderController.getRoot();

    // to avoid exceptions if the user navigates away before the request completes.
    if (!mounted) return;

    setState(() {
      _folders = folders;
      _fetching = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final folderController = ref.read(folderControllerProvider);
    final leafController = ref.read(leafControllerProvider);
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    return Container(
      width: .infinity,
      height: .infinity,
      padding: EdgeInsetsGeometry.all(20),
      decoration: BoxDecoration(
        border: Border.all(color: theme.outline),
        borderRadius: BorderRadius.all(Radius.circular(AppRadius.md)),
      ),
      child: Column(
        mainAxisAlignment: .start,
        crossAxisAlignment: .stretch,
        spacing: 5,
        children: [
          TextField(
            controller: _searchController,
            decoration: const InputDecoration(labelText: 'Search', prefixIcon: Icon(Icons.search)),
            onChanged: (value) {
              setState(() {
                _searchText = value;
              });
            },
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _folders.length,
              itemBuilder: (context, index) {
                final item = _folders[index];

                return Card(
                  clipBehavior: Clip.hardEdge,
                  child: InkWell(
                    onTap: () async {
                      setState(() {
                        _fetching = true;
                      });

                      final folders = await folderController.getChildren(parentTreeNodeId: item.id);
                      final leafs = await leafController.getChildren(parentTreeNodeId: item.id);

                      setState(() {
                        _fetching = false;
                        _folders = folders;
                        _leafs = leafs;
                      });
                    },
                    child: Padding(
                      padding: .all(5),
                      child: ListTile(
                        title: Text(item.title),
                        trailing: Button(
                          type: .text,
                          color: .primary,
                          icon: Icons.chevron_right,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const Text('You have pushed the button this many times:'),
          Text('0', style: Theme.of(context).textTheme.headlineMedium),
          Button(
            label: 'Add',
            color: .success,
            type: ButtonType.outlined,
            onPressed: () {
              log('clicked');
            },
          ),
        ],
      ),
    );
  }
}
