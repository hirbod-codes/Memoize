import 'dart:async';
import 'dart:convert';

import 'package:client/components/button.dart';
import 'package:client/theme/theme_colors.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

class TextEditor extends ConsumerStatefulWidget {
  final bool editing;
  final String? json;
  final Future<void> Function(List<Map<String, dynamic>> json)? onSave;

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
      _controller.document = Document();
      Talker().error('Failure while trying to parse input json for the rich text editor, falling back to empty content for the editor.', e);
    }

    _controller.addListener(() {
      setState(() {
        _hasChanged = true;
      });
      _timer?.cancel();
      _timer = Timer(Duration(seconds: 2), () {
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

  Future<void> _onSave() async {
    if (!widget.editing) return;

    if (_saving) return;

    try {
      setState(() {
        _saving = true;
      });

      final json = _controller.document.toDelta().toJson();

      await widget.onSave?.call(json);
      if (!mounted) return;

      setState(() {
        _hasChanged = false;
        _saving = false;
      });
    } catch (e) {
      Talker().error('The _onSave method in TextEditor widget throws an error', e);
      if (!mounted) return;

      setState(() {
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    _controller.readOnly = !widget.editing;

    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 7,
        children: [
          if (widget.editing)
            Container(
              decoration: BoxDecoration(borderRadius: BorderRadiusGeometry.circular(AppRadius.md), color: theme.surface),
              child: QuillSimpleToolbar(
                controller: _controller,
                config: QuillSimpleToolbarConfig(
                  toolbarIconCrossAlignment: WrapCrossAlignment.center,
                  toolbarIconAlignment: WrapAlignment.start,
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
            decoration: BoxDecoration(borderRadius: BorderRadiusGeometry.circular(10), color: theme.surface),
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
              mainAxisAlignment: MainAxisAlignment.end,
              children: [Button(type: ButtonType.text, color: _hasChanged ? ThemeColorName.warning : ThemeColorName.primary, icon: Icons.save, isLoading: _saving, onPressed: _onSave)],
            ),
        ],
      ),
    );
  }
}
