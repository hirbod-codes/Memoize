import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:video_player/video_player.dart';

import 'package:client/components/contents/players/web_video_player.dart';

/// Renders the video frame. On native platforms this is a media_kit
/// [Video] widget. On web it falls back to [VideoPlayer].
class VideoSurface extends ConsumerWidget {
  final VideoController? controller;
  final WebVideoPlayer? player;

  const VideoSurface({super.key, this.controller, this.player});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (kIsWeb) {
      return _WebSurface(player: player);
    }

    return _NativeSurface(controller: controller);
  }
}

// ---------------------------------------------------------------------------
// Native surface (media_kit)
// ---------------------------------------------------------------------------

class _NativeSurface extends ConsumerWidget {
  final VideoController? controller;

  const _NativeSurface({this.controller});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (controller == null) {
      return const _PlaceholderBox();
    }

    return Video(
      controller: controller!,
      fit: BoxFit.contain,
      // We own the controls — turn off the built-in overlay.
      controls: NoVideoControls,
    );
  }
}

// ---------------------------------------------------------------------------
// Web surface (video_player package)
// ---------------------------------------------------------------------------

class _WebSurface extends ConsumerWidget {
  final WebVideoPlayer? player;

  const _WebSurface({this.player});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (player == null) {
      return const _PlaceholderBox();
    }

    if (player is! WebVideoPlayer) return const _PlaceholderBox();

    final nativeController = player!.nativeController;
    if (nativeController == null) {
      return const _PlaceholderBox();
    }

    return AspectRatio(aspectRatio: nativeController.value.aspectRatio, child: VideoPlayer(nativeController));
  }
}

// ---------------------------------------------------------------------------
// Shown before the first open() call
// ---------------------------------------------------------------------------

class _PlaceholderBox extends StatelessWidget {
  const _PlaceholderBox();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Colors.black,
      child: Center(child: Icon(Icons.play_circle_outline, color: Colors.white54, size: 64)),
    );
  }
}
