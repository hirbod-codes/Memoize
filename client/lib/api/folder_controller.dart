import 'dart:convert';

import 'package:talker/talker.dart';
import 'package:client/api/models/folder.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FolderController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  FolderController(this.ref);

  Future<String> create({required String title, String? parentId}) async {
    Talker().info('FolderController.create is called...');

    final Map<String, dynamic> data = {'title': title};
    if (parentId != null) data['parentId'] = parentId;
    Talker().info('input data: ${jsonEncode(data)}');

    final response = await _authDio.post('/api/treeNode/', data: {'treeNode': data});
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    Talker().info('FolderController.create call ended');
    return response.data['id'];
  }

  Future<List<Folder>> getMany({required List<String> ids}) async {
    Talker().info('FolderController.getMany is called...');

    final response = await _authDio.get('/api/treeNode/?ids=${ids.join(',')}');
    Talker().info('response status code: ${response.statusCode}, data: ${jsonEncode(response.data)}');

    final List<dynamic> folders = response.data;

    Talker().info('FolderController.getMany call ended');
    return folders.map((f) => Folder.fromJson(f)).toList();
  }

  Future<List<Folder>> getChildren({required String parentTreeNodeId}) async {
    final response = await _authDio.get('/api/treeNode/children/?parentTreeNodeId=$parentTreeNodeId');

    final List<dynamic> folders = response.data;

    return folders.map((f) => Folder.fromJson(f)).toList();
  }

  Future<List<Folder>> getRoot() async {
    final response = await _authDio.get('/api/treeNode/root');

    final List<dynamic> folders = response.data;

    return folders.map((f) => Folder.fromJson(f)).toList();
  }

  Future<List<Folder>> getPaginated({required int limit, String? search, String? parentId, int? skip}) async {
    final response = await _authDio.get('/api/treeNode/list/?limit=$limit${skip != null ? '&skip=$skip' : ''}${parentId != null ? '&parentId=$parentId' : ''}${search != null ? '&search=$search' : ''}');

    final List<dynamic> folders = response.data;

    return folders.map((f) => Folder.fromJson(f)).toList();
  }

  Future<Response> patch({required String id, String? title, List<String>? treeNodeIds, List<String>? leafIds}) async {
    final Map<String, dynamic> data = {'_id': id};
    if (title != null) data['title'] = title;
    if (treeNodeIds != null) data['treeNodeIds'] = treeNodeIds;
    if (leafIds != null) data['leafIds'] = leafIds;

    return await _authDio.patch('/api/treeNode/', data: {'treeNode': data});
  }

  // There is another method for updating treeNode, because parentId field is sensitive to undefined value(having undefined parentId means the treeNode is a root treeNode).
  Future<Response> patchParentId({required String id, String? parentId}) async {
    final Map<String, dynamic> data = {'_id': id};
    data['parentId'] = parentId;

    return await _authDio.patch('/api/treeNode/', data: {'treeNode': data});
  }

  Future<Response> delete({required String id}) async {
    return await _authDio.delete('/api/treeNode/?treeNodeId=$id');
  }
}

final folderControllerProvider = Provider((ref) => FolderController(ref));
