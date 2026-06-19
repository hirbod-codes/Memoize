import 'package:client/api/leaf_controller.dart';
import 'package:client/api/models/leaf.dart';
import 'package:client/components/audio_upload_dialog.dart';
import 'package:client/components/button.dart';
import 'package:client/components/content.dart';
import 'package:client/components/image_upload_dialog.dart';
import 'package:client/components/video_upload_dialog.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:dio/dio.dart' show Response;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/material.dart';

import 'header_delegate.dart';

class FileManager extends ConsumerStatefulWidget {
  final Leaf file;
  final Function? onClose;
  final Function? onFileChanged;

  const FileManager({super.key, required this.file, this.onClose, this.onFileChanged});

  @override
  ConsumerState<FileManager> createState() => _FileManager();
}

class _FileManager extends ConsumerState<FileManager> {
  bool _editing = false;
  bool _isTerm = true;

  Future<void> _onContentAdd(int? index) async {
    if (index == null) {
      return;
    }

    Leaf updatedFile = widget.file.copyWith();
    List<Content> contents;
    if (_isTerm) {
      contents = updatedFile.termContents;
    } else {
      contents = updatedFile.definitionContents;
    }

    switch (contents[index].type) {
      case .string:
        contents[index].value.add('');
        Response<dynamic> result;
        if (_isTerm) {
          result = await ref.read(leafControllerProvider).patch(id: widget.file.id, termContents: contents);
        } else {
          result = await ref.read(leafControllerProvider).patch(id: widget.file.id, definitionContents: contents);
        }

        if (result.statusCode != null && result.statusCode! >= 200 && result.statusCode! < 300) {
          widget.onFileChanged?.call(updatedFile);
        }
        break;

      case .richText:
        contents[index].value.add('');
        Response<dynamic> result;
        if (_isTerm) {
          result = await ref.read(leafControllerProvider).patch(id: widget.file.id, termContents: contents);
        } else {
          result = await ref.read(leafControllerProvider).patch(id: widget.file.id, definitionContents: contents);
        }

        if (result.statusCode != null && result.statusCode! >= 200 && result.statusCode! < 300) {
          widget.onFileChanged?.call(updatedFile);
        }
        break;

      case .imageId:
        String? newId = await showDialog<String?>(context: context, builder: (_) => ImageUploadDialog());
        if (newId == null || !mounted) return;

        contents[index].value.add(newId);
        widget.onFileChanged?.call(updatedFile);
        break;
      case ContentType.videoId:
        String? newId = await showDialog<String?>(context: context, builder: (_) => VideoUploadDialog());
        if (newId == null || !mounted) return;

        contents[index].value.add(newId);
        widget.onFileChanged?.call(updatedFile);
      case ContentType.audioId:
        String? newId = await showDialog<String?>(context: context, builder: (_) => AudioUploadDialog());
        if (newId == null || !mounted) return;

        contents[index].value.add(newId);
        widget.onFileChanged?.call(updatedFile);
    }
  }

  Future<void> _onContentDelete(int index) async {
    showDialog(
      context: context,
      builder: (_) {
        return Dialog(
          insetPadding: const EdgeInsets.all(20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: .start,
                children: [
                  const Text('Are you sure?\nthis action is irreversible!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),

                  const SizedBox(height: 16),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Button(type: .text, color: .error, onPressed: () => Navigator.pop(context), label: 'No'),

                      const SizedBox(width: 8),

                      Button(
                        type: .elevated,
                        color: .success,
                        onPressed: () async {
                          await _contentDelete(index);
                          if (mounted) Navigator.pop(context);
                        },
                        label: "Yes",
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _contentDelete(int index) async {
    final updatedFile = widget.file.copyWith();
    if (_isTerm) {
      updatedFile.termContents.removeAt(index);
    } else {
      updatedFile.definitionContents.removeAt(index);
    }

    Response<dynamic> result;
    if (_isTerm) {
      result = await ref.read(leafControllerProvider).patch(id: widget.file.id, termContents: updatedFile.termContents);
    } else {
      result = await ref.read(leafControllerProvider).patch(id: widget.file.id, definitionContents: updatedFile.definitionContents);
    }

    if (result.statusCode != null && result.statusCode! >= 200 && result.statusCode! < 300) {
      // setState(() {
      //   widget.file = updatedFile;
      // });

      widget.onFileChanged?.call(updatedFile);
    }
  }

  Future<void> _onContentChange(Content content, int index) async {
    showDialog(
      context: context,
      builder: (_) {
        return Dialog(
          insetPadding: const EdgeInsets.all(20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: .start,
                children: [
                  const Text('Are you sure?\nthis action is irreversible!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),

                  const SizedBox(height: 16),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Button(type: .text, color: .error, onPressed: () => Navigator.pop(context), label: 'No'),

                      const SizedBox(width: 8),

                      Button(
                        type: .elevated,
                        color: .success,
                        onPressed: () async {
                          await _contentChange(content, index);
                          if (mounted) Navigator.pop(context);
                        },
                        label: "Yes",
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _contentChange(Content content, int index) async {
    final updatedContents = (_isTerm ? widget.file.termContents : widget.file.definitionContents).map((c) {
      if (_isTerm) if (c != widget.file.termContents[index]) return c;
      if (!_isTerm) if (c != widget.file.definitionContents[index]) return c;

      return content;
    }).toList();

    Leaf updatedFile;
    if (_isTerm) {
      updatedFile = widget.file.copyWith(termContents: updatedContents);
    } else {
      updatedFile = widget.file.copyWith(definitionContents: updatedContents);
    }

    Response<dynamic> result;
    if (_isTerm) {
      result = await ref.read(leafControllerProvider).patch(id: widget.file.id, termContents: updatedFile.termContents);
    } else {
      result = await ref.read(leafControllerProvider).patch(id: widget.file.id, definitionContents: updatedFile.definitionContents);
    }

    if (result.statusCode != null && result.statusCode! >= 200 && result.statusCode! < 300) {
      // setState(() {
      //   widget.file = updatedFile;
      // });

      await widget.onFileChanged?.call(updatedFile);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Material(
        elevation: 4,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Padding(
          padding: .all(5),
          child: CustomScrollView(
            slivers: [
              SliverPersistentHeader(
                pinned: true,
                delegate: HeaderDelegate(
                  height: 120,
                  child: Container(
                    decoration: BoxDecoration(color: theme.surface),
                    child: Column(
                      mainAxisAlignment: .start,
                      crossAxisAlignment: .stretch,
                      spacing: 5,
                      children: [
                        // Close button
                        Row(
                          mainAxisAlignment: .end,
                          children: [
                            Button(
                              type: .text,
                              color: .onSurface,
                              icon: Icons.close,
                              onPressed: () {
                                if (widget.onClose != null) widget.onClose!();
                              },
                            ),
                          ],
                        ),

                        // Edit button
                        Row(
                          mainAxisAlignment: .spaceBetween,
                          children: [
                            Button(
                              type: .text,
                              color: .primary,
                              icon: Icons.flip,
                              onPressed: () {
                                setState(() {
                                  _isTerm = !_isTerm;
                                });
                              },
                            ),
                            Button(
                              type: .text,
                              color: .primary,
                              icon: _editing ? Icons.remove_red_eye_outlined : Icons.edit_square,
                              onPressed: () {
                                setState(() {
                                  _editing = !_editing;
                                });
                              },
                            ),
                          ],
                        ),

                        // Title
                        Text(widget.file.title),
                        Divider(color: theme.outlineVariant, height: 1),
                      ],
                    ),
                  ),
                ),
              ),

              SliverList(
                delegate: SliverChildBuilderDelegate(
                  childCount: _isTerm ? widget.file.termContents.length : widget.file.definitionContents.length,
                  (context, index) => Container(
                    margin: .fromSTEB(0, 0, 0, 15),
                    clipBehavior: .antiAlias,
                    decoration: BoxDecoration(
                      border: .all(color: theme.outlineVariant, width: 1),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Column(
                        mainAxisAlignment: .start,
                        crossAxisAlignment: .stretch,
                        spacing: 10,
                        children: [
                          if (_editing)
                            Row(
                              mainAxisAlignment: .spaceBetween,
                              children: [
                                Button(type: .text, color: .error, icon: Icons.highlight_remove, iconSize: 24, onPressed: () => _onContentDelete(index)),
                                Button(type: .text, color: .success, icon: Icons.add_circle_outline, iconSize: 24, onPressed: () => _onContentAdd(index)),
                              ],
                            ),
                          ContentContainer(leafId: widget.file.id, contentIndex: index, content: _isTerm ? widget.file.termContents[index] : widget.file.definitionContents[index], editing: _editing, onContentDelete: () => _onContentDelete(index), onContentChanged: (Content content) => _onContentChange(content, index)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
