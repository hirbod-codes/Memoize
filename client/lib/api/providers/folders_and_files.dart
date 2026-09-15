import "dart:convert";

import "package:client/api/api_call.dart";
import "package:client/api/api_call_extensions.dart";
import "package:client/api/dio/dio_providers.dart";
import "package:client/api/models/folder.dart";
import "package:client/api/models/leaf.dart";
import "package:client/api/root_navigator_key.dart";
import "package:client/components/global/notification_service.dart";
import "package:client/l10n/app_localizations.dart";
import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:talker/talker.dart";

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
    return FoldersAndFilesState(
      folders: folders ?? this.folders?.map((m) => m.copyWith()).toList(),
      files: files ?? this.files?.map((m) => m.copyWith()).toList(),
      folderIndex: folderIndex ?? this.folderIndex,
      fileIndex: fileIndex ?? this.fileIndex,
      isTerm: isTerm ?? this.isTerm,
    );
  }
}

class FoldersAndFiles extends Notifier<FoldersAndFilesState> {
  Dio get _authDio => ref.read(authDioProvider);

  @override
  FoldersAndFilesState build() {
    return FoldersAndFilesState(folders: null, files: null, fileIndex: 0, folderIndex: 0, isTerm: true);
  }

  void flip() => state = state.copyWith(isTerm: !state.isTerm);

  // Folders
  void setFolders(List<Folder> folders) => state = state.copyWith(folders: folders);

  void setFolderIndex(int index) => state = state.copyWith(folderIndex: index);

  Future<String?> addFolder(String title, String? parentId) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.addFolder is called...");

      final Map<String, dynamic> data = {"title": title};
      if (parentId != null) data["parentId"] = parentId;

      // Send request
      final result = await apiCall(() => _authDio.post("/api/treeNode/", data: {"treeNode": data}).notifyOnSuccess(l10n.folder_add_success));
      if (result.isFailure || result.dataOrNull == null) {
        NotificationService.showError(context: rootContext!, message: l10n.folder_add_failed);
        return null;
      }
      final newId = result.dataOrNull!["id"];

      if (state.folders == null) {
        state.folders = List.from([Folder(id: newId, title: title)]);
      } else {
        state.folders!.add(Folder(id: newId, title: title));
        state = state.copyWith();
      }

      return newId;
    } catch (e) {
      Talker().error("FoldersAndFiles.addFolder throws an error", e);
      NotificationService.showError(context: rootContext!, message: l10n.folder_add_failed);
      return null;
    } finally {
      Talker().info("FoldersAndFiles.addFolder call ended");
    }
  }

  /// Currently supports Folder.title field only
  Future<bool> setFolder(Folder folder) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.setFolder is called...");

      if (state.folders == null) {
        NotificationService.showError(message: l10n.folders_not_found);
        return false;
      }

      int? folderIndex;
      for (int i = 0; i < state.folders!.length; i++) {
        if (state.folders![i].id != folder.id) continue;
        folderIndex = i;
        break;
      }
      if (folderIndex == null) {
        NotificationService.showError(message: l10n.folder_not_found);
        return false;
      }

      final Map<String, dynamic> data = {'_id': folder.id, 'title': folder.title};
      var result = await apiCall(() => _authDio.patch('/api/treeNode/', data: {'treeNode': data}).notifyOnSuccess(l10n.folder_set_success));
      if (result.isFailure) {
        NotificationService.showError(message: l10n.folder_set_failed);
        return false;
      }

      state.folders![folderIndex] = folder;
      state = state.copyWith();

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.setFolder throws an error", e);
      NotificationService.showError(message: l10n.folder_set_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.setFolder call ended");
    }
  }

  Future<bool> removeFolder(int index) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.removeFolder is called...");

      if (state.folders == null) {
        NotificationService.showError(message: l10n.folders_not_found);
        return false;
      }
      if (index >= state.folders!.length || index < 0) {
        NotificationService.showError(message: l10n.folder_not_found);
        return false;
      }

      final result = await apiCall(() => _authDio.delete('/api/treeNode/?treeNodeId=${state.folders![index].id}').notifyOnSuccess(l10n.folder_remove_success));
      if (result.isFailure) {
        NotificationService.showError(message: l10n.folder_remove_failed);
        return false;
      }

      state.folders!.removeAt(index);
      state = state.copyWith();

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.removeFolder throws an error", e);
      NotificationService.showError(message: l10n.folder_remove_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.removeFolder call ended");
    }
  }

  Future<bool> removeFolderById(String id) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.removeFolderById is called...");

      if (state.folders == null) {
        NotificationService.showError(message: l10n.folders_not_found);
        return false;
      }

      int? folderIndex;
      for (int i = 0; i < state.folders!.length; i++) {
        if (state.folders![i].id != id) continue;
        folderIndex = i;
        break;
      }
      if (folderIndex == null) {
        NotificationService.showError(message: l10n.folder_not_found);
        return false;
      }

      final result = await apiCall(() => _authDio.delete('/api/treeNode/?treeNodeId=$id').notifyOnSuccess(l10n.folder_remove_success));
      if (result.isFailure) {
        NotificationService.showError(message: l10n.folder_remove_failed);
        return false;
      }

      state.folders!.removeWhere((f) => f.id == id);
      state = state.copyWith();

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.removeFolderById throws an error", e);
      NotificationService.showError(message: l10n.folder_remove_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.removeFolderById call ended");
    }
  }

  Future<bool> moveFolder(Folder folder, String? destId) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.moveFolder is called...");

      final Map<String, dynamic> data = {"_id": folder.id};
      data["parentId"] = destId;

      // Send request
      final result = await apiCall(() => _authDio.patch("/api/treeNode/", data: {"treeNode": data}).notifyOnSuccess(l10n.folder_move_success));
      if (result.isFailure) {
        NotificationService.showError(context: rootContext!, message: l10n.folder_move_failed);
        return false;
      }

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.moveFolder throws an error", e);
      NotificationService.showError(context: rootContext!, message: l10n.folder_move_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.moveFolder call ended");
    }
  }

  // Files
  void setFiles(List<Leaf> files) => state = state.copyWith(files: files);

  void setFileIndex(int index) => state = state.copyWith(fileIndex: index);

  Future<String?> addFile(String title, String treeNodeId) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.addFile is called...");

      final Map<String, dynamic> data = {"title": title, "treeNodeId": treeNodeId, "termContents": [], "definitionContents": []};

      // Send request
      final result = await apiCall(() => _authDio.post("/api/leaf/", data: {"leaf": data}).notifyOnSuccess(l10n.file_add_success));
      if (result.isFailure || result.dataOrNull == null) {
        NotificationService.showError(context: rootContext!, message: l10n.file_add_failed);
        return null;
      }

      final newId = result.dataOrNull!["id"];

      if (state.files == null) {
        state.files = List.from([Leaf(id: newId, treeNodeId: treeNodeId, title: title, termContents: [], definitionContents: [])]);
      } else {
        state.files!.add(Leaf(id: newId, treeNodeId: treeNodeId, title: title, termContents: [], definitionContents: []));
        state = state.copyWith();
      }

      return newId;
    } catch (e) {
      Talker().error("FoldersAndFiles.addFile throws an error", e);
      NotificationService.showError(context: rootContext!, message: l10n.file_add_failed);
      return null;
    } finally {
      Talker().info("FoldersAndFiles.addFile call ended");
    }
  }

  Future<bool> setFile(Leaf file) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.setFile is called...");

      if (state.files == null) {
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

      int? fileIndex;
      for (int i = 0; i < state.files!.length; i++) {
        if (state.files![i].id != file.id) continue;
        fileIndex = i;
        break;
      }
      if (fileIndex == null) {
        NotificationService.showError(message: l10n.file_not_found);
        return false;
      }

      ApiCallResult<dynamic> result = await _updateLeaf(
        id: file.id,
        title: file.title,
        definitionContents: file.definitionContents,
        termContents: file.termContents,
        successMessage: l10n.file_move_success,
      );
      if (result.isFailure) {
        NotificationService.showError(context: rootContext!, message: l10n.file_move_failed);
        return false;
      }

      state.files![fileIndex] = file;
      state = state.copyWith();

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.setFile throws an error", e);
      NotificationService.showError(message: l10n.file_set_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.setFile call ended");
    }
  }

  Future<bool> removeFile(int index) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.removeFile is called...");

      if (state.files == null) {
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }
      if (index >= state.files!.length || index < 0) {
        NotificationService.showError(message: l10n.file_not_found);
        return false;
      }

      final result = await apiCall(() => _authDio.delete('/api/leaf/?id=${state.files![index].id}').notifyOnSuccess(l10n.file_remove_success));
      if (result.isFailure) {
        NotificationService.showError(message: l10n.file_remove_failed);
        return false;
      }

      state.files!.removeAt(index);
      state = state.copyWith();

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.removeFile throws an error", e);
      NotificationService.showError(message: l10n.file_remove_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.removeFile call ended");
    }
  }

  Future<bool> removeFileById(String id) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.removeFileById is called...");

      if (state.files == null) {
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

      int? fileIndex;
      for (int i = 0; i < state.files!.length; i++) {
        if (state.files![i].id != id) continue;
        fileIndex = i;
        break;
      }
      if (fileIndex == null) {
        NotificationService.showError(message: l10n.file_not_found);
        return false;
      }

      final result = await apiCall(() => _authDio.delete('/api/leaf/?id=$id').notifyOnSuccess(l10n.file_remove_success));
      if (result.isFailure) {
        NotificationService.showError(message: l10n.file_remove_failed);
        return false;
      }

      state.files!.removeWhere((f) => f.id == id);
      state = state.copyWith();

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.removeFileById throws an error", e);
      NotificationService.showError(message: l10n.file_remove_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.removeFileById call ended");
    }
  }

  Future<bool> moveFile(Leaf file, String destId) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.moveFile is called...");

      ApiCallResult<dynamic> result = await _updateLeaf(id: file.id, treeNodeId: destId, successMessage: l10n.file_move_success);
      if (result.isFailure) {
        NotificationService.showError(context: rootContext!, message: l10n.file_move_failed);
        return false;
      }

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.moveFile throws an error", e);
      NotificationService.showError(context: rootContext!, message: l10n.file_move_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.moveFile call ended");
    }
  }

  // Contents
  Future<bool> setContent(Content content, int contentIndex) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.setContent is called...");

      if (state.files == null) {
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

      // Create temporary data
      final tempFile = state.files![state.fileIndex].copyWith();
      final List<Content> contents;
      if (state.isTerm) {
        if (contentIndex >= state.files![state.fileIndex].termContents.length || contentIndex < 0) {
          NotificationService.showError(message: l10n.file_not_found);
          return false;
        }
        contents = tempFile.termContents.map((m) => m.copyWith()).toList();
      } else {
        if (contentIndex >= state.files![state.fileIndex].definitionContents.length || contentIndex < 0) {
          NotificationService.showError(message: l10n.file_not_found);
          return false;
        }
        contents = tempFile.definitionContents.map((m) => m.copyWith()).toList();
      }

      // Update
      contents[contentIndex] = content;

      ApiCallResult<dynamic> result;
      if (state.isTerm) {
        result = await _updateLeaf(id: tempFile.id, termContents: contents, successMessage: l10n.content_set_success);
      } else {
        result = await _updateLeaf(id: tempFile.id, definitionContents: contents, successMessage: l10n.content_set_success);
      }
      if (result.isFailure) {
        NotificationService.showError(context: rootContext!, message: l10n.content_set_failed);
        return false;
      }

      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }

      state = state.copyWith();

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.setContent throws an error", e);
      NotificationService.showError(context: rootContext!, message: l10n.content_set_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.setContent call ended");
    }
  }

  Future<bool> addContent(Content content) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.addContent is called...");

      if (state.files == null) {
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

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

      ApiCallResult<dynamic> result;
      if (state.isTerm) {
        result = await _updateLeaf(id: tempFile.id, termContents: contents, successMessage: l10n.content_add_success);
      } else {
        result = await _updateLeaf(id: tempFile.id, definitionContents: contents, successMessage: l10n.content_add_success);
      }
      if (result.isFailure) {
        NotificationService.showError(context: rootContext!, message: l10n.content_add_failed);
        return false;
      }

      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }

      state = state.copyWith();

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.addContent throws an error", e);
      NotificationService.showError(context: rootContext!, message: l10n.content_add_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.addContent call ended");
    }
  }

  Future<bool> removeContent(int index) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.removeContent is called...");

      if (state.files == null) {
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

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

      ApiCallResult<dynamic> result;
      if (state.isTerm) {
        result = await _updateLeaf(id: tempFile.id, termContents: contents, successMessage: l10n.content_remove_success);
      } else {
        result = await _updateLeaf(id: tempFile.id, definitionContents: contents, successMessage: l10n.content_remove_success);
      }
      if (result.isFailure) {
        NotificationService.showError(context: rootContext!, message: l10n.content_remove_failed);
        return false;
      }

      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }

      state = state.copyWith();

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.removeContent throws an error", e);
      NotificationService.showError(context: rootContext!, message: l10n.content_remove_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.removeContent call ended");
    }
  }

  Future<bool> setContentValue(String value, int contentIndex, int contentValueIndex) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.setContent is called...");

      if (state.files == null) {
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

      // Create temporary data
      final tempFile = state.files![state.fileIndex].copyWith();
      final List<Content> contents;
      if (state.isTerm) {
        if (contentIndex < 0 ||
            contentValueIndex < 0 ||
            contentIndex >= state.files![state.fileIndex].termContents.length ||
            contentValueIndex >= state.files![state.fileIndex].termContents[contentIndex].value.length) {
          NotificationService.showError(message: l10n.file_not_found);
          return false;
        }
        contents = tempFile.termContents.map((m) => m.copyWith()).toList();
      } else {
        if (contentIndex < 0 ||
            contentValueIndex < 0 ||
            contentIndex >= state.files![state.fileIndex].definitionContents.length ||
            contentValueIndex >= state.files![state.fileIndex].definitionContents[contentIndex].value.length) {
          NotificationService.showError(message: l10n.file_not_found);
          return false;
        }
        contents = tempFile.definitionContents.map((m) => m.copyWith()).toList();
      }

      // Update
      contents[contentIndex].value[contentValueIndex] = value;

      ApiCallResult<dynamic> result;
      if (state.isTerm) {
        result = await _updateLeaf(id: tempFile.id, termContents: contents, successMessage: l10n.content_value_set_success);
      } else {
        result = await _updateLeaf(id: tempFile.id, definitionContents: contents, successMessage: l10n.content_value_set_success);
      }
      if (result.isFailure) {
        NotificationService.showError(context: rootContext!, message: l10n.content_value_set_failed);
        return false;
      }

      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }

      state = state.copyWith();

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.setContent throws an error", e);
      NotificationService.showError(context: rootContext!, message: l10n.content_value_set_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.setContent call ended");
    }
  }

  Future<bool> addContentValue(String value, int contentIndex) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.addContentValue is called...");

      if (state.files == null) {
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

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

      ApiCallResult<dynamic> result;
      if (state.isTerm) {
        result = await _updateLeaf(id: tempFile.id, termContents: contents, successMessage: l10n.content_value_add_success);
      } else {
        result = await _updateLeaf(id: tempFile.id, definitionContents: contents, successMessage: l10n.content_value_add_success);
      }
      if (result.isFailure) {
        NotificationService.showError(context: rootContext!, message: l10n.content_value_add_failed);
        return false;
      }

      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }

      state = state.copyWith();

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.addContentValue throws an error", e);
      NotificationService.showError(context: rootContext!, message: l10n.content_value_add_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.addContentValue call ended");
    }
  }

  Future<bool> removeContentValue(int contentIndex, int valueIndex) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.removeContentValue is called...");

      if (state.files == null) {
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

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

      ApiCallResult<dynamic> result;
      if (state.isTerm) {
        result = await _updateLeaf(id: tempFile.id, termContents: contents, successMessage: l10n.content_value_remove_success);
      } else {
        result = await _updateLeaf(id: tempFile.id, definitionContents: contents, successMessage: l10n.content_value_remove_success);
      }
      if (result.isFailure) {
        NotificationService.showError(context: rootContext!, message: l10n.content_value_remove_failed);
        return false;
      }

      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }

      state = state.copyWith();

      return true;
    } catch (e) {
      Talker().error("FoldersAndFiles.removeContentValue throws an error", e);
      NotificationService.showError(context: rootContext!, message: l10n.content_value_remove_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.removeContentValue call ended");
    }
  }

  Future<bool> moveContent(int fromIndex, int toIndex) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.moveContent is called...");

      if (toIndex < 0 || fromIndex < 0) {
        Talker().warning("Invalid index provided");
        NotificationService.showError(message: l10n.content_move_failed);
        return false;
      }
      Talker().info("int fromIndex: $fromIndex, int toIndex: $toIndex");

      if (state.files == null || state.files!.isEmpty) {
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

      final file = state.files![state.fileIndex].copyWith();

      final contents = state.isTerm ? file.termContents : file.definitionContents;

      if (toIndex > contents.length || fromIndex >= contents.length) {
        Talker().warning("Invalid index provided");
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

      final fromContent = contents.removeAt(fromIndex).copyWith();

      if (toIndex > fromIndex) toIndex--; // because one item is removed, therefor the total length is reduced by one.

      contents.insert(toIndex, fromContent);

      return await setFile(file);
    } catch (e, st) {
      Talker().error("FoldersAndFiles.moveContent throws an error", e, st);
      NotificationService.showError(message: l10n.content_move_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.moveContent call ended");
    }
  }

  Future<bool> moveContentValue(int contentIndex, int fromIndex, int toIndex) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;

    try {
      Talker().info("FoldersAndFiles.moveContentValue is called...");

      if (contentIndex < 0 || toIndex < 0 || fromIndex < 0) {
        Talker().warning("Invalid index provided");
        NotificationService.showError(message: l10n.content_move_failed);
        return false;
      }
      Talker().info("int contentIndex: $contentIndex, int fromIndex: $fromIndex, int toIndex: $toIndex");

      if (state.files == null || state.files!.isEmpty) {
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

      final file = state.files![state.fileIndex].copyWith();

      final contents = state.isTerm ? file.termContents : file.definitionContents;

      if (contentIndex >= contents.length) {
        Talker().warning('content not found');
        NotificationService.showError(message: l10n.content_not_found);
        return false;
      }

      final content = contents[contentIndex];

      if (toIndex > content.value.length || fromIndex >= content.value.length) {
        Talker().warning('content value not found');
        NotificationService.showError(message: l10n.content_not_found);
        return false;
      }

      final fromContentValue = content.value.removeAt(fromIndex);

      if (toIndex > fromIndex) toIndex--; // because one item is removed, therefor the total length is reduced by one.

      content.value.insert(toIndex, fromContentValue);

      return await setFile(file);
    } catch (e, st) {
      Talker().error("FoldersAndFiles.moveContentValue throws an error", e, st);
      NotificationService.showError(message: l10n.content_move_failed);
      return false;
    } finally {
      Talker().info("FoldersAndFiles.moveContentValue call ended");
    }
  }

  Future<ApiCallResult<dynamic>> _updateLeaf({
    required String id,
    String? title,
    String? treeNodeId,
    List<Content>? termContents,
    List<Content>? definitionContents,
    String? successMessage,
  }) async {
    Talker().info('FoldersAndFiles._updateLeaf is called...');

    final Map<String, dynamic> data = {'_id': id};
    if (title != null) data['title'] = title;
    if (treeNodeId != null) data['treeNodeId'] = treeNodeId;
    if (termContents != null) data['termContents'] = termContents.map((c) => c.toJson()).toList();
    if (definitionContents != null) data['definitionContents'] = definitionContents.map((c) => c.toJson()).toList();

    Talker().info('input data: ${jsonEncode(data)}');

    final result = await apiCall(() {
      final dio = _authDio.patch("/api/leaf/", data: {"leaf": data});

      if (successMessage != null) dio.notifyOnSuccess(successMessage);

      return dio;
    });

    Talker().info('FoldersAndFiles._updateLeaf call ended');
    return result;
  }
}

final foldersAndFilesProvider = NotifierProvider<FoldersAndFiles, FoldersAndFilesState>(FoldersAndFiles.new);
