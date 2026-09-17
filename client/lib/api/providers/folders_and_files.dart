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
    final log = Talker();

    try {
      log.info("FoldersAndFiles.addFolder is called...");
      log.debug("addFolder input: title=$title, parentId=$parentId");

      final Map<String, dynamic> data = {"title": title};
      if (parentId != null) data["parentId"] = parentId;

      // Send request
      final result = await apiCall(() => _authDio.post("/api/treeNode/", data: {"treeNode": data}).notifyOnSuccess(l10n.folder_add_success));
      if (result.isFailure || result.dataOrNull == null) {
        log.warning("addFolder rejected: request failed or returned no data (isFailure=${result.isFailure})");
        NotificationService.showError(context: rootContext!, message: l10n.folder_add_failed);
        return null;
      }
      final newId = result.dataOrNull!["id"];
      log.debug("addFolder received new id=$newId");

      if (state.folders == null) {
        state.folders = List.from([Folder(id: newId, title: title)]);
      } else {
        state.folders!.add(Folder(id: newId, title: title));
        state = state.copyWith();
      }

      log.info("addFolder succeeded: id=$newId");
      return newId;
    } catch (e, st) {
      log.error("FoldersAndFiles.addFolder throws an error", e, st);
      NotificationService.showError(context: rootContext!, message: l10n.folder_add_failed);
      return null;
    } finally {
      log.info("FoldersAndFiles.addFolder call ended");
    }
  }

  /// Currently supports Folder.title field only
  Future<bool> setFolder(Folder folder) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.setFolder is called...");
      log.debug("setFolder input: id=${folder.id}, title=${folder.title}");

      if (state.folders == null) {
        log.warning("setFolder rejected: no folders loaded in state");
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
        log.warning("setFolder rejected: folder id=${folder.id} not found in state");
        NotificationService.showError(message: l10n.folder_not_found);
        return false;
      }
      log.debug("setFolder resolved folderIndex=$folderIndex");

      final Map<String, dynamic> data = {'_id': folder.id, 'title': folder.title};
      var result = await apiCall(() => _authDio.patch('/api/treeNode/', data: {'treeNode': data}).notifyOnSuccess(l10n.folder_set_success));
      if (result.isFailure) {
        log.warning("setFolder rejected: request failed for id=${folder.id}");
        NotificationService.showError(message: l10n.folder_set_failed);
        return false;
      }

      state.folders![folderIndex] = folder;
      state = state.copyWith();

      log.info("setFolder succeeded: id=${folder.id}, folderIndex=$folderIndex");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.setFolder throws an error", e, st);
      NotificationService.showError(message: l10n.folder_set_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.setFolder call ended");
    }
  }

  Future<bool> removeFolder(int index) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.removeFolder is called...");
      log.debug("removeFolder input: index=$index");

      if (state.folders == null) {
        log.warning("removeFolder rejected: no folders loaded in state");
        NotificationService.showError(message: l10n.folders_not_found);
        return false;
      }
      if (index >= state.folders!.length || index < 0) {
        log.warning("removeFolder rejected: index=$index out of range (length=${state.folders!.length})");
        NotificationService.showError(message: l10n.folder_not_found);
        return false;
      }

      final targetId = state.folders![index].id;
      log.debug("removeFolder resolved id=$targetId for index=$index");

      final result = await apiCall(() => _authDio.delete('/api/treeNode/?treeNodeId=$targetId').notifyOnSuccess(l10n.folder_remove_success));
      if (result.isFailure) {
        log.warning("removeFolder rejected: request failed for id=$targetId");
        NotificationService.showError(message: l10n.folder_remove_failed);
        return false;
      }

      state.folders!.removeAt(index);
      state = state.copyWith();

      log.info("removeFolder succeeded: id=$targetId, index=$index");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.removeFolder throws an error", e, st);
      NotificationService.showError(message: l10n.folder_remove_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.removeFolder call ended");
    }
  }

  Future<bool> removeFolderById(String id) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.removeFolderById is called...");
      log.debug("removeFolderById input: id=$id");

      if (state.folders == null) {
        log.warning("removeFolderById rejected: no folders loaded in state");
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
        log.warning("removeFolderById rejected: folder id=$id not found in state");
        NotificationService.showError(message: l10n.folder_not_found);
        return false;
      }
      log.debug("removeFolderById resolved folderIndex=$folderIndex");

      final result = await apiCall(() => _authDio.delete('/api/treeNode/?treeNodeId=$id').notifyOnSuccess(l10n.folder_remove_success));
      if (result.isFailure) {
        log.warning("removeFolderById rejected: request failed for id=$id");
        NotificationService.showError(message: l10n.folder_remove_failed);
        return false;
      }

      state.folders!.removeWhere((f) => f.id == id);
      state = state.copyWith();

      log.info("removeFolderById succeeded: id=$id");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.removeFolderById throws an error", e, st);
      NotificationService.showError(message: l10n.folder_remove_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.removeFolderById call ended");
    }
  }

  Future<bool> moveFolder(Folder folder, String? destId) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.moveFolder is called...");
      log.debug("moveFolder input: id=${folder.id}, destId=$destId");

      final Map<String, dynamic> data = {"_id": folder.id};
      data["parentId"] = destId;

      // Send request
      final result = await apiCall(() => _authDio.patch("/api/treeNode/", data: {"treeNode": data}).notifyOnSuccess(l10n.folder_move_success));
      if (result.isFailure) {
        log.warning("moveFolder rejected: request failed for id=${folder.id}, destId=$destId");
        NotificationService.showError(context: rootContext!, message: l10n.folder_move_failed);
        return false;
      }

      log.info("moveFolder succeeded: id=${folder.id}, destId=$destId");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.moveFolder throws an error", e, st);
      NotificationService.showError(context: rootContext!, message: l10n.folder_move_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.moveFolder call ended");
    }
  }

  // Files
  void setFiles(List<Leaf> files) => state = state.copyWith(files: files);

  void setFileIndex(int index) => state = state.copyWith(fileIndex: index);

  Future<String?> addFile(String title, String treeNodeId) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.addFile is called...");
      log.debug("addFile input: title=$title, treeNodeId=$treeNodeId");

      final Map<String, dynamic> data = {"title": title, "treeNodeId": treeNodeId, "termContents": [], "definitionContents": []};

      // Send request
      final result = await apiCall(() => _authDio.post("/api/leaf/", data: {"leaf": data}).notifyOnSuccess(l10n.file_add_success));
      if (result.isFailure || result.dataOrNull == null) {
        log.warning("addFile rejected: request failed or returned no data (isFailure=${result.isFailure})");
        NotificationService.showError(context: rootContext!, message: l10n.file_add_failed);
        return null;
      }

      final newId = result.dataOrNull!["id"];
      log.debug("addFile received new id=$newId");

      if (state.files == null) {
        state.files = List.from([Leaf(id: newId, treeNodeId: treeNodeId, title: title, termContents: [], definitionContents: [])]);
      } else {
        state.files!.add(Leaf(id: newId, treeNodeId: treeNodeId, title: title, termContents: [], definitionContents: []));
        state = state.copyWith();
      }

      log.info("addFile succeeded: id=$newId, treeNodeId=$treeNodeId");
      return newId;
    } catch (e, st) {
      log.error("FoldersAndFiles.addFile throws an error", e, st);
      NotificationService.showError(context: rootContext!, message: l10n.file_add_failed);
      return null;
    } finally {
      log.info("FoldersAndFiles.addFile call ended");
    }
  }

  Future<bool> setFile(Leaf file) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.setFile is called...");
      log.debug("setFile input: id=${file.id}, title=${file.title}");

      if (state.files == null) {
        log.warning("setFile rejected: no files loaded in state");
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
        log.warning("setFile rejected: file id=${file.id} not found in state");
        NotificationService.showError(message: l10n.file_not_found);
        return false;
      }
      log.debug("setFile resolved fileIndex=$fileIndex");

      ApiCallResult<dynamic> result = await _updateLeaf(
        id: file.id,
        title: file.title,
        definitionContents: file.definitionContents,
        termContents: file.termContents,
        successMessage: l10n.file_move_success,
      );
      if (result.isFailure) {
        log.warning("setFile rejected: request failed for id=${file.id}");
        NotificationService.showError(context: rootContext!, message: l10n.file_move_failed);
        return false;
      }

      state.files![fileIndex] = file;
      state = state.copyWith();

      log.info("setFile succeeded: id=${file.id}, fileIndex=$fileIndex");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.setFile throws an error", e, st);
      NotificationService.showError(message: l10n.file_set_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.setFile call ended");
    }
  }

  Future<bool> removeFile(int index) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.removeFile is called...");
      log.debug("removeFile input: index=$index");

      if (state.files == null) {
        log.warning("removeFile rejected: no files loaded in state");
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }
      if (index >= state.files!.length || index < 0) {
        log.warning("removeFile rejected: index=$index out of range (length=${state.files!.length})");
        NotificationService.showError(message: l10n.file_not_found);
        return false;
      }

      final targetId = state.files![index].id;
      log.debug("removeFile resolved id=$targetId for index=$index");

      final result = await apiCall(() => _authDio.delete('/api/leaf/?id=$targetId').notifyOnSuccess(l10n.file_remove_success));
      if (result.isFailure) {
        log.warning("removeFile rejected: request failed for id=$targetId");
        NotificationService.showError(message: l10n.file_remove_failed);
        return false;
      }

      state.files!.removeAt(index);
      state = state.copyWith();

      log.info("removeFile succeeded: id=$targetId, index=$index");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.removeFile throws an error", e, st);
      NotificationService.showError(message: l10n.file_remove_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.removeFile call ended");
    }
  }

  Future<bool> removeFileById(String id) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.removeFileById is called...");
      log.debug("removeFileById input: id=$id");

      if (state.files == null) {
        log.warning("removeFileById rejected: no files loaded in state");
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
        log.warning("removeFileById rejected: file id=$id not found in state");
        NotificationService.showError(message: l10n.file_not_found);
        return false;
      }
      log.debug("removeFileById resolved fileIndex=$fileIndex");

      final result = await apiCall(() => _authDio.delete('/api/leaf/?id=$id').notifyOnSuccess(l10n.file_remove_success));
      if (result.isFailure) {
        log.warning("removeFileById rejected: request failed for id=$id");
        NotificationService.showError(message: l10n.file_remove_failed);
        return false;
      }

      state.files!.removeWhere((f) => f.id == id);
      state = state.copyWith();

      log.info("removeFileById succeeded: id=$id");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.removeFileById throws an error", e, st);
      NotificationService.showError(message: l10n.file_remove_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.removeFileById call ended");
    }
  }

  Future<bool> moveFile(Leaf file, String destId) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.moveFile is called...");
      log.debug("moveFile input: id=${file.id}, destId=$destId");

      ApiCallResult<dynamic> result = await _updateLeaf(id: file.id, treeNodeId: destId, successMessage: l10n.file_move_success);
      if (result.isFailure) {
        log.warning("moveFile rejected: request failed for id=${file.id}, destId=$destId");
        NotificationService.showError(context: rootContext!, message: l10n.file_move_failed);
        return false;
      }

      log.info("moveFile succeeded: id=${file.id}, destId=$destId");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.moveFile throws an error", e, st);
      NotificationService.showError(context: rootContext!, message: l10n.file_move_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.moveFile call ended");
    }
  }

  // Contents
  Future<bool> setContent(Content content, int contentIndex) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.setContent is called...");
      log.debug("setContent input: contentIndex=$contentIndex, isTerm=${state.isTerm}");

      if (state.files == null) {
        log.warning("setContent rejected: no files loaded in state");
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

      // Create temporary data
      final tempFile = state.files![state.fileIndex].copyWith();
      final List<Content> contents;
      if (state.isTerm) {
        if (contentIndex >= state.files![state.fileIndex].termContents.length || contentIndex < 0) {
          log.warning(
            "setContent rejected: contentIndex=$contentIndex out of range for termContents (length=${state.files![state.fileIndex].termContents.length})",
          );
          NotificationService.showError(message: l10n.file_not_found);
          return false;
        }
        contents = tempFile.termContents.map((m) => m.copyWith()).toList();
      } else {
        if (contentIndex >= state.files![state.fileIndex].definitionContents.length || contentIndex < 0) {
          log.warning(
            "setContent rejected: contentIndex=$contentIndex out of range for definitionContents (length=${state.files![state.fileIndex].definitionContents.length})",
          );
          NotificationService.showError(message: l10n.file_not_found);
          return false;
        }
        contents = tempFile.definitionContents.map((m) => m.copyWith()).toList();
      }

      // Update
      contents[contentIndex] = content;
      log.debug("setContent replaced entry at contentIndex=$contentIndex");

      ApiCallResult<dynamic> result;
      if (state.isTerm) {
        result = await _updateLeaf(id: tempFile.id, termContents: contents, successMessage: l10n.content_set_success);
      } else {
        result = await _updateLeaf(id: tempFile.id, definitionContents: contents, successMessage: l10n.content_set_success);
      }
      if (result.isFailure) {
        log.warning("setContent rejected: request failed for fileId=${tempFile.id}, contentIndex=$contentIndex");
        NotificationService.showError(context: rootContext!, message: l10n.content_set_failed);
        return false;
      }

      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }

      state = state.copyWith();

      log.info("setContent succeeded: fileId=${tempFile.id}, contentIndex=$contentIndex, isTerm=${state.isTerm}");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.setContent throws an error", e, st);
      NotificationService.showError(context: rootContext!, message: l10n.content_set_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.setContent call ended");
    }
  }

  Future<bool> addContent(Content content) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.addContent is called...");
      log.debug("addContent input: isTerm=${state.isTerm}");

      if (state.files == null) {
        log.warning("addContent rejected: no files loaded in state");
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
      log.debug("addContent appended entry, new length=${contents.length}");

      ApiCallResult<dynamic> result;
      if (state.isTerm) {
        result = await _updateLeaf(id: tempFile.id, termContents: contents, successMessage: l10n.content_add_success);
      } else {
        result = await _updateLeaf(id: tempFile.id, definitionContents: contents, successMessage: l10n.content_add_success);
      }
      if (result.isFailure) {
        log.warning("addContent rejected: request failed for fileId=${tempFile.id}");
        NotificationService.showError(context: rootContext!, message: l10n.content_add_failed);
        return false;
      }

      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }

      state = state.copyWith();

      log.info("addContent succeeded: fileId=${tempFile.id}, isTerm=${state.isTerm}");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.addContent throws an error", e, st);
      NotificationService.showError(context: rootContext!, message: l10n.content_add_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.addContent call ended");
    }
  }

  Future<bool> removeContent(int index) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.removeContent is called...");
      log.debug("removeContent input: index=$index, isTerm=${state.isTerm}");

      if (state.files == null) {
        log.warning("removeContent rejected: no files loaded in state");
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
      log.debug("removeContent removed entry at index=$index, new length=${contents.length}");

      ApiCallResult<dynamic> result;
      if (state.isTerm) {
        result = await _updateLeaf(id: tempFile.id, termContents: contents, successMessage: l10n.content_remove_success);
      } else {
        result = await _updateLeaf(id: tempFile.id, definitionContents: contents, successMessage: l10n.content_remove_success);
      }
      if (result.isFailure) {
        log.warning("removeContent rejected: request failed for fileId=${tempFile.id}, index=$index");
        NotificationService.showError(context: rootContext!, message: l10n.content_remove_failed);
        return false;
      }

      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }

      state = state.copyWith();

      log.info("removeContent succeeded: fileId=${tempFile.id}, index=$index");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.removeContent throws an error", e, st);
      NotificationService.showError(context: rootContext!, message: l10n.content_remove_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.removeContent call ended");
    }
  }

  Future<bool> setContentValue(String value, int contentIndex, int contentValueIndex) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.setContentValue is called...");
      log.debug("setContentValue input: contentIndex=$contentIndex, contentValueIndex=$contentValueIndex, isTerm=${state.isTerm}");

      if (state.files == null) {
        log.warning("setContentValue rejected: no files loaded in state");
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
          log.warning("setContentValue rejected: contentIndex=$contentIndex or contentValueIndex=$contentValueIndex out of range (termContents)");
          NotificationService.showError(message: l10n.file_not_found);
          return false;
        }
        contents = tempFile.termContents.map((m) => m.copyWith()).toList();
      } else {
        if (contentIndex < 0 ||
            contentValueIndex < 0 ||
            contentIndex >= state.files![state.fileIndex].definitionContents.length ||
            contentValueIndex >= state.files![state.fileIndex].definitionContents[contentIndex].value.length) {
          log.warning("setContentValue rejected: contentIndex=$contentIndex or contentValueIndex=$contentValueIndex out of range (definitionContents)");
          NotificationService.showError(message: l10n.file_not_found);
          return false;
        }
        contents = tempFile.definitionContents.map((m) => m.copyWith()).toList();
      }

      // Update
      contents[contentIndex].value[contentValueIndex] = value;
      log.debug("setContentValue updated value at contentIndex=$contentIndex, contentValueIndex=$contentValueIndex");

      ApiCallResult<dynamic> result;
      if (state.isTerm) {
        result = await _updateLeaf(id: tempFile.id, termContents: contents, successMessage: l10n.content_value_set_success);
      } else {
        result = await _updateLeaf(id: tempFile.id, definitionContents: contents, successMessage: l10n.content_value_set_success);
      }
      if (result.isFailure) {
        log.warning("setContentValue rejected: request failed for fileId=${tempFile.id}");
        NotificationService.showError(context: rootContext!, message: l10n.content_value_set_failed);
        return false;
      }

      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }

      state = state.copyWith();

      log.info("setContentValue succeeded: fileId=${tempFile.id}, contentIndex=$contentIndex, contentValueIndex=$contentValueIndex");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.setContentValue throws an error", e, st);
      NotificationService.showError(context: rootContext!, message: l10n.content_value_set_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.setContentValue call ended");
    }
  }

  Future<bool> addContentValue(String value, int contentIndex) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.addContentValue is called...");
      log.debug("addContentValue input: contentIndex=$contentIndex, isTerm=${state.isTerm}");

      if (state.files == null) {
        log.warning("addContentValue rejected: no files loaded in state");
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
      log.debug("addContentValue appended value at contentIndex=$contentIndex, new value length=${contents[contentIndex].value.length}");

      ApiCallResult<dynamic> result;
      if (state.isTerm) {
        result = await _updateLeaf(id: tempFile.id, termContents: contents, successMessage: l10n.content_value_add_success);
      } else {
        result = await _updateLeaf(id: tempFile.id, definitionContents: contents, successMessage: l10n.content_value_add_success);
      }
      if (result.isFailure) {
        log.warning("addContentValue rejected: request failed for fileId=${tempFile.id}, contentIndex=$contentIndex");
        NotificationService.showError(context: rootContext!, message: l10n.content_value_add_failed);
        return false;
      }

      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }

      state = state.copyWith();

      log.info("addContentValue succeeded: fileId=${tempFile.id}, contentIndex=$contentIndex");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.addContentValue throws an error", e, st);
      NotificationService.showError(context: rootContext!, message: l10n.content_value_add_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.addContentValue call ended");
    }
  }

  Future<bool> removeContentValue(int contentIndex, int valueIndex) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.removeContentValue is called...");
      log.debug("removeContentValue input: contentIndex=$contentIndex, valueIndex=$valueIndex, isTerm=${state.isTerm}");

      if (state.files == null) {
        log.warning("removeContentValue rejected: no files loaded in state");
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
      log.debug(
        "removeContentValue removed value at contentIndex=$contentIndex, valueIndex=$valueIndex, new value length=${contents[contentIndex].value.length}",
      );

      ApiCallResult<dynamic> result;
      if (state.isTerm) {
        result = await _updateLeaf(id: tempFile.id, termContents: contents, successMessage: l10n.content_value_remove_success);
      } else {
        result = await _updateLeaf(id: tempFile.id, definitionContents: contents, successMessage: l10n.content_value_remove_success);
      }
      if (result.isFailure) {
        log.warning("removeContentValue rejected: request failed for fileId=${tempFile.id}, contentIndex=$contentIndex");
        NotificationService.showError(context: rootContext!, message: l10n.content_value_remove_failed);
        return false;
      }

      if (state.isTerm) {
        state.files![state.fileIndex].termContents = contents;
      } else {
        state.files![state.fileIndex].definitionContents = contents;
      }

      state = state.copyWith();

      log.info("removeContentValue succeeded: fileId=${tempFile.id}, contentIndex=$contentIndex, valueIndex=$valueIndex");
      return true;
    } catch (e, st) {
      log.error("FoldersAndFiles.removeContentValue throws an error", e, st);
      NotificationService.showError(context: rootContext!, message: l10n.content_value_remove_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.removeContentValue call ended");
    }
  }

  Future<bool> moveContent(int fromIndex, int toIndex) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.moveContent is called...");
      log.debug("moveContent input: fromIndex=$fromIndex, toIndex=$toIndex, isTerm=${state.isTerm}");

      if (toIndex < 0 || fromIndex < 0) {
        log.warning("moveContent rejected: invalid index provided (fromIndex=$fromIndex, toIndex=$toIndex)");
        NotificationService.showError(message: l10n.content_move_failed);
        return false;
      }

      if (state.files == null || state.files!.isEmpty) {
        log.warning("moveContent rejected: no files loaded in state");
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

      final file = state.files![state.fileIndex].copyWith();

      final contents = state.isTerm ? file.termContents : file.definitionContents;

      if (toIndex > contents.length || fromIndex >= contents.length) {
        log.warning("moveContent rejected: invalid index provided (fromIndex=$fromIndex, toIndex=$toIndex, length=${contents.length})");
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

      final fromContent = contents.removeAt(fromIndex).copyWith();

      if (toIndex > fromIndex) toIndex--; // because one item is removed, therefor the total length is reduced by one.

      contents.insert(toIndex, fromContent);
      log.debug("moveContent reordered: fromIndex=$fromIndex, resolvedToIndex=$toIndex, fileId=${file.id}");

      final result = await setFile(file);
      log.info("moveContent ${result ? 'succeeded' : 'failed'}: fileId=${file.id}, fromIndex=$fromIndex, toIndex=$toIndex");
      return result;
    } catch (e, st) {
      log.error("FoldersAndFiles.moveContent throws an error", e, st);
      NotificationService.showError(message: l10n.content_move_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.moveContent call ended");
    }
  }

  Future<bool> moveContentValue(int contentIndex, int fromIndex, int toIndex) async {
    AppLocalizations l10n = AppLocalizations.of(rootContext!)!;
    final log = Talker();

    try {
      log.info("FoldersAndFiles.moveContentValue is called...");
      log.debug("moveContentValue input: contentIndex=$contentIndex, fromIndex=$fromIndex, toIndex=$toIndex, isTerm=${state.isTerm}");

      if (contentIndex < 0 || toIndex < 0 || fromIndex < 0) {
        log.warning("moveContentValue rejected: invalid index provided (contentIndex=$contentIndex, fromIndex=$fromIndex, toIndex=$toIndex)");
        NotificationService.showError(message: l10n.content_move_failed);
        return false;
      }

      if (state.files == null || state.files!.isEmpty) {
        log.warning("moveContentValue rejected: no files loaded in state");
        NotificationService.showError(message: l10n.files_not_found);
        return false;
      }

      final file = state.files![state.fileIndex].copyWith();

      final contents = state.isTerm ? file.termContents : file.definitionContents;

      if (contentIndex >= contents.length) {
        log.warning("moveContentValue rejected: content not found (contentIndex=$contentIndex, length=${contents.length})");
        NotificationService.showError(message: l10n.content_not_found);
        return false;
      }

      final content = contents[contentIndex];

      if (toIndex > content.value.length || fromIndex >= content.value.length) {
        log.warning("moveContentValue rejected: content value not found (fromIndex=$fromIndex, toIndex=$toIndex, length=${content.value.length})");
        NotificationService.showError(message: l10n.content_not_found);
        return false;
      }

      final fromContentValue = content.value.removeAt(fromIndex);

      if (toIndex > fromIndex) toIndex--; // because one item is removed, therefor the total length is reduced by one.

      content.value.insert(toIndex, fromContentValue);
      log.debug("moveContentValue reordered: contentIndex=$contentIndex, fromIndex=$fromIndex, resolvedToIndex=$toIndex, fileId=${file.id}");

      final result = await setFile(file);
      log.info("moveContentValue ${result ? 'succeeded' : 'failed'}: fileId=${file.id}, contentIndex=$contentIndex, fromIndex=$fromIndex, toIndex=$toIndex");
      return result;
    } catch (e, st) {
      log.error("FoldersAndFiles.moveContentValue throws an error", e, st);
      NotificationService.showError(message: l10n.content_move_failed);
      return false;
    } finally {
      log.info("FoldersAndFiles.moveContentValue call ended");
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
    final log = Talker();
    log.info('FoldersAndFiles._updateLeaf is called...');

    final Map<String, dynamic> data = {'_id': id};
    if (title != null) data['title'] = title;
    if (treeNodeId != null) data['treeNodeId'] = treeNodeId;
    if (termContents != null) data['termContents'] = termContents.map((c) => c.toJson()).toList();
    if (definitionContents != null) data['definitionContents'] = definitionContents.map((c) => c.toJson()).toList();

    log.debug('_updateLeaf input data: ${jsonEncode(data)}');

    final result = await apiCall(() {
      final dio = _authDio.patch("/api/leaf/", data: {"leaf": data});

      if (successMessage != null) dio.notifyOnSuccess(successMessage);

      return dio;
    });

    if (result.isFailure) {
      log.warning('_updateLeaf request failed for id=$id');
    } else {
      log.debug('_updateLeaf request succeeded for id=$id');
    }

    log.info('FoldersAndFiles._updateLeaf call ended');
    return result;
  }
}

final foldersAndFilesProvider = NotifierProvider<FoldersAndFiles, FoldersAndFilesState>(FoldersAndFiles.new);
