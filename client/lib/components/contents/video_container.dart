import 'dart:async';

import 'package:client/api/models/video.dart';
import 'package:client/api/controllers/video_controller.dart';
import 'package:client/app_config.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/components/contents/players/video_player_screen.dart';
import 'package:client/components/global/notification_service.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:flutter/foundation.dart';
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
  String? _url;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    initiate();
  }

  Future<void> initiate() async {
    try {
      Video? video = await ref.read(videoControllerProvider).get(videoId: widget.videoId);
      if (!mounted) return;

      final storage = ref.read(tokenStorageProvider);

      String? accessToken = await storage.getAccessToken();
      if (!mounted) return;

      String? signedToken;
      if (kIsWeb) {
        signedToken = await ref.read(videoControllerProvider).getSignedToken(videoId: widget.videoId);
        if (!mounted) return;
      }

      setState(() {
        if (accessToken != null && accessToken != '') {
          _token = accessToken;
        }
        _video = video;
        _url = '${AppConfig.apiUrl}/api/video/file${signedToken == null ? '' : '/$signedToken'}/${_video!.id}/index.m3u8';
        _loading = false;
      });
    } catch (e) {
      _handleError(e);
    }
  }

  FutureOr<Null> _handleError(dynamic e) {
    if (!mounted) return null;

    NotificationService.showError(context: context, message: 'Failed to fetch audio data.');

    setState(() {
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    if (_loading) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [SizedBox(width: 48, height: 48, child: CircularProgressIndicator(strokeWidth: 2, color: theme.primary))],
      );
    }

    if (_video == null || _url == null) return Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [Text('Video not found.')]);
    if (_token == null) return Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [Text('Unauthenticated.')]);

    return Container(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(AppRadius.md), color: Theme.of(context).colorScheme.surfaceContainerHighest),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(8.0),
        // child: VideoPlayerScreen(videoId: _video!.id, url: _url!, headers: {'Authorization': 'Bearer ${_token!}'}, accessToken: _token!, title: _video!.title),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.center,
          spacing: 5,
          children: [
            if (_video != null) Text(_video!.title),
            SizedBox(
              height: 450,
              child: AspectRatio(
                aspectRatio: 9 / 16,
                child: VideoPlayerScreen(videoId: _video!.id, url: _url!, headers: {'Authorization': 'Bearer ${_token!}'}, accessToken: _token!, title: _video!.title),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
