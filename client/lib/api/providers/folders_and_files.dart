import 'package:client/api/folder_controller.dart';
import 'package:client/api/leaf_controller.dart';
import 'package:client/api/models/folder.dart';
import 'package:client/api/models/leaf.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

enum FoldersAndFilesStateResponseStatus { success, failure }

class FoldersAndFilesStateResponse {
  final FoldersAndFilesStateResponseStatus status;
  final String? message;
  final Object? error;

  FoldersAndFilesStateResponse({required this.status, this.message, this.error});
}

class FoldersAndFilesState {
  List<Folder>? folders;
  List<Leaf>? files;
  int folderIndex;
  int fileIndex;
  bool isTerm;

  FoldersAndFilesState({required this.folders, required this.files, required this.folderIndex, required this.fileIndex, required this.isTerm});

  FoldersAndFilesState copyWith({List<Folder>? folders, List<Leaf>? files, int? folderIndex, int? fileIndex, bool? isTerm}) {
    return FoldersAndFilesState(folders: folders ?? this.folders?.map((m) => m.copyWith()).toList(), files: files ?? this.files?.map((m) => m.copyWith()).toList(), folderIndex: folderIndex ?? this.folderIndex, fileIndex: fileIndex ?? this.fileIndex, isTerm: isTerm ?? this.isTerm);
  }
}

class FoldersAndFiles extends Notifier<FoldersAndFilesState> {
  @override
  FoldersAndFilesState build() {
    return FoldersAndFilesState(folders: null, files: null, fileIndex: 0, folderIndex: 0, isTerm: true);
  }

  void flip() => state = state.copyWith(isTerm: !state.isTerm);

  // Folders
  void setFolders(List<Folder> folders) => state = state.copyWith(folders: folders);

  void setFolderIndex(int index) => state = state.copyWith(folderIndex: index);

  Future<FoldersAndFilesStateResponse> addFolder(String title, String? parentId) async {
    try {
      Talker().info('FoldersAndFiles.addFolder is called...');

      if (state.folders == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No folders found!');

      // Send request
      String newId = await ref.read(folderControllerProvider).create(title: title, parentId: parentId);

      return _persist(
        errorMessage: 'Failure while trying to add new folder.',
        update: () {
          state.folders!.add(Folder(id: newId, title: title));
        },
      );
    } catch (e) {
      Talker().error('FoldersAndFiles.addFolder throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to add new folder.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.addFolder call ended');
    }
  }

  Future<FoldersAndFilesStateResponse> setFolder(Folder folder) async {
    try {
      Talker().info('FoldersAndFiles.setFolder is called...');

      if (state.folders == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No folders found!');

      int? folderIndex;
      for (int i = 0; i < state.folders!.length; i++) {
        if (state.folders![i].id != folder.id) continue;
        folderIndex = i;
        break;
      }
      if (folderIndex == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Folder not found!');

      // Send request
      Response<dynamic> response = await ref.read(folderControllerProvider).patch(id: folder.id, title: folder.title);

      return _persist(
        response: response,
        errorMessage: 'Failure while trying to update folder.',
        update: () {
          state.folders![folderIndex!] = folder;
        },
      );
    } catch (e) {
      Talker().error('FoldersAndFiles.setFolder throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to update folder.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.setFolder call ended');
    }
  }

  Future<FoldersAndFilesStateResponse> removeFolder(int index) async {
    try {
      Talker().info('FoldersAndFiles.removeFolder is called...');

      if (state.folders == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No folders found!');
      if (index >= state.folders!.length || index < 0) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Folder not found!');

      // Send request
      Response<dynamic> response = await ref.read(folderControllerProvider).delete(id: state.folders![index].id);

      return _persist(
        response: response,
        errorMessage: 'Failure while trying to remove folder.',
        update: () {
          state.folders!.removeAt(index);
        },
      );
    } catch (e) {
      Talker().error('FoldersAndFiles.removeFolder throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to remove folder.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.removeFolder call ended');
    }
  }

  Future<FoldersAndFilesStateResponse> removeFolderById(String id) async {
    try {
      Talker().info('FoldersAndFiles.removeFolderById is called...');

      if (state.folders == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No folders found!');

      int? folderIndex;
      for (int i = 0; i < state.folders!.length; i++) {
        if (state.folders![i].id != id) continue;
        folderIndex = i;
        break;
      }
      if (folderIndex == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'folder not found!');

      // Send request
      Response<dynamic> response = await ref.read(folderControllerProvider).delete(id: id);

      return _persist(
        response: response,
        errorMessage: 'Failure while trying to remove folder.',
        update: () {
          state.folders!.removeWhere((f) => f.id == id);
        },
      );
    } catch (e) {
      Talker().error('FoldersAndFiles.removeFolderById throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to remove folder.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.removeFolderById call ended');
    }
  }

  Future<FoldersAndFilesStateResponse> moveFolder(Folder folder, String? destId) async {
    Response<dynamic> response = await ref.read(folderControllerProvider).patchParentId(id: folder.id, parentId: destId);

    if (response.statusCode == null || response.statusCode! < 200 || response.statusCode! > 299) {
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to move folder.');
    }

    return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.success);
  }

  // Files
  void setFiles(List<Leaf> files) => state = state.copyWith(files: files);

  void setFileIndex(int index) => state = state.copyWith(fileIndex: index);

  Future<FoldersAndFilesStateResponse> addFile(String title, String treeNodeId) async {
    try {
      Talker().info('FoldersAndFiles.addFile is called...');

      if (state.files == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No files found!');

      // Send request
      String newId = await ref.read(leafControllerProvider).create(title: title, treeNodeId: treeNodeId, termContents: [], definitionContents: []);

      return _persist(
        errorMessage: 'Failure while trying to add new file.',
        update: () {
          state.files!.add(Leaf(id: newId, treeNodeId: treeNodeId, title: title, termContents: [], definitionContents: []));
        },
      );
    } catch (e) {
      Talker().error('FoldersAndFiles.addFile throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to add new file.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.addFile call ended');
    }
  }

  Future<FoldersAndFilesStateResponse> setFile(Leaf file) async {
    try {
      Talker().info('FoldersAndFiles.setFile is called...');

      if (state.files == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No files found!');

      int? fileIndex;
      for (int i = 0; i < state.files!.length; i++) {
        if (state.files![i].id != file.id) continue;
        fileIndex = i;
        break;
      }
      if (fileIndex == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'File not found!');

      // Send request
      Response<dynamic> response = await ref.read(leafControllerProvider).patch(id: file.id, title: file.title, termContents: file.termContents, definitionContents: file.definitionContents);

      return _persist(
        response: response,
        errorMessage: 'Failure while trying to update file.',
        update: () {
          state.files![fileIndex!] = file;
        },
      );
    } catch (e) {
      Talker().error('FoldersAndFiles.setFile throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to update file.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.setFile call ended');
    }
  }

  Future<FoldersAndFilesStateResponse> removeFile(int index) async {
    try {
      Talker().info('FoldersAndFiles.removeFile is called...');

      if (state.files == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No files found!');
      if (index >= state.files!.length || index < 0) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'File not found!');

      // Send request
      Response<dynamic> response = await ref.read(leafControllerProvider).delete(id: state.files![index].id);

      return _persist(
        response: response,
        errorMessage: 'Failure while trying to remove file.',
        update: () {
          state.files!.removeAt(index);
        },
      );
    } catch (e) {
      Talker().error('FoldersAndFiles.removeFile throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to remove file.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.removeFile call ended');
    }
  }

  Future<FoldersAndFilesStateResponse> removeFileById(String id) async {
    try {
      Talker().info('FoldersAndFiles.removeFileById is called...');

      if (state.files == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No files found!');

      Leaf? file;
      for (int i = 0; i < state.files!.length; i++) {
        if (state.files![i].id != id) continue;
        file = state.files![i];
        break;
      }
      if (file == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'File not found!');

      // Send request
      Response<dynamic> response = await ref.read(leafControllerProvider).delete(id: id);

      return _persist(
        response: response,
        errorMessage: 'Failure while trying to remove file.',
        update: () {
          state.files!.removeWhere((f) => f.id == id);
        },
      );
    } catch (e) {
      Talker().error('FoldersAndFiles.removeFileById throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to remove file.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.removeFileById call ended');
    }
  }

  Future<void> moveFile() async {}

  // Contents
  Future<FoldersAndFilesStateResponse> setContent(Content content, int contentIndex) async {
    try {
      Talker().info('FoldersAndFiles.setContent is called...');

      if (state.files == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No files found!');

      // Create temporary data
      final tempFile = state.files![state.fileIndex].copyWith();
      final List<Content> contents;
      if (state.isTerm) {
        if (contentIndex >= state.files![state.fileIndex].termContents.length || contentIndex < 0) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'File not found!');
        contents = tempFile.termContents.map((m) => m.copyWith()).toList();
      } else {
        if (contentIndex >= state.files![state.fileIndex].definitionContents.length || contentIndex < 0) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'File not found!');
        contents = tempFile.definitionContents.map((m) => m.copyWith()).toList();
      }

      // Update
      contents[contentIndex] = content;

      // Send request
      Response<dynamic> result;
      if (state.isTerm) {
        result = await ref.read(leafControllerProvider).patch(id: tempFile.id, termContents: contents);
      } else {
        result = await ref.read(leafControllerProvider).patch(id: tempFile.id, definitionContents: contents);
      }

      return _persistContents(response: result, message: 'Failure while trying to update content.', contents: contents);
    } catch (e) {
      Talker().error('FoldersAndFiles.setContent throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to update content.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.setContent call ended');
    }
  }

  Future<FoldersAndFilesStateResponse> addContent(Content content) async {
    try {
      Talker().info('FoldersAndFiles.addContent is called...');

      if (state.files == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No files found!');

      // Create temporary data
      final tempFile = state.files![state.fileIndex].copyWith();
      final List<Content> contents;
      if (state.isTerm) {
        contents = tempFile.termContents.map((m) => m.copyWith()).toList();
      } else {
        contents = tempFile.definitionContents.map((m) => m.copyWith()).toList();
      }

      // Update
      contents.add(content);

      // Send request
      Response<dynamic> result;
      if (state.isTerm) {
        result = await ref.read(leafControllerProvider).patch(id: tempFile.id, termContents: contents);
      } else {
        result = await ref.read(leafControllerProvider).patch(id: tempFile.id, definitionContents: contents);
      }

      return _persistContents(response: result, message: 'Failure while trying to add new content.', contents: contents);
    } catch (e) {
      Talker().error('FoldersAndFiles.addContent throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to add new content.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.addContent call ended');
    }
  }

  Future<FoldersAndFilesStateResponse> removeContent(int index) async {
    try {
      Talker().info('FoldersAndFiles.removeContent is called...');

      if (state.files == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No files found!');

      // Create temporary data
      final tempFile = state.files![state.fileIndex].copyWith();
      final List<Content> contents;
      if (state.isTerm) {
        contents = tempFile.termContents.map((m) => m.copyWith()).toList();
      } else {
        contents = tempFile.definitionContents.map((m) => m.copyWith()).toList();
      }

      // Update
      contents.removeAt(index);

      // Send request
      Response<dynamic> result;
      if (state.isTerm) {
        result = await ref.read(leafControllerProvider).patch(id: tempFile.id, termContents: contents);
      } else {
        result = await ref.read(leafControllerProvider).patch(id: tempFile.id, definitionContents: contents);
      }

      return _persistContents(response: result, message: 'Failure while trying to remove content.', contents: contents);
    } catch (e) {
      Talker().error('FoldersAndFiles.removeContent throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to remove content.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.removeContent call ended');
    }
  }

  Future<FoldersAndFilesStateResponse> setContentValue(String value, int contentIndex, int contentValueIndex) async {
    try {
      Talker().info('FoldersAndFiles.setContent is called...');

      if (state.files == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No files found!');

      // Create temporary data
      final tempFile = state.files![state.fileIndex].copyWith();
      final List<Content> contents;
      if (state.isTerm) {
        if (contentIndex < 0 || contentValueIndex < 0 || contentIndex >= state.files![state.fileIndex].termContents.length || contentValueIndex >= state.files![state.fileIndex].termContents[contentIndex].value.length) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'File not found!');
        contents = tempFile.termContents.map((m) => m.copyWith()).toList();
      } else {
        if (contentIndex < 0 || contentValueIndex < 0 || contentIndex >= state.files![state.fileIndex].definitionContents.length || contentValueIndex >= state.files![state.fileIndex].definitionContents[contentIndex].value.length) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'File not found!');
        contents = tempFile.definitionContents.map((m) => m.copyWith()).toList();
      }

      // Update
      contents[contentIndex].value[contentValueIndex] = value;

      // Send request
      Response<dynamic> result;
      if (state.isTerm) {
        result = await ref.read(leafControllerProvider).patch(id: tempFile.id, termContents: contents);
      } else {
        result = await ref.read(leafControllerProvider).patch(id: tempFile.id, definitionContents: contents);
      }

      return _persistContents(response: result, message: 'Failure while trying to update content.', contents: contents);
    } catch (e) {
      Talker().error('FoldersAndFiles.setContent throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to update content.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.setContent call ended');
    }
  }

  Future<FoldersAndFilesStateResponse> addContentValue(String value, int contentIndex) async {
    try {
      Talker().info('FoldersAndFiles.addContentValue is called...');

      if (state.files == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No files found!');

      // Create temporary data
      final tempFile = state.files![state.fileIndex].copyWith();
      final List<Content> contents;
      if (state.isTerm) {
        contents = tempFile.termContents.map((m) => m.copyWith()).toList();
      } else {
        contents = tempFile.definitionContents.map((m) => m.copyWith()).toList();
      }

      // Update
      contents[contentIndex].value.add(value);

      // Send request
      Response<dynamic> result;
      if (state.isTerm) {
        result = await ref.read(leafControllerProvider).patch(id: tempFile.id, termContents: contents);
      } else {
        result = await ref.read(leafControllerProvider).patch(id: tempFile.id, definitionContents: contents);
      }

      return _persistContents(response: result, message: 'Failure while trying to add new content.', contents: contents);
    } catch (e) {
      print(e);
      Talker().error('FoldersAndFiles.addContentValue throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to add new content.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.addContentValue call ended');
    }
  }

  Future<FoldersAndFilesStateResponse> removeContentValue(int contentIndex, int valueIndex) async {
    try {
      Talker().info('FoldersAndFiles.removeContentValue is called...');

      if (state.files == null) return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'No files found!');

      // Create temporary data
      final tempFile = state.files![state.fileIndex].copyWith();
      final List<Content> contents;
      if (state.isTerm) {
        contents = tempFile.termContents.map((m) => m.copyWith()).toList();
      } else {
        contents = tempFile.definitionContents.map((m) => m.copyWith()).toList();
      }

      // Update
      contents[contentIndex].value.removeAt(valueIndex);

      // Send request
      Response<dynamic> result;
      if (state.isTerm) {
        result = await ref.read(leafControllerProvider).patch(id: tempFile.id, termContents: contents);
      } else {
        result = await ref.read(leafControllerProvider).patch(id: tempFile.id, definitionContents: contents);
      }

      return _persistContents(response: result, message: 'Failure while trying to remove content.', contents: contents);
    } catch (e) {
      Talker().error('FoldersAndFiles.removeContentValue throws an error', e);
      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: 'Failure while trying to remove content.', error: e);
    } finally {
      Talker().info('FoldersAndFiles.removeContentValue call ended');
    }
  }

  FoldersAndFilesStateResponse _persistContents({required Response response, required String message, required List<Content> contents}) => _persist(
    response: response,
    errorMessage: message,
    update: () {
      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }
    },
  );

  FoldersAndFilesStateResponse _persist({required String errorMessage, Response? response, Function? update}) {
    if (response == null || (response.statusCode != null && response.statusCode! >= 200 && response.statusCode! < 300)) {
      update?.call();

      state = state.copyWith();

      return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.success);
    }

    return FoldersAndFilesStateResponse(status: FoldersAndFilesStateResponseStatus.failure, message: errorMessage);
  }
}

final foldersAndFilesProvider = NotifierProvider<FoldersAndFiles, FoldersAndFilesState>(FoldersAndFiles.new);
