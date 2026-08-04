import 'package:client/api/models/leaf.dart';
import 'package:client/api/providers/folders_and_files.dart';
import 'package:client/components/contents/choose_content_type_dialog.dart';
import 'package:client/components/global/notification_service.dart';
import 'package:client/components/dialogs/upload/audio_upload_dialog.dart';
import 'package:client/components/button.dart';
import 'package:client/components/content_container.dart';
import 'package:client/components/dialogs/upload/image_upload_dialog.dart';
import 'package:client/components/dialogs/upload/video_upload_dialog.dart';
import 'package:client/theme/theme_colors.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:client/theme/theme_spacing.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/material.dart';
import 'package:talker/talker.dart';

import 'header_delegate.dart';

class FileManager extends ConsumerStatefulWidget {
  final Leaf file;
  final Function? onClose;

  const FileManager({super.key, required this.file, this.onClose});

  @override
  ConsumerState<FileManager> createState() => _FileManager();
}

class _FileManager extends ConsumerState<FileManager> {
  bool _editing = false;
  int? _isAdding;

  int? _movingContentIndex;
  bool _isMovingContent = false;

  Future<void> _onContentAdd() async {
    FoldersAndFilesStateResponse? result;
    try {
      setState(() {
        _isAdding = -1;
      });

      ContentType? type = await showDialog<ContentType?>(context: context, builder: (_) => ChooseContentTypeDialog());
      if (type == null || !mounted) return;

      result = await ref.read(foldersAndFilesProvider.notifier).addContent(Content(type: type, value: []));
    } catch (e) {
      Talker().error('Failure while trying to add new content.', e);
      if (mounted) NotificationService.showError(context: context, message: 'Failure while trying to add new content.');
    } finally {
      if (mounted) {
        if (result?.status == FoldersAndFilesStateResponseStatus.failure) {
          NotificationService.showError(context: context, message: result?.message ?? 'Failure while trying to add new content.');
        }
        if (result?.status == FoldersAndFilesStateResponseStatus.success) {
          NotificationService.showSuccess(context: context, message: 'Successfully added new content.');
        }
        setState(() {
          _isAdding = null;
        });
      }
    }
  }

  Future<void> _onContentValueAdd({required int index}) async {
    FoldersAndFilesStateResponse? result;
    try {
      setState(() {
        _isAdding = index;
      });

      final p = ref.watch(foldersAndFilesProvider);
      final file = p.files![p.fileIndex];
      List<Content> contents;
      if (p.isTerm) {
        contents = file.termContents;
      } else {
        contents = file.definitionContents;
      }

      switch (contents[index].type) {
        case ContentType.string:
          result = await ref.read(foldersAndFilesProvider.notifier).addContentValue('', index);
          break;

        case ContentType.richText:
          result = await ref.read(foldersAndFilesProvider.notifier).addContentValue('', index);
          break;

        case ContentType.imageId:
          String? newId = await showDialog<String?>(context: context, builder: (_) => ImageUploadDialog());
          if (newId == null || !mounted) return;

          result = await ref.read(foldersAndFilesProvider.notifier).addContentValue(newId, index);
          break;
        case ContentType.videoId:
          String? newId = await showDialog<String?>(context: context, builder: (_) => VideoUploadDialog());
          if (newId == null || !mounted) return;

          result = await ref.read(foldersAndFilesProvider.notifier).addContentValue(newId, index);
        case ContentType.audioId:
          String? newId = await showDialog<String?>(context: context, builder: (_) => AudioUploadDialog());
          if (newId == null || !mounted) return;

          result = await ref.read(foldersAndFilesProvider.notifier).addContentValue(newId, index);
      }
    } catch (e) {
      Talker().error('Failure while trying to add new content.', e);
      if (mounted) NotificationService.showError(context: context, message: 'Failure while trying to add new content.');
    } finally {
      if (mounted) {
        if (result?.status == FoldersAndFilesStateResponseStatus.failure) {
          NotificationService.showError(context: context, message: result?.message ?? 'Failure while trying to add new content.');
        }
        if (result?.status == FoldersAndFilesStateResponseStatus.success) {
          NotificationService.showSuccess(context: context, message: 'Successfully added new content.');
        }
        setState(() {
          _isAdding = null;
        });
      }
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Are you sure?\nthis action is irreversible!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),

                  const SizedBox(height: 16),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Button(type: ButtonType.text, color: ThemeColorName.error, onPressed: () => Navigator.pop(context), label: 'No'),

                      const SizedBox(width: 8),

                      Button(
                        type: ButtonType.elevated,
                        color: ThemeColorName.success,
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
    try {
      FoldersAndFilesStateResponse result = await ref.read(foldersAndFilesProvider.notifier).removeContent(index);
      if (mounted) {
        if (result.status == FoldersAndFilesStateResponseStatus.failure) {
          NotificationService.showError(context: context, message: result.message ?? 'Failure while trying to remove content.');
        }
        if (result.status == FoldersAndFilesStateResponseStatus.success) {
          NotificationService.showSuccess(context: context, message: 'Successfully removed content.');
        }
        setState(() {
          _isAdding = null;
        });
      }
    } catch (e) {
      Talker().error('Failure while trying to remove content.', e);
      if (mounted) NotificationService.showError(context: context, message: 'Failure while trying to remove contents.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    final p = ref.watch(foldersAndFilesProvider);
    final file = p.files![p.fileIndex];
    final contents = p.isTerm ? file.termContents : file.definitionContents;

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth;
        final spacing = getSpacing(maxWidth);

        return Material(
          elevation: 4,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Padding(
            padding: EdgeInsetsGeometry.all(spacing.padding),
            child: CustomScrollView(
              slivers: [
                SliverPersistentHeader(
                  pinned: true,
                  delegate: HeaderDelegate(
                    height: _editing ? 200 : 150,
                    child: Container(
                      decoration: BoxDecoration(color: theme.surface),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.start,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Close button
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Button(
                                type: ButtonType.text,
                                color: ThemeColorName.onSurface,
                                icon: Icons.close,
                                onPressed: () {
                                  if (widget.onClose != null) widget.onClose!();
                                },
                              ),
                            ],
                          ),

                          SizedBox(height: spacing.listItemSpacing),

                          // Edit and flip button
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Button(
                                type: ButtonType.text,
                                color: ThemeColorName.primary,
                                icon: Icons.flip,
                                label: 'Flip',
                                onPressed: () {
                                  ref.read(foldersAndFilesProvider.notifier).flip();
                                },
                              ),
                              Button(
                                type: ButtonType.text,
                                color: ThemeColorName.primary,
                                icon: _editing ? Icons.remove_red_eye_outlined : Icons.edit_square,
                                onPressed: () {
                                  setState(() {
                                    _editing = !_editing;
                                  });
                                },
                              ),
                            ],
                          ),

                          SizedBox(height: spacing.listItemSpacing),

                          // Title
                          Text(widget.file.title, style: TextStyle(fontSize: 30)),

                          Divider(color: theme.outlineVariant, height: 1),

                          if (_editing) SizedBox(height: spacing.listItemSpacing),

                          if (_editing)
                            Button(
                              isLoading: _isAdding == -1,
                              type: ButtonType.outlined,
                              color: ThemeColorName.success,
                              onPressed: () {
                                _onContentAdd();
                              },
                              label: "Add Content",
                            ),
                        ],
                      ),
                    ),
                  ),
                ),

                SliverList(
                  delegate: SliverChildBuilderDelegate(childCount: contents.length, (context, contentIndex) {
                    Content content = p.isTerm ? file.termContents[contentIndex] : file.definitionContents[contentIndex];

                    IconData contentIcon;
                    switch (content.type) {
                      case ContentType.imageId:
                        contentIcon = Icons.image;
                        break;
                      case ContentType.audioId:
                        contentIcon = Icons.audio_file;
                        break;
                      case ContentType.videoId:
                        contentIcon = Icons.video_collection_rounded;
                        break;
                      case ContentType.richText:
                        contentIcon = Icons.text_fields;
                        break;
                      case ContentType.string:
                        contentIcon = Icons.text_format;
                        break;
                    }

                    return Column(
                      spacing: spacing.listItemSpacing,
                      mainAxisAlignment: MainAxisAlignment.start,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_movingContentIndex != null && _movingContentIndex != contentIndex && _movingContentIndex != contentIndex - 1)
                          Button(
                            type: ButtonType.elevated,
                            isLoading: _isMovingContent,
                            onPressed: () async {
                              setState(() {
                                _isMovingContent = true;
                              });

                              await ref.watch(foldersAndFilesProvider.notifier).moveContent(_movingContentIndex!, contentIndex);
                              if (!mounted) return;

                              setState(() {
                                _movingContentIndex = null;
                                _isMovingContent = false;
                              });
                            },
                          ),
                        Container(
                          margin: EdgeInsetsGeometry.fromSTEB(0, 0, 0, spacing.listItemSpacing),
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(
                            border: BoxBorder.all(color: theme.outlineVariant, width: 1),
                            borderRadius: BorderRadius.circular(AppRadius.md),
                          ),
                          child: Padding(
                            padding: EdgeInsets.all(spacing.padding),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.start,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              spacing: spacing.listItemSpacing,
                              children: [
                                Row(
                                  children: [
                                    IconButton(onPressed: () {}, icon: Icon(contentIcon)),
                                    if (_editing)
                                      Button(
                                        type: ButtonType.text,
                                        icon: Icons.drive_file_move_outlined,
                                        iconSize: 24,
                                        onPressed: _movingContentIndex != null
                                            ? null
                                            : () {
                                                setState(() {
                                                  _movingContentIndex = contentIndex;
                                                  _isMovingContent = false;
                                                });
                                              },
                                      ),
                                  ],
                                ),
                                if (_editing)
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Button(
                                        type: ButtonType.text,
                                        color: ThemeColorName.success,
                                        icon: Icons.add_circle_outline,
                                        iconSize: 24,
                                        isLoading: _isAdding == contentIndex,
                                        onPressed: () => _onContentValueAdd(index: contentIndex),
                                      ),
                                      Button(type: ButtonType.text, color: ThemeColorName.error, icon: Icons.highlight_remove, iconSize: 24, onPressed: () => _onContentDelete(contentIndex)),
                                    ],
                                  ),
                                ContentContainer(leafId: file.id, contentIndex: contentIndex, content: content, editing: _editing),
                              ],
                            ),
                          ),
                        ),
                        if (contentIndex == contents.length - 1 && _movingContentIndex != null && _movingContentIndex != contentIndex)
                          Button(
                            type: ButtonType.elevated,
                            isLoading: _isMovingContent,
                            onPressed: () async {
                              setState(() {
                                _isMovingContent = true;
                              });

                              await ref.watch(foldersAndFilesProvider.notifier).moveContent(_movingContentIndex!, contentIndex + 1);
                              if (!mounted) return;

                              setState(() {
                                _movingContentIndex = null;
                                _isMovingContent = false;
                              });
                            },
                          ),
                      ],
                    );
                  }),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
