import 'package:client/components/contents/text/text_editor.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class Texts extends ConsumerStatefulWidget {
  final bool editing;
  final List<String> values;

  const Texts({super.key, required this.values, required this.editing});

  @override
  ConsumerState<Texts> createState() => _TextsState();
}

class _TextsState extends ConsumerState<Texts> {
  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: widget.values.length,
      itemBuilder: (context, index) {
        final item = widget.values[index];

        return Card(
          clipBehavior: Clip.hardEdge,
          child: TextEditor(editing: widget.editing, json: item, onSave: save),
        );
      },
    );
  }
}
