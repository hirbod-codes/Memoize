import 'dart:io';

import 'package:client/api/models/image.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ImageController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  ImageController(this.ref);

  Future<Response> post({required String title, required File file, String? fileName, ProgressCallback? onSendProgress}) async {
    return await _authDio.post(
      '/api/image/?title=$title&fileName=${fileName ?? file.path.split('/').last}',
      data: FormData.fromMap({'file': await MultipartFile.fromFile(file.path, filename: file.path.split('/').last)}),
      onSendProgress: onSendProgress,
    );
  }

  Future<ImageInfo?> get({required String imageId}) async {
    final response = await _authDio.get('/api/image/info?id=$imageId');
    if (response.data == null) return null;

    return ImageInfo.fromJson(response.data);
  }
}

final imageControllerProvider = Provider((ref) => ImageController(ref));
