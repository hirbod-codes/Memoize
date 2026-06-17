import 'package:client/api/models/video.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class VideoController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  VideoController(this.ref);

  Future<Video?> get({required String videoId}) async {
    final response = await _authDio.get('/api/video/info?id=$videoId');
    if (response.data == null) return null;

    return Video.fromJson(response.data);
  }
}

final videoControllerProvider = Provider((ref) => VideoController(ref));
