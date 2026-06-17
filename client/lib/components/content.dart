import 'package:client/api/models/leaf.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/components/button.dart';
import 'package:client/components/contents/audio_container.dart';
import 'package:client/components/contents/image_container.dart';
import 'package:client/components/contents/text/text_editor.dart';
import 'package:client/components/contents/video_container.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ContentContainer extends ConsumerStatefulWidget {
  final bool editing;
  final Content content;

  const ContentContainer({super.key, required this.content, required this.editing});

  @override
  ConsumerState<ContentContainer> createState() => _ContentState();
}

class _ContentState extends ConsumerState<ContentContainer> {
  bool _loading = true;
  String? _token;

  @override
  void initState() {
    super.initState();

    final storage = ref.read(tokenStorageProvider);

    final future = storage.getAccessToken();
    future.then((v) {
      if (!mounted) return;

      setState(() {
        _loading = false;
      });
      if (v != null && v != '') {
        setState(() {
          _token = v;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Row(
        mainAxisAlignment: .center,
        children: [SizedBox(width: 48, height: 48, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.red))],
      );
    }

    switch (widget.content.type) {
      case .richText:
        if (_loading) {
          setState(() {
            _loading = false;
          });
        }
        return Column(
          mainAxisAlignment: .start,
          crossAxisAlignment: .center,
          children: widget.content.value.map((v) {
            return Card(
              child: TextEditor(editing: widget.editing, json: v),
            );
          }).toList(),
        );

      case .string:
        if (_loading) {
          setState(() {
            _loading = false;
          });
        }
        return Column(
          mainAxisAlignment: .start,
          crossAxisAlignment: .stretch,
          spacing: 5,
          children: widget.content.value.map((v) {
            return Card(
              child: Padding(padding: const EdgeInsets.all(8.0), child: Text(v)),
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
                // height: 700,
                child: ImageContainer(imageId: v),
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
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: .circular(AppRadius.md),
                    border: .all(color: Colors.red, width: 1),
                  ),
                  child: VideoContainer(videoId: v),
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
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: .circular(AppRadius.md),
                    border: .all(color: Colors.red, width: 1),
                  ),
                  child: AudioContainer(audioId: v),
                ),
              );
            }).toList(),
          ),
        );
    }
  }
}
