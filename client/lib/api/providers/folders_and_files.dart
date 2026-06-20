import 'package:client/api/models/folder.dart';
import 'package:client/api/models/leaf.dart';
import 'package:client/auth/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FoldersAndFilesState {
  final List<Folder> folders;
  final List<Leaf> files;

  FoldersAndFilesState({required this.folders, required this.files});
}

class FoldersAndFiles extends Notifier<FoldersAndFilesState> {
  late final Dio _authDio;

  @override
  FoldersAndFilesState build() {
    _authDio = ref.watch(authDioProvider);

    return FoldersAndFilesState(files: [], folders: []);
  }

  void setFolders(List<Folder> folders) {
    state = FoldersAndFilesState(files: state.files, folders: folders);
  }

  void addFolder(Folder folder) {
    state.folders.add(folder);
    state = FoldersAndFilesState(files: state.files, folders: state.folders);
  }

  void removeFolder(int index) {
    state.folders.removeAt(index);
    state = FoldersAndFilesState(files: state.files, folders: state.folders);
  }

  void removeFolderById(String id) {
    state.folders.removeWhere((f) => f.id == id);
    state = FoldersAndFilesState(files: state.files, folders: state.folders);
  }

  void setFiles(List<Leaf> files) {
    state = FoldersAndFilesState(files: files, folders: state.folders);
  }

  void removeFile(int index) {
    state.files.removeAt(index);

    state = FoldersAndFilesState(files: state.files, folders: state.folders);
  }

  void removeFileById(String id) {
    state.files.removeWhere((f) => f.id == id);
    state = FoldersAndFilesState(files: state.files, folders: state.folders);
  }

  void addFile(Leaf file) {
    state.files.add(file);
    state = FoldersAndFilesState(files: state.files, folders: state.folders);
  }
}

final foldersAndFilesProvider = NotifierProvider<FoldersAndFiles, FoldersAndFilesState>(FoldersAndFiles.new);
