import 'dart:async';
import 'package:client/components/contents/players/player_interface.dart';
import 'package:client/components/contents/players/video_player_provider.dart';
import 'package:video_player/video_player.dart';

/// Web-only backend. Uses the Flutter `video_player` package which
/// delegates to the browser's native <video> element.
///
/// HLS works natively in Safari. For Chrome/Firefox you should either:
///   a) serve a progressive MP4/WebM fallback, or
///   b) inject hls.js via an HtmlElementView (more complex).
class WebVideoPlayer implements AppVideoPlayer {
  VideoPlayerController? _controller;

  final _stateController = StreamController<PlayerState>.broadcast();
  PlayerState _state = const PlayerState();
  Timer? _positionTimer;
  bool _playing = false;

  // Expose the raw controller so VideoPlayer widget can attach.
  VideoPlayerController? get nativeController => _controller;

  @override
  Stream<PlayerState> get stateStream => _stateController.stream;

  @override
  PlayerState get state => _state;

  void _emit(PlayerState next) {
    _state = next;
    _stateController.add(next);
  }

  @override
  Future<void> open(String url, {Map<String, String>? headers}) async {
    await _controller?.dispose();
    _positionTimer?.cancel();

    _emit(_state.copyWith(status: PlayerStatus.loading, position: Duration.zero, duration: Duration.zero, error: null));

    _controller = VideoPlayerController.networkUrl(Uri.parse(url), httpHeaders: headers ?? {});

    _controller!.addListener(_onControllerUpdate);

    await _controller!.initialize();

    _emit(_state.copyWith(status: PlayerStatus.paused, duration: _controller!.value.duration));

    // video_player doesn't emit position via stream — poll at 250ms.
    _positionTimer = Timer.periodic(const Duration(milliseconds: 250), (_) => _onControllerUpdate());

    await _controller!.play();

    _playing = true;
  }

  void _onControllerUpdate() {
    final v = _controller?.value;
    if (v == null) return;

    PlayerStatus status;
    if (v.hasError) {
      status = PlayerStatus.error;
    } else if (v.isCompleted) {
      status = PlayerStatus.ended;
    } else if (v.isBuffering) {
      status = PlayerStatus.buffering;
    } else if (v.isPlaying) {
      status = PlayerStatus.playing;
    } else {
      status = PlayerStatus.paused;
    }

    final buffered = v.buffered.isNotEmpty ? v.buffered.last.end : Duration.zero;

    _emit(_state.copyWith(status: status, position: v.position, duration: v.duration, buffered: buffered, volume: v.volume, error: v.hasError ? v.errorDescription : null));
  }

  @override
  Future<void> play() async => _controller?.play();

  @override
  Future<void> pause() async => _controller?.pause();

  @override
  Future<void> seek(Duration position) async => _controller?.seekTo(position);

  @override
  Future<void> setVolume(double volume) async => _controller?.setVolume(volume.clamp(0.0, 1.0));

  @override
  Future<void> dispose() async {
    _positionTimer?.cancel();
    _controller?.removeListener(_onControllerUpdate);
    await _controller?.dispose();
    await _stateController.close();
  }

  @override
  Future<void> togglePlayPause() async {
    if (_playing) {
      await _controller?.pause();
      _playing = false;
    } else {
      await _controller?.play();
      _playing = true;
    }
  }
}
