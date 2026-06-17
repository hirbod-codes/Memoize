import 'package:client/api/models/folder.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FolderController {
  final Ref ref;

  Dio get _authDio => ref.read(authDioProvider);

  FolderController(this.ref);

  Future<String> create({required String title, String? parentId}) async {
    final Map<String, dynamic> data = {'title': title};
    if (parentId != null) data['parentId'] = parentId;

    final response = await _authDio.post('/api/treeNode/', data: data);

    return response.data['id'];
  }

  Future<List<Folder>> getMany({required List<String> ids}) async {
    final response = await _authDio.get('/api/treeNode/?ids=${ids.join(',')}');

    final List<dynamic> folders = response.data;

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

    return await _authDio.patch('/api/treeNode/', data: data);
  }

  Future<Response> delete({required String id}) async {
    return await _authDio.delete('/api/treeNode/?treeNodeId=$id');
  }
}

final folderControllerProvider = Provider((ref) => FolderController(ref));
