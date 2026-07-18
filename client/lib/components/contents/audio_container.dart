import 'dart:async';

import 'package:client/api/audio_controller.dart';
import 'package:client/api/models/audio.dart';
import 'package:client/app_config.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/components/contents/players/audio/audio_player_provider.dart';
import 'package:client/components/contents/players/audio/audio_player_screen.dart';
import 'package:client/components/global/notification_service.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AudioContainer extends ConsumerStatefulWidget {
  final String audioId;

  const AudioContainer({super.key, required this.audioId});

  @override
  ConsumerState<AudioContainer> createState() => _AudioContainerState();
}

class _AudioContainerState extends ConsumerState<AudioContainer> {
  String? _token;
  Audio? _audio;
  String? _url;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    initiate();
  }

  Future<void> initiate() async {
    try {
      final audio = await ref.read(audioControllerProvider).get(audioId: widget.audioId);
      if (!mounted) return;

      final storage = ref.read(tokenStorageProvider);

      final token = await storage.getAccessToken();
      if (!mounted) return;

      String? signedToken;
      if (kIsWeb) {
        signedToken = await ref.read(audioControllerProvider).getSignedToken(audioId: widget.audioId);
        if (!mounted) return;
      }

      setState(() {
        if (token != null && token != '') {
          _token = token;
        }
        _audio = audio;
        _url = '${AppConfig.apiUrl}/api/audio/file/${_audio!.id}${signedToken == null ? '' : '/$signedToken'}';
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

    if (_audio == null) {
      return Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [Text('Audio not found.')]),
      );
    }
    if (_token == null) {
      return Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [Text('Unauthenticated.')]),
      );
    }

    return Container(
      height: 900,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(AppRadius.md), color: Theme.of(context).colorScheme.surfaceContainerHighest),
      clipBehavior: Clip.antiAlias,
      child: ProviderScope(
        overrides: [audioPlayerCommandsProvider],
        child: AudioPlayerScreen(audioId: _audio!.id, url: _url!, headers: {'Authorization': 'Bearer ${_token!}'}, accessToken: _token!, title: _audio!.title),
      ),
    );
  }
}
