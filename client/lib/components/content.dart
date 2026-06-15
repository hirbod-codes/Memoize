import 'package:client/api/models/leaf.dart';
import 'package:client/app_config.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/components/contents/players/audio/audio_player_screen.dart';
import 'package:client/components/contents/players/video_player_screen.dart';
import 'package:client/components/contents/text/text_editor.dart';
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
        return Row(children: [Text('string '), Text(widget.content.value.join(', '))]);

      case .imageId:
        if (_loading) {
          setState(() {
            _loading = false;
          });
        }
        return Row(children: [Text('imageId '), Text(widget.content.value.join(', '))]);

      // case .audioId:
      //   return Row(children: [Text('audioId '), Text(widget.content.value.join(', '))]);

      case .videoId:
        return Row(
          children: [
            SizedBox(
              height: 450,
              width: 300,
              child: Container(
                decoration: BoxDecoration(borderRadius: .circular(AppRadius.md)),
                child: VideoPlayerScreen(url: '${AppConfig.apiUrl}/api/audio/file/6a2d541bb6a6b7029ff279e6', headers: {'Authorization': 'Bearer $_token!'}),
                // child: VideoPlayerScreen(url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
              ),
            ),
          ],
        );

      case .audioId:
        return Row(
          children: [
            SizedBox(
              height: 2000,
              width: 600,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: .circular(AppRadius.md),
                  border: .all(color: Colors.red, width: 1),
                ),
                child: AudioPlayerScreen(url: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Beethoven_Moonlight_Sonata_Op._27_No._2.mp3', title: 'saghi'),
                // child: AudioPlayerScreen(url: '${AppConfig.apiUrl}/api/audio/file/6a2d541bb6a6b7029ff279e6', headers: {'Authorization': 'Bearer $_token!'}, title: 'saghi',),
              ),
            ),
          ],
        );
    }
  }
}
