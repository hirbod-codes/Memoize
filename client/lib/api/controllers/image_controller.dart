import 'dart:convert';

import 'package:client/api/api_call.dart';
import 'package:client/api/models/image.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:client/lib/talker.dart';

class ImageController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  ImageController(this.ref);

  Future<Response> post({required String title, required XFile file, ProgressCallback? onSendProgress}) async {
    talker.info('ImageController.post is called...');

    final length = await file.length();

    final response = await _authDio.post(
      '/api/image/?title=$title&fileName=${file.name}',
      data: file.openRead(),
      options: Options(headers: {Headers.contentLengthHeader: length}),
      onSendProgress: onSendProgress,
    );

    talker.info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    return response;
  }

  Future<ImageInfo?> get({required String imageId}) async {
    talker.info('ImageController.get is called...');

    final response = await apiCall(() => _authDio.get('/api/image/info?imageId=$imageId'));
    talker.debug({'response.dataOrNull': response.dataOrNull});

    if (response.isFailure || response.dataOrNull == null) {
      talker.info('Null response data!');
      talker.info('ImageController.get call ended');
      return null;
    }

    return ImageInfo.fromJson(response.dataOrNull);
  }
}

final imageControllerProvider = Provider((ref) => ImageController(ref));
