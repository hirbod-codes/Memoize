import 'dart:async';

import 'package:client/api/audio_controller.dart';
import 'package:client/api/models/audio.dart';
import 'package:client/app_config.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/components/contents/players/audio/audio_player_provider.dart';
import 'package:client/components/contents/players/audio/audio_player_screen.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AudioContainer extends ConsumerStatefulWidget {
  final String audioId;

  const AudioContainer({super.key, required this.audioId});

  @override
  ConsumerState<AudioContainer> createState() => _AudiosState();
}

class _AudiosState extends ConsumerState<AudioContainer> {
  String? _token;
  Audio? _audio;
  bool _loading = true;

  @override
  void initState() {
    ref
        .read(audioControllerProvider)
        .get(audioId: widget.audioId)
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
                  _audio = v;
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
        content: Text('Failed to fetch audio data.', style: .new(color: theme.onError)),
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

    if (_audio == null) return Column(mainAxisAlignment: .center, crossAxisAlignment: .center, children: [Text('Audio not found.')]);
    if (_token == null) return Column(mainAxisAlignment: .center, crossAxisAlignment: .center, children: [Text('Unauthenticated.')]);

    return ProviderScope(
      overrides: [audioPlayerCommandsProvider],
      child: AudioPlayerScreen(audioId: _audio!.id, url: '${AppConfig.apiUrl}/api/audio/file/${_audio!.id}', headers: {'Authorization': 'Bearer ${_token!}'}, accessToken: _token!, title: _audio!.title, artist: _audio!.metadata?.artists?[0]),
    );
  }
}
