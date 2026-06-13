import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:client/components/button.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class TimeStampEmbed extends Embeddable {
  const TimeStampEmbed(String value) : super(timeStampType, value);

  static const String timeStampType = 'timeStamp';

  static TimeStampEmbed fromDocument(Document document) => TimeStampEmbed(jsonEncode(document.toDelta().toJson()));

  Document get document => Document.fromJson(jsonDecode(data));
}

class TimeStampEmbedBuilder extends EmbedBuilder {
  @override
  String get key => 'timeStamp';

  @override
  String toPlainText(Embed node) {
    return node.value.data;
  }

  @override
  Widget build(BuildContext context, EmbedContext embedContext) {
    return Row(children: [const Icon(Icons.access_time_rounded), Text(embedContext.node.value.data as String)]);
  }
}

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

  Timer? _timer;

  @override
  void initState() {
    super.initState();

    _controller.readOnly = widget.editing;

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
    _editorScrollController.dispose();
    _editorFocusNode.dispose();
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
        spacing: 7,
        children: [
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
                config: const QuillEditorConfig(placeholder: 'Start writing your notes...', minHeight: 60, requestKeyboardFocusOnCheckListChanged: true),
              ),
            ),
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
