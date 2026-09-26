import 'dart:async';

import 'package:client/api/controllers/image_controller.dart';
import 'package:client/api/models/image.dart' show ImageInfo;
import 'package:client/app_config.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/components/global/notification_service.dart';
import 'package:client/l10n/app_localizations.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:flutter/material.dart' hide ImageInfo;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

class ImageContainer extends ConsumerStatefulWidget {
  final String imageId;

  const ImageContainer({super.key, required this.imageId});

  @override
  ConsumerState<ImageContainer> createState() => _ImagesState();
}

class _ImagesState extends ConsumerState<ImageContainer> {
  String? _token;
  ImageInfo? _image;
  bool _loading = true;

  @override
  void initState() {
    super.initState();

    ref
        .read(imageControllerProvider)
        .get(imageId: widget.imageId)
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
                  _image = v as ImageInfo;
                  _loading = false;
                });
              })
              .catchError(_handleError);
        })
        .catchError(_handleError);
  }

  FutureOr<Null> _handleError(dynamic e, dynamic st) {
    Talker().error('caught error while trying to fetch audio', e);
    if (!mounted) return null;

    AppLocalizations l10n = AppLocalizations.of(context)!;

    NotificationService.showError(context: context, message: l10n.image_fetch_failed);

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

    AppLocalizations l10n = AppLocalizations.of(context)!;

    if (_image == null) {
      return Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [Text(l10n.image_not_found)]);
    }
    if (_token == null) {
      return Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [Text(l10n.unauthenticated)]);
    }

    return Container(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(AppRadius.md), color: Theme.of(context).colorScheme.surfaceContainerHighest),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(AppRadius.md)),
              child: Image.network('${AppConfig.apiUrl}/api/image/file/${widget.imageId}', fit: BoxFit.contain, headers: {'Authorization': 'Bearer $_token'}),
            ),
            if (_image?.title != null) Center(child: Text(_image?.title ?? '')),
          ],
        ),
      ),
    );
  }
}
