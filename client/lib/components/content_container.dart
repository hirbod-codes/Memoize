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
  /// To Do:
  /// Add handlers for failures.
  /// Update backend
  final List<int> _isRemoving = [];

  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    Widget removeIcon(String value) {
      return _isRemoving.contains(widget.content.value.indexOf(value))
          ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: theme.primary))
          : IconButton(
              icon: Icon(Icons.remove),
              onPressed: () async {
                int index = widget.content.value.indexOf(value);
                if (_isRemoving.contains(index)) return;

                setState(() {
                  _isRemoving.add(index);
                });

                FoldersAndFilesStateResponse result = await ref.read(foldersAndFilesProvider.notifier).removeContentValue(widget.contentIndex, index);
                if (!mounted) return;

                if (result.status == .failure) {
                  if (mounted) NotificationService.showError(context: context, message: result.message ?? 'Failure while trying to remove content.');
                }

                if (result.status == .success) {
                  if (mounted) NotificationService.showSuccess(context: context, message: 'Successfully removed content.');
                }

                setState(() {
                  _isRemoving.remove(index);
                });
              },
              color: theme.error,
              padding: .all(4),
              constraints: .new(minWidth: 10, minHeight: 10),
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
      case .richText:
        return Column(
          mainAxisAlignment: .start,
          crossAxisAlignment: .center,
          children: widget.content.value.asMap().entries.map((e) {
            final contentValueIndex = e.key;
            final v = e.value;

            return Stack(
              children: [
                SizedBox(
                  width: .infinity,
                  child: Card(
                    child: TextEditor(
                      editing: widget.editing,
                      json: v,
                      onSave: (json) async {
                        FoldersAndFilesStateResponse result = await ref.read(foldersAndFilesProvider.notifier).setContentValue(jsonEncode(json), widget.contentIndex, contentValueIndex);
                        if (!mounted) return;

                        if (result.status == .failure) {
                          if (mounted) NotificationService.showError(context: context, message: result.message ?? 'Failure while trying to remove content.');
                        }

                        if (result.status == .success) {
                          if (mounted) NotificationService.showSuccess(context: context, message: 'Successfully removed content.');
                        }
                      },
                    ),
                  ),
                ),
                if (widget.editing) Positioned(top: 8, right: 8, child: removeIcon(v)),
              ],
            );
          }).toList(),
        );

      case .string:
        return Column(
          mainAxisAlignment: .start,
          crossAxisAlignment: .stretch,
          spacing: 5,
          children: widget.content.value.map((v) {
            return Stack(
              children: [
                SizedBox(
                  width: .infinity,
                  child: Card(
                    child: Padding(padding: const EdgeInsets.all(16), child: Text(v)),
                  ),
                ),
                if (widget.editing) Positioned(top: 8, right: 8, child: removeIcon(v)),
              ],
            );
          }).toList(),
        );

      case .imageId:
        return SingleChildScrollView(
          scrollDirection: .horizontal,
          child: Row(
            mainAxisAlignment: .start,
            crossAxisAlignment: .center,
            spacing: 10,
            children: widget.content.value.map((v) {
              return SizedBox(
                width: 300,
                child: Stack(
                  children: [
                    ImageContainer(imageId: v),
                    if (widget.editing) Positioned(top: 4, right: 4, child: removeIcon(v)),
                  ],
                ),
              );
            }).toList(),
          ),
        );

      case .videoId:
        return SingleChildScrollView(
          scrollDirection: .horizontal,
          child: Row(
            mainAxisAlignment: .start,
            crossAxisAlignment: .start,
            spacing: 10,
            children: widget.content.value.map((v) {
              return SizedBox(
                width: 300,
                child: Stack(
                  children: [
                    VideoContainer(videoId: v),
                    if (widget.editing) Positioned(top: 4, right: 4, child: removeIcon(v)),
                  ],
                ),
              );
            }).toList(),
          ),
        );

      case .audioId:
        return SingleChildScrollView(
          scrollDirection: .horizontal,
          child: Row(
            mainAxisAlignment: .start,
            crossAxisAlignment: .start,
            spacing: 10,
            children: widget.content.value.map((v) {
              return SizedBox(
                width: 300,
                child: Stack(
                  children: [
                    AudioContainer(audioId: v),
                    if (widget.editing) Positioned(top: 4, right: 4, child: removeIcon(v)),
                  ],
                ),
              );
            }).toList(),
          ),
        );
    }
  }
}
