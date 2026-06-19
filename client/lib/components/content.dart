import 'package:client/api/models/leaf.dart';
import 'package:client/components/contents/audio_container.dart';
import 'package:client/components/contents/image_container.dart';
import 'package:client/components/contents/text/text_editor.dart';
import 'package:client/components/contents/video_container.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ContentContainer extends ConsumerStatefulWidget {
  final bool editing;
  final Content content;
  final num contentIndex;
  final String leafId;
  final void Function(Content value)? onContentChanged;
  final void Function()? onContentDelete;

  const ContentContainer({super.key, required this.leafId, required this.content, required this.contentIndex, required this.editing, this.onContentChanged, this.onContentDelete});

  @override
  ConsumerState<ContentContainer> createState() => _ContentState();
}

class _ContentState extends ConsumerState<ContentContainer> {
  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    switch (widget.content.type) {
      case .richText:
        return Column(
          mainAxisAlignment: .start,
          crossAxisAlignment: .center,
          children: widget.content.value.map((v) {
            return Stack(
              children: [
                SizedBox(
                  width: .infinity,
                  child: Card(
                    child: TextEditor(editing: widget.editing, json: v),
                  ),
                ),
                if (widget.editing)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: IconButton(
                      icon: Icon(Icons.remove),
                      onPressed: () {
                            final updatedContent = widget.content.copyWith(value: widget.content.value.where((w) => w != v).toList());
                            if (updatedContent.value.isEmpty) {
                              widget.onContentDelete?.call();
                            } else {
                              widget.onContentChanged?.call(updatedContent);
                            }
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
                    ),
                  ),
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
                if (widget.editing)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: IconButton(
                      icon: Icon(Icons.remove),
                      onPressed: () {
                            final updatedContent = widget.content.copyWith(value: widget.content.value.where((w) => w != v).toList());
                            if (updatedContent.value.isEmpty) {
                              widget.onContentDelete?.call();
                            } else {
                              widget.onContentChanged?.call(updatedContent);
                            }
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
                    ),
                  ),
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
                    if (widget.editing)
                      Positioned(
                        top: 4,
                        right: 4,
                        child: IconButton(
                          icon: Icon(Icons.remove),
                          onPressed: () {
                            final updatedContent = widget.content.copyWith(value: widget.content.value.where((w) => w != v).toList());
                            if (updatedContent.value.isEmpty) {
                              widget.onContentDelete?.call();
                            } else {
                              widget.onContentChanged?.call(updatedContent);
                            }
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
                        ),
                      ),
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
                    if (widget.editing)
                      Positioned(
                        top: 4,
                        right: 4,
                        child: IconButton(
                          icon: Icon(Icons.remove),
                          onPressed: () {
                            final updatedContent = widget.content.copyWith(value: widget.content.value.where((w) => w != v).toList());
                            if (updatedContent.value.isEmpty) {
                              widget.onContentDelete?.call();
                            } else {
                              widget.onContentChanged?.call(updatedContent);
                            }
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
                        ),
                      ),
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
                    if (widget.editing)
                      Positioned(
                        top: 4,
                        right: 4,
                        child: IconButton(
                          icon: Icon(Icons.remove),
                          onPressed: () {
                            final updatedContent = widget.content.copyWith(value: widget.content.value.where((w) => w != v).toList());
                            if (updatedContent.value.isEmpty) {
                              widget.onContentDelete?.call();
                            } else {
                              widget.onContentChanged?.call(updatedContent);
                            }
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
                        ),
                      ),
                  ],
                ),
              );
            }).toList(),
          ),
        );
    }
  }
}
