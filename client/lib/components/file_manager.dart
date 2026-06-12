import 'package:client/api/models/leaf.dart';
import 'package:client/components/button.dart';
import 'package:client/components/content.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/material.dart';

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

  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Material(
        elevation: 8,
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
                          mainAxisAlignment: .end,
                          children: [
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
                  (context, index) => ContentContainer(content: widget.file.termContents[index], editing: _editing),
                  childCount: widget.file.termContents.length,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
