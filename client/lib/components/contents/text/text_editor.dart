import 'dart:async';
import 'dart:convert';

import 'package:client/components/button.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class TextEditor extends ConsumerStatefulWidget {
  final bool editing;
  final String? json;
  final Function? onSave;

  const TextEditor({super.key, required this.editing, this.json, this.onSave});

  @override
  ConsumerState<TextEditor> createState() => _TextEditorState();
}

class _TextEditorState extends ConsumerState<TextEditor> {
  final FocusNode _focusNode = FocusNode();
  late final QuillController _controller;
  Timer? _timer = null;

  @override
  void initState() {
    super.initState();

    _controller = QuillController.basic();
    _controller.readOnly = widget.editing;
    // _controller.ignoreFocusOnTextChange = true;

    try {
      if (widget.json != null && widget.json != '') {
        final json = jsonDecode(widget.json!);
        _controller.document = Document.fromJson(json);
      }
    } catch (e) {
      _controller.document = .new();
      print('\nerror!');
      print(e);
    }

    _controller.addListener(() {
      _timer?.cancel();
      _timer = Timer(.new(milliseconds: 700), () {
        _onSave();
      });
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _timer?.cancel();
    super.dispose();
  }

  void _onSave() {
    final json = _controller.document.toDelta().toJson();
    print(json);
    if (widget.onSave != null) widget.onSave!(json);
  }

  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: Column(
        crossAxisAlignment: .stretch,
        spacing: 5,
        children: [
          Container(
            decoration: BoxDecoration(
              border: .all(width: 1, color: theme.outlineVariant),
              borderRadius: .circular(10),
            ),
            child: QuillSimpleToolbar(
              controller: _controller,
              config: const QuillSimpleToolbarConfig(toolbarIconCrossAlignment: .center, toolbarIconAlignment: .start),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(4),
            child: QuillEditor.basic(controller: _controller, config: const QuillEditorConfig(minHeight: 40)),
          ),

          Row(
            mainAxisAlignment: .end,
            children: [Button(type: .text, color: .primary, icon: Icons.save, onPressed: _onSave)],
          ),
        ],
      ),
    );
  }
}
