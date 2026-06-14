import 'package:client/components/contents/players/player_controls.dart';
import 'package:client/components/contents/players/player_interface.dart';
import 'package:client/components/contents/players/video_player_provider.dart';
import 'package:client/components/contents/players/video_surface.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class VideoPlayerScreen extends ConsumerStatefulWidget {
  const VideoPlayerScreen({super.key, required this.url, this.headers, this.title});

  final String url;
  final Map<String, String>? headers;
  final String? title;

  @override
  ConsumerState<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends ConsumerState<VideoPlayerScreen> {
  bool _controlsVisible = true;
  DateTime _lastInteraction = DateTime.now();

  static const _controlsTimeout = Duration(seconds: 7);

  @override
  void initState() {
    super.initState();
    // Hide system UI for a cinematic look
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    // Start loading the video
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(videoPlayerProvider).open(widget.url, headers: widget.headers);
      // ref.read(videoPlayerNotifierProvider.notifier).open(widget.url, headers: widget.headers);
    });
    // Start the auto-hide timer
    _scheduleHide();
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  void _scheduleHide() {
    Future.delayed(_controlsTimeout, () {
      if (!mounted) return;
      final elapsed = DateTime.now().difference(_lastInteraction);
      if (elapsed >= _controlsTimeout && _controlsVisible) {
        setState(() => _controlsVisible = false);
      } else {
        _scheduleHide();
      }
    });
  }

  void _onTap() {
    setState(() {
      _controlsVisible = !_controlsVisible;
      _lastInteraction = DateTime.now();
    });
    if (_controlsVisible) _scheduleHide();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _onTap,
      behavior: HitTestBehavior.opaque,
      child: Stack(
        children: [
          // ── Video frame fills the whole screen ──────────────────────────
          const Positioned.fill(child: VideoSurface()),

          // ── Top bar: back button + title ────────────────────────────────
          AnimatedPositioned(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOut,
            top: _controlsVisible ? 0 : -80,
            left: 0,
            right: 0,
            child: _TopBar(title: widget.title),
          ),

          // ── Bottom controls ─────────────────────────────────────────────
          AnimatedPositioned(duration: const Duration(milliseconds: 250), curve: Curves.easeInOut, bottom: _controlsVisible ? 0 : -120, left: 0, right: 0, child: const PlayerControls()),

          // ── Center spinner while loading ─────────────────────────────────
          const _CenterLoadingOverlay(),
        ],
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({this.title});
  final String? title;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.black87, Colors.transparent]),
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
            if (title != null)
              Expanded(
                child: Text(
                  title!,
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CenterLoadingOverlay extends ConsumerWidget {
  const _CenterLoadingOverlay();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stateAsync = ref.watch(playerStateProvider);
    final isLoading = stateAsync.maybeWhen(data: (s) => s.status == PlayerStatus.loading, orElse: () => true);

    if (!isLoading) return const SizedBox.shrink();

    return const Center(child: CircularProgressIndicator(color: Colors.white70));
  }
}
