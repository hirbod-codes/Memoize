import 'package:client/api/models/leaf.dart';
import 'package:client/app_config.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/components/contents/players/video_player_screen.dart';
import 'package:client/components/contents/text/text_editor.dart';
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

      if (v != null && v != '') {
        setState(() {
          _token = v;
          _loading = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
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
        return Text('!!!');

      case .imageId:
        if (_loading) {
          setState(() {
            _loading = false;
          });
        }
        return Text('!!!');

      case .audioId:
        if (_loading) {
          return Row(
            mainAxisAlignment: .center,
            children: [SizedBox(width: 48, height: 48, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.red))],
          );
        } else {
          return SizedBox(
            height: 600,
            width: 300,
            child: Container(
              decoration: BoxDecoration(border: .all(color: Colors.red, width: 1)),
              child: VideoPlayerScreen(url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
            ),
          );
        }
      // child: VideoPlayerScreen(url: '${AppConfig.apiUrl}/api/audio/file/6a2d541bb6a6b7029ff279e6', headers: {'Authorization': 'Bearer $_token!'}),

      case .videoId:
        return Text('!!!');
    }
  }
}
