import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:client/api/models/video.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';
import 'package:path/path.dart' as p;

class VideoController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  VideoController(this.ref);

  Future<Response> postForWeb({required String title, required Uint8List bytes, required String fileName, ProgressCallback? onSendProgress}) async {
    Talker().info('AudioController.post is called...');

    final response = await _authDio.post(
      '/api/video/?title=$title&fileName=$fileName',
      data: Stream.fromIterable([bytes]),
      options: Options(headers: {Headers.contentLengthHeader: bytes.length}),
      onSendProgress: onSendProgress,
    );
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    Talker().info('AudioController.post call ended');
    return response;
  }

  Future<Response> post({required String title, required File file, String? fileName, ProgressCallback? onSendProgress}) async {
    Talker().info('VideoController.post is called...');

    final length = await file.length();

    final response = await _authDio.post(
      '/api/video/?title=$title&fileName=${fileName ?? p.basename(file.path)}',
      data: file.openRead(),
      options: Options(headers: {Headers.contentLengthHeader: length}),
      onSendProgress: onSendProgress,
    );
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    Talker().info('VideoController.post call ended');
    return response;
  }

  Future<Video?> get({required String videoId}) async {
    Talker().info('VideoController.get is called...');

    final response = await _authDio.get('/api/video/info?id=$videoId');
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');
    if (response.data == null) {
      Talker().info('Null response data!');
      Talker().info('VideoController.get call ended');
      return null;
    }

    Talker().info('VideoController.get call ended');
    return Video.fromJson(response.data);
  }

  Future<String?> getSignedToken({required String videoId}) async {
    Talker().info('VideoController.get is called...');

    final response = await _authDio.get('/api/video/singed_token?videoId=$videoId');
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');
    if (response.data == null) {
      Talker().info('Null response data!');
      Talker().info('VideoController.get call ended');
      return null;
    }

    Talker().info('VideoController.get call ended');
    return response.data['token'];
  }
}

final videoControllerProvider = Provider((ref) => VideoController(ref));
