import 'dart:async';

import 'package:client/api/image_controller.dart';
import 'package:client/api/models/image.dart';
import 'package:client/app_config.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:flutter/cupertino.dart' hide ImageInfo;
import 'package:flutter/material.dart' hide ImageInfo;
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ImageContainer extends ConsumerStatefulWidget {
  final String imageId;

  const ImageContainer({super.key, required this.imageId});

  @override
  ConsumerState<ImageContainer> createState() => _ImagesState();
}

class _ImagesState extends ConsumerState<ImageContainer> {
  String? _token;
  dynamic? _image;
  bool _loading = true;

  @override
  void initState() {
    ref
        .read(imageControllerProvider)
        .get(imageId: widget.imageId)
        .then((v) {
          print('vvvvvvvvvvvvvvvvvv: $v');
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
                  _image = v as dynamic;
                  _loading = false;
                });
              })
              .catchError(_handleError);
        })
        .catchError(_handleError);

    super.initState();
  }

  FutureOr<Null> _handleError(dynamic e) {
    print(e);
    if (!mounted) return null;

    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Failed to fetch Image data.', style: .new(color: theme.onError)),
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

    if (_image == null) return Column(mainAxisAlignment: .center, crossAxisAlignment: .center, children: [Text('Image not found.')]);
    if (_token == null) return Column(mainAxisAlignment: .center, crossAxisAlignment: .center, children: [Text('Unauthenticated.')]);

    return Container(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(AppRadius.md), color: Theme.of(context).colorScheme.surfaceContainerHighest),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: .all(8.0),
        child: Column(
          mainAxisAlignment: .start,
          crossAxisAlignment: .stretch,
          children: [
            _image == null || _token == null
                ? Container(
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(AppRadius.md)),
                    child: Icon(Icons.image_rounded, size: 200, color: Theme.of(context).colorScheme.onSurfaceVariant),
                  )
                : Container(
                    clipBehavior: .antiAlias,
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(AppRadius.md)),
                    child: Image.network('${AppConfig.apiUrl}/api/image/file/${widget.imageId}', fit: .fitWidth, headers: {'Authorization': 'Bearer $_token'}),
                  ),
            if (_image?.title != null) Center(child: Text(_image?.title ?? '')),
            if (_image == null || _token == null) Center(child: Text('No Image')),
          ],
        ),
      ),
    );
  }
}
