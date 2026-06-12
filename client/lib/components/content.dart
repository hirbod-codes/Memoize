import 'package:client/api/models/leaf.dart';
import 'package:client/components/contents/text/text_editor.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ContentContainer extends ConsumerStatefulWidget {
  final bool editing;
  final Content content;

  const ContentContainer({super.key, required this.content, required this.editing});

  @override
  ConsumerState<ContentContainer> createState() => _ContentState();
}

class _ContentState extends ConsumerState<ContentContainer> {
  @override
  Widget build(BuildContext context) {
    switch (widget.content.type) {
      case .richText:
        return Column(
          mainAxisAlignment: .start,
          crossAxisAlignment: .center,
          children: widget.content.value.map((v) {
            return Card(
              child: TextEditor(editing: widget.editing, json: v),
            );
          }).toList(),
        );

      case .string:
        return Text('!!!');

      case .imageId:
        return Text('!!!');

      case .audioId:
        return Text('!!!');

      case .videoId:
        return Text('!!!');
    }
  }
}
