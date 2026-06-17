import 'dart:async';

import 'package:client/api/models/video.dart';
import 'package:client/api/video_controller.dart';
import 'package:client/app_config.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/components/contents/players/video_player_provider.dart' hide videoControllerProvider;
import 'package:client/components/contents/players/video_player_screen.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class VideoContainer extends ConsumerStatefulWidget {
  final String videoId;

  const VideoContainer({super.key, required this.videoId});

  @override
  ConsumerState<VideoContainer> createState() => _VideosState();
}

class _VideosState extends ConsumerState<VideoContainer> {
  String? _token;
  Video? _video;
  bool _loading = true;

  @override
  void initState() {
    ref
        .read(videoControllerProvider)
        .get(videoId: widget.videoId)
        .then((v) {
          if (!mounted) return;

          final storage = ref.read(tokenStorageProvider);

          storage
              .getAccessToken()
              .then((t) {
                if (!mounted) return;

                setState(() {
                  if (t != null && t != '') {
                    _token = t;
                  }
                  _video = v;
                  _loading = false;
                });
              })
              .catchError(_handleError);
        })
        .catchError(_handleError);

    super.initState();
  }

  FutureOr<Null> _handleError(dynamic e) {
    if (!mounted) return null;

    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Failed to fetch Video data.', style: .new(color: theme.onError)),
        backgroundColor: theme.error,
        duration: const Duration(seconds: 3),
      ),
    );

    setState(() {
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    if (_loading) {
      return Row(
        mainAxisAlignment: .center,
        children: [SizedBox(width: 48, height: 48, child: CircularProgressIndicator(strokeWidth: 2, color: theme.primary))],
      );
    }

    if (_video == null) return Column(mainAxisAlignment: .center, crossAxisAlignment: .center, children: [Text('Video not found.')]);
    if (_token == null) return Column(mainAxisAlignment: .center, crossAxisAlignment: .center, children: [Text('Unauthenticated.')]);

    return ProviderScope(
      overrides: [videoPlayerCommandsProvider],
      child: VideoPlayerScreen(videoId: _video!.id, url: '${AppConfig.apiUrl}/api/Video/file/${_video!.id}/index.m3u8', headers: {'Authorization': 'Bearer ${_token!}'}, accessToken: _token!, title: _video!.title),
    );
  }
}
