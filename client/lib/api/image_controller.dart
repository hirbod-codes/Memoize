import 'package:client/api/models/image.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ImageController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  ImageController(this.ref);

  Future<ImageInfo?> get({required String imageId}) async {
    final response = await _authDio.get('/api/image/info?id=$imageId');
    if (response.data == null) return null;

    return ImageInfo.fromJson(response.data);
  }
}

final imageControllerProvider = Provider((ref) => ImageController(ref));
