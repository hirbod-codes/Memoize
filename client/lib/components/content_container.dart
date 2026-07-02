import 'dart:convert';

import 'package:client/api/models/leaf.dart';
import 'package:client/api/providers/folders_and_files.dart';
import 'package:client/components/contents/audio_container.dart';
import 'package:client/components/contents/image_container.dart';
import 'package:client/components/contents/text/text_editor.dart';
import 'package:client/components/contents/video_container.dart';
import 'package:client/components/global/notification_service.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

class ContentContainer extends ConsumerStatefulWidget {
  final bool editing;
  final Content content;
  final int contentIndex;
  final String leafId;

  const ContentContainer({super.key, required this.leafId, required this.content, required this.contentIndex, required this.editing});

  @override
  ConsumerState<ContentContainer> createState() => _ContentState();
}

class _ContentState extends ConsumerState<ContentContainer> {
  final List<int> _isRemoving = [];
  final List<int> _isUpdatingString = [];

  late List<TextEditingController> stringControllers = [];

  @override
  void initState() {
    super.initState();

    stringControllers = widget.content.value.map((v) => TextEditingController(text: v)).toList();
  }

  @override
  void dispose() {
    for (final controller in stringControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    Widget removeIcon(String value, int index) {
      return _isRemoving.contains(index)
          ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: theme.error))
          : IconButton(
              icon: Icon(Icons.remove),
              onPressed: () async {
                FoldersAndFilesStateResponse? result;
                try {
                  if (_isRemoving.contains(index)) return;

                  setState(() {
                    _isRemoving.add(index);
                  });

                  result = await ref.read(foldersAndFilesProvider.notifier).removeContentValue(widget.contentIndex, index);
                  if (!mounted) return;
                } catch (e) {
                  Talker().error('Failure while trying to remove content.', e);
                  if (mounted) NotificationService.showError(context: context, message: 'Failure while trying to remove content.');
                } finally {
                  if (mounted) {
                    if (result?.status == FoldersAndFilesStateResponseStatus.failure) {
                      NotificationService.showError(context: context, message: result?.message ?? 'Failure while trying to remove content.');
                    }
                    if (result?.status == FoldersAndFilesStateResponseStatus.success) {
                      NotificationService.showSuccess(context: context, message: 'Successfully removed content.');
                    }
                    setState(() {
                      _isRemoving.remove(index);
                    });
                  }
                }
              },
              color: theme.error,
              padding: EdgeInsetsGeometry.all(4),
              constraints: BoxConstraints(minWidth: 10, minHeight: 10),
              iconSize: 18,
              style: IconButton.styleFrom(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  side: BorderSide(color: theme.error),
                ),
              ),
            );
    }

    switch (widget.content.type) {
      case ContentType.richText:
        return Column(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: widget.content.value.asMap().entries.map((e) {
            final contentValueIndex = e.key;
            final v = e.value;

            return Stack(
              children: [
                SizedBox(
                  width: double.infinity,
                  child: Card(
                    child: TextEditor(
                      editing: widget.editing,
                      json: v,
                      onSave: (json) async {
                        FoldersAndFilesStateResponse result = await ref.read(foldersAndFilesProvider.notifier).setContentValue(jsonEncode(json), widget.contentIndex, contentValueIndex);
                        if (!mounted) return;

                        if (result.status == FoldersAndFilesStateResponseStatus.failure) {
                          if (mounted) NotificationService.showError(context: context, message: result.message ?? 'Failure while trying to remove content.');
                        }

                        if (result.status == FoldersAndFilesStateResponseStatus.success) {
                          if (mounted) NotificationService.showSuccess(context: context, message: 'Successfully removed content.');
                        }
                      },
                    ),
                  ),
                ),
                if (widget.editing) Positioned(top: 8, right: 8, child: removeIcon(v, contentValueIndex)),
              ],
            );
          }).toList(),
        );

      case ContentType.string:
        return Column(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 5,
          children: widget.content.value.asMap().entries.map((e) {
            final contentValueIndex = e.key;
            final v = e.value;

            if (widget.editing) {
              return Stack(
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: TextField(
                        controller: stringControllers[contentValueIndex],
                        decoration: InputDecoration(labelText: 'Title'),
                      ),
                    ),
                  ),

                  Positioned(
                    top: 8,
                    right: 8,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      spacing: 5,
                      children: [
                        if (_isUpdatingString.contains(contentValueIndex)) SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: theme.success)),
                        if (!_isUpdatingString.contains(contentValueIndex))
                          IconButton(
                            icon: Icon(Icons.done),
                            onPressed: () async {
                              FoldersAndFilesStateResponse? result;
                              try {
                                if (_isUpdatingString.contains(contentValueIndex)) return;

                                setState(() {
                                  _isUpdatingString.add(contentValueIndex);
                                });

                                result = await ref.read(foldersAndFilesProvider.notifier).setContentValue(stringControllers[contentValueIndex].text.trim(), widget.contentIndex, contentValueIndex);
                                if (!mounted) return;
                              } catch (e) {
                                Talker().error('onPressed function in done IconButton throws an error.', e);
                                if (mounted) NotificationService.showError(context: context, message: 'Failure while trying to update content.');
                              } finally {
                                if (mounted) {
                                  if (result?.status == FoldersAndFilesStateResponseStatus.failure) {
                                    NotificationService.showError(context: context, message: result?.message ?? 'Failure while trying to update content.');
                                  }
                                  if (result?.status == FoldersAndFilesStateResponseStatus.success) {
                                    NotificationService.showSuccess(context: context, message: 'Successfully update content.');
                                  }
                                  setState(() {
                                    _isUpdatingString.remove(contentValueIndex);
                                  });
                                }
                              }
                            },
                            color: theme.success,
                            padding: EdgeInsetsGeometry.all(4),
                            constraints: BoxConstraints(minWidth: 10, minHeight: 10),
                            iconSize: 18,
                            style: IconButton.styleFrom(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(AppRadius.sm),
                                side: BorderSide(color: theme.success),
                              ),
                            ),
                          ),
                        removeIcon(v, contentValueIndex),
                      ],
                    ),
                  ),
                ],
              );
            } else {
              return SizedBox(
                width: double.infinity,
                child: Card(
                  child: Padding(padding: const EdgeInsets.all(16), child: Text(v)),
                ),
              );
            }
          }).toList(),
        );

      case ContentType.imageId:
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.center,
            spacing: 10,
            children: widget.content.value.asMap().entries.map((e) {
              final contentValueIndex = e.key;
              final v = e.value;

              return SizedBox(
                width: 300,
                child: Stack(
                  children: [
                    ImageContainer(key: Key(v), imageId: v),
                    if (widget.editing) Positioned(top: 4, right: 4, child: removeIcon(v, contentValueIndex)),
                  ],
                ),
              );
            }).toList(),
          ),
        );

      case ContentType.videoId:
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 10,
            children: widget.content.value.asMap().entries.map((e) {
              final contentValueIndex = e.key;
              final v = e.value;

              return SizedBox(
                width: 300,
                child: Stack(
                  children: [
                    VideoContainer(key: Key(v), videoId: v),
                    if (widget.editing) Positioned(top: 4, right: 4, child: removeIcon(v, contentValueIndex)),
                  ],
                ),
              );
            }).toList(),
          ),
        );

      case ContentType.audioId:
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 10,
            children: widget.content.value.asMap().entries.map((e) {
              final contentValueIndex = e.key;
              final v = e.value;

              return SizedBox(
                width: 300,
                child: Stack(
                  children: [
                    AudioContainer(key: Key(v), audioId: v),
                    if (widget.editing) Positioned(top: 4, right: 4, child: removeIcon(v, contentValueIndex)),
                  ],
                ),
              );
            }).toList(),
          ),
        );
    }
  }
}
