import 'dart:convert';
import 'dart:io';

import 'package:client/api/models/image.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';
import 'package:path/path.dart' as p;

class ImageController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  ImageController(this.ref);

  Future<Response> post({required String title, required File file, String? fileName, ProgressCallback? onSendProgress}) async {
    Talker().info('ImageController.post is called...');

    final response = await _authDio.post('/api/image/?title=$title&fileName=${fileName ?? p.basename(file.path)}', data: await file.readAsBytes(), onSendProgress: onSendProgress);
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    Talker().info('ImageController.post call ended');
    return response;
  }

  Future<ImageInfo?> get({required String imageId}) async {
    Talker().info('ImageController.get is called...');

    final response = await _authDio.get('/api/image/info?id=$imageId');
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');
    if (response.data == null) {
      Talker().info('Null response data!');
      Talker().info('ImageController.get call ended');
      return null;
    }

    Talker().info('ImageController.get call ended');
    return ImageInfo.fromJson(response.data);
  }
}

final imageControllerProvider = Provider((ref) => ImageController(ref));
