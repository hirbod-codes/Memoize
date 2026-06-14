import 'dart:async';
import 'dart:convert';

import 'package:client/components/button.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/foundation.dart';
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
  final QuillController _controller = () {
    return QuillController.basic(config: QuillControllerConfig());
  }();
  final FocusNode _editorFocusNode = FocusNode();
  final ScrollController _editorScrollController = ScrollController();

  bool _hasChanged = false;
  bool _saving = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();

    _controller.readOnly = !widget.editing;

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
      setState(() {
        _hasChanged = true;
      });
      _timer?.cancel();
      _timer = Timer(.new(milliseconds: 700), () {
        _onSave();
      });
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _editorScrollController.dispose();
    _editorFocusNode.dispose();
    _timer?.cancel();
    super.dispose();
  }

  void _onSave() {
    if (!widget.editing) return;

    setState(() {
      _saving = true;
    });
    final json = _controller.document.toDelta().toJson();
    print(json);
    if (widget.onSave != null) widget.onSave!(json);
    setState(() {
      _hasChanged = false;
      _saving = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: Column(
        crossAxisAlignment: .stretch,
        spacing: 7,
        children: [
          if (widget.editing)
            Container(
              decoration: BoxDecoration(borderRadius: .circular(10), color: theme.surface),
              child: QuillSimpleToolbar(
                controller: _controller,
                config: QuillSimpleToolbarConfig(
                  toolbarIconCrossAlignment: .center,
                  toolbarIconAlignment: .start,
                  buttonOptions: QuillSimpleToolbarButtonOptions(
                    base: QuillToolbarBaseButtonOptions(
                      afterButtonPressed: () {
                        final isDesktop = const {TargetPlatform.linux, TargetPlatform.windows, TargetPlatform.macOS}.contains(defaultTargetPlatform);
                        if (isDesktop) {
                          _editorFocusNode.requestFocus();
                        }
                      },
                    ),
                  ),
                ),
              ),
            ),

          Container(
            decoration: BoxDecoration(borderRadius: .circular(10), color: theme.surface),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: QuillEditor.basic(
                controller: _controller,
                focusNode: _editorFocusNode,
                scrollController: _editorScrollController,
                config: QuillEditorConfig(placeholder: !widget.editing ? null : 'Start writing your notes...', minHeight: 60, requestKeyboardFocusOnCheckListChanged: true),
              ),
            ),
          ),

          if (widget.editing)
            Row(
              mainAxisAlignment: .end,
              children: [Button(type: .text, color: _hasChanged ? .warning : .primary, icon: Icons.save, isLoading: _saving, onPressed: _onSave)],
            ),
        ],
      ),
    );
  }
}
