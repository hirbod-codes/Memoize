import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:video_player/video_player.dart';

import 'package:client/components/contents/players/web_video_player.dart';
import 'package:client/components/contents/players/video_player_provider.dart';

/// Renders the video frame. On native platforms this is a media_kit
/// [Video] widget. On web it falls back to [VideoPlayer].
class VideoSurface extends ConsumerWidget {
  const VideoSurface({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (kIsWeb) {
      return _WebSurface();
    }
    return _NativeSurface();
  }
}

// ---------------------------------------------------------------------------
// Native surface (media_kit)
// ---------------------------------------------------------------------------

class _NativeSurface extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(videoControllerProvider);
    if (controller == null) {
      return const _PlaceholderBox();
    }
    return Video(
      controller: controller,
      // We own the controls — turn off the built-in overlay.
      controls: NoVideoControls,
    );
  }
}

// ---------------------------------------------------------------------------
// Web surface (video_player package)
// ---------------------------------------------------------------------------

class _WebSurface extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final player = ref.watch(videoPlayerProvider);
    if (player is! WebVideoPlayer) return const _PlaceholderBox();

    final nativeController = player.nativeController;
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
