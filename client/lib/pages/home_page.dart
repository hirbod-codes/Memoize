import 'dart:async';

import 'package:client/api/folder_controller.dart';
import 'package:client/api/leaf_controller.dart';
import 'package:client/api/models/folder.dart';
import 'package:client/api/models/leaf.dart';
import 'package:client/api/providers/folders_and_files.dart';
import 'package:client/components/button.dart';
import 'package:client/components/dialogs/folder_file_create_dialog.dart';
import 'package:client/components/file_manager.dart';
import 'package:client/components/global/notification_service.dart';
import 'package:client/theme/theme_colors.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;

    if (width < 600) {
      return const MobileHomePage();
    }

    // Tablet
    if (width < 1024) {
      return const MobileHomePage();
    }

    return MobileHomePage();
  }
}

enum Filter { folder, file }

class MobileHomePage extends ConsumerStatefulWidget {
  const MobileHomePage({super.key});

  @override
  ConsumerState<MobileHomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<MobileHomePage> {
  final TextEditingController _searchController = TextEditingController();
  Filter _filter = Filter.folder;

  int _folderSkip = 0;
  int _fileSkip = 0;
  bool _hasMore = true;

  Timer? _debouncer;
  String _search = '';

  bool _fetching = false;
  bool _adding = false;

  String? _title;

  final List<String> _location = ['root'];

  bool _editing = false;

  int _deletingFolder = -1;
  int _deletingFile = -1;

  @override
  void dispose() {
    _debouncer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();

    // Runs once when the widget is inserted
    _initialize();
  }

  Future<void> _initialize() async {
    await _paginate(reset: true);
  }

  void _resetSearch() {
    _debouncer?.cancel();
    _search = '';
    _searchController.clear();
    _hasMore = true;
  }

  Future<void> _previousLocation() async {
    if (_location.length < 2) return;

    setState(() {
      _fetching = true;
    });

    final lastId = _location.elementAt(_location.length - 2);
    if (lastId == 'root') {
      await _paginate(reset: true, filter: Filter.folder);

      if (!mounted) return;
      setState(() {
        _location.removeLast();
        _title = null;
        ref.read(foldersAndFilesProvider.notifier).setFiles([]);
        _filter = Filter.folder;
        _resetSearch();
      });
    } else {
      final folderController = ref.read(folderControllerProvider);
      final folder = await folderController.getMany(ids: [lastId]);
      await _paginate(parentId: lastId, reset: true);

      if (!mounted) return;
      setState(() {
        _title = folder[0].title;
        _location.removeLast();
        _resetSearch();
      });
    }
  }

  Future<void> _nextLocation(Folder parentFolder) async {
    setState(() {
      _fetching = true;
    });

    await _paginate(parentId: parentFolder.id, reset: true);

    if (!mounted) return;
    setState(() {
      _title = parentFolder.title;
      _location.add(parentFolder.id);
      _fetching = false;
      _search = '';
    });
  }

  void _onSearchChange(String value) {
    setState(() {
      _search = value;
    });

    _debouncer = Timer(Duration(milliseconds: 700), () {
      _paginate(search: value, reset: true);
    });
  }

  Future<void> _paginate({String? search, int limit = 10, String? parentId, bool reset = false, Filter? filter}) async {
    if (!reset && !_hasMore) return;

    try {
      filter = filter ?? _filter;

      setState(() {
        _fetching = true;
      });

      if (_location.length == 1 || filter == Filter.folder) {
        final folderController = ref.read(folderControllerProvider);

        final folders = await folderController.getPaginated(limit: limit, parentId: parentId, skip: reset ? 0 : _folderSkip, search: search);
        if (!mounted) return;

        setState(() {
          _hasMore = folders.length >= limit;

          if (reset) {
            _folderSkip = folders.length;
            ref.read(foldersAndFilesProvider.notifier).setFolders(folders);
          } else {
            _folderSkip = folders.length + _folderSkip;
            ref.read(foldersAndFilesProvider.notifier).setFolders([...(ref.read(foldersAndFilesProvider).folders ?? []), ...folders]);
          }
        });
      } else if (filter == Filter.file) {
        final fileController = ref.read(leafControllerProvider);

        final files = await fileController.getPaginated(limit: limit, parentId: parentId!, skip: reset ? 0 : _fileSkip, search: search);
        if (!mounted) return;

        setState(() {
          _hasMore = files.length >= limit;

          if (reset) {
            _fileSkip = files.length;
            ref.read(foldersAndFilesProvider.notifier).setFiles(files);
          } else {
            _fileSkip = files.length + _fileSkip;
            ref.read(foldersAndFilesProvider.notifier).setFiles([...(ref.read(foldersAndFilesProvider).files ?? []), ...files]);
          }
        });
      }
    } catch (e, st) {
      Talker().error('The _paginate method in HomePage widget throws an error.', e, st);
    } finally {
      if (mounted) {
        setState(() {
          _fetching = false;
        });
      }
    }
  }

  Future<void> _paginateMore() async {
    await _paginate(search: _search, parentId: _location.last == 'root' ? null : _location.last);
  }

  Future<void> _onFilterChange(Filter filter) async {
    if (_location.length < 2) return;

    final lastId = _location.last;
    if (lastId == 'root') return;

    setState(() {
      _fetching = true;
      _filter = filter;
    });

    await _paginate(parentId: lastId, reset: true);

    if (!mounted) return;
    setState(() {
      _resetSearch();
    });
  }

  Future<void> _removeFolder(Folder folder, int index) async {
    final folderController = ref.read(folderControllerProvider);

    setState(() {
      _deletingFolder = index;
    });
    await folderController.delete(id: folder.id);
    if (!mounted) return;

    setState(() {
      _deletingFolder = -1;
      ref.read(foldersAndFilesProvider.notifier).removeFolderById(folder.id);
    });
  }

  Future<void> _removeFile(Leaf file, int index) async {
    final fileController = ref.read(leafControllerProvider);

    setState(() {
      _deletingFile = index;
    });
    await fileController.delete(id: file.id);
    if (!mounted) return;

    setState(() {
      _deletingFile = -1;
      ref.read(foldersAndFilesProvider.notifier).removeFileById(file.id);
    });
  }

  Future<void> _addNew() async {
    if (_adding) return;

    FoldersAndFilesStateResponse? result;
    try {
      setState(() {
        _adding = true;
      });

      String? title = await showDialog(
        context: context,
        builder: (builderContext) {
          return FolderFileCreateDialog();
        },
      );
      if (title == null) return;

      FoldersAndFiles p = ref.watch(foldersAndFilesProvider.notifier);
      if (_location.last == 'root' || _filter == Filter.folder) {
        result = await p.addFolder(title, _location.last == 'root' ? null : _location.last);
      } else {
        result = await p.addFile(title, _location.last);
      }
    } catch (e, st) {
      Talker().error('The _addNew method in HomePage widget throws an error.', e, st);
    } finally {
      if (mounted) {
        if (result?.status == FoldersAndFilesStateResponseStatus.failure) {
          NotificationService.showError(context: context, message: result?.message ?? 'Failure while trying to add one ${_filter == Filter.folder ? 'folder' : 'file'}.');
        }
        if (result?.status == FoldersAndFilesStateResponseStatus.success) {
          NotificationService.showSuccess(context: context, message: 'Successfully added one ${_filter == Filter.folder ? 'folder' : 'file'}.');
        }
        setState(() {
          _adding = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    FoldersAndFiles p = ref.watch(foldersAndFilesProvider.notifier);
    FoldersAndFilesState pState = ref.watch(foldersAndFilesProvider);
    final folders = pState.folders ?? [];
    final files = pState.files;

    return Card(
      elevation: 10,
      color: theme.surfaceContainer,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top Buttons
            Row(
              mainAxisAlignment: _location.length > 1 ? MainAxisAlignment.spaceBetween : MainAxisAlignment.end,
              children: [
                // Back Button
                if (_location.length > 1) ...[Button(type: ButtonType.text, iconSize: 28, isLoading: _fetching, icon: Icons.chevron_left, onPressed: _previousLocation)],
                // Edit Button
                Button(
                  type: ButtonType.text,
                  iconSize: 24,
                  icon: _editing ? Icons.remove_red_eye_outlined : Icons.edit_square,
                  onPressed: () {
                    setState(() {
                      _editing = !_editing;
                    });
                  },
                ),
              ],
            ),

            if (_title != null) ...[Text(_title!), Divider(height: 1, color: theme.outlineVariant), const SizedBox(height: 8)],

            // Search
            TextField(
              controller: _searchController,
              decoration: const InputDecoration(labelText: 'Search', prefixIcon: Icon(Icons.search)),
              onChanged: _onSearchChange,
            ),

            const SizedBox(height: 16),

            // Add new Button
            if (_editing) Button(type: ButtonType.elevated, color: ThemeColorName.success, icon: Icons.add, label: 'Add New', onPressed: _addNew, isLoading: _adding),

            // Tabs
            if (_location.length > 1) ...[
              const SizedBox(height: 8),

              Container(
                decoration: BoxDecoration(
                  border: BoxBorder.fromLTRB(bottom: BorderSide(width: 1, color: theme.outlineVariant)),
                ),
                child: Row(
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        border: _filter == Filter.folder ? BoxBorder.fromLTRB(bottom: BorderSide(width: 5, color: theme.primary)) : BoxBorder.fromLTRB(bottom: BorderSide(width: 5, color: Colors.transparent)),
                      ),
                      child: Button(
                        label: 'Folders',
                        width: 100,
                        height: 40,
                        radius: 0,
                        type: ButtonType.text,
                        color: _filter == Filter.folder ? ThemeColorName.primary : ThemeColorName.onSurface,
                        onPressed: () {
                          _onFilterChange(Filter.folder);
                        },
                      ),
                    ),

                    Container(
                      decoration: BoxDecoration(
                        border: _filter == Filter.file ? BoxBorder.fromLTRB(bottom: BorderSide(width: 5, color: theme.primary)) : BoxBorder.fromLTRB(bottom: BorderSide(width: 5, color: Colors.transparent)),
                      ),
                      child: Button(
                        label: 'Files',
                        width: 100,
                        height: 40,
                        radius: 0,
                        type: ButtonType.text,
                        color: _filter == Filter.file ? ThemeColorName.primary : ThemeColorName.onSurface,
                        onPressed: () {
                          _onFilterChange(Filter.file);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ],

            Expanded(
              child: ListView(
                children: [
                  // Circular progress indicator
                  if (_fetching)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [SizedBox(width: 48, height: 48, child: CircularProgressIndicator(strokeWidth: 2, color: theme.primary))],
                    ),

                  // Folders list
                  if (!_fetching)
                    if (_location.length == 1 || _filter == Filter.folder)
                      ListView.builder(
                        shrinkWrap: true,
                        physics: NeverScrollableScrollPhysics(),
                        itemCount: folders.length,
                        itemBuilder: (context, index) => Card(
                          clipBehavior: Clip.hardEdge,
                          child: InkWell(
                            onTap: () {
                              _nextLocation(folders[index]);
                            },
                            child: Padding(
                              padding: EdgeInsetsGeometry.all(8),
                              child: ListTile(
                                title: Text(folders[index].title),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (_editing) ...[
                                      Button(
                                        isLoading: _deletingFolder == index,
                                        type: ButtonType.text,
                                        color: ThemeColorName.error,
                                        icon: Icons.remove_circle_outline,
                                        onPressed: () {
                                          _removeFolder(folders[index], index);
                                        },
                                      ),
                                    ],
                                    Button(type: ButtonType.text, color: ThemeColorName.primary, icon: Icons.chevron_right),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),

                  // Files list
                  if (!_fetching)
                    if (_location.length > 1 && _filter == Filter.file && files != null && files.isNotEmpty)
                      ListView.builder(
                        shrinkWrap: true,
                        physics: NeverScrollableScrollPhysics(),
                        itemCount: files.length,
                        itemBuilder: (context, index) {
                          final file = files[index];
                          return Card(
                            clipBehavior: Clip.hardEdge,
                            child: InkWell(
                              onTap: () {
                                p.setFileIndex(index);
                                showDialog(
                                  context: context,
                                  barrierDismissible: true,
                                  builder: (_) => FileManager(
                                    file: file,
                                    onClose: () {
                                      Navigator.of(context).pop();
                                    },
                                  ),
                                );
                              },
                              child: Padding(
                                padding: EdgeInsetsGeometry.all(5),
                                child: ListTile(
                                  title: Text(file.title),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (_editing) ...[
                                        Button(
                                          isLoading: _deletingFile == index,
                                          type: ButtonType.text,
                                          color: ThemeColorName.error,
                                          icon: Icons.remove_circle_outline,
                                          onPressed: () {
                                            _removeFile(file, index);
                                          },
                                        ),
                                      ],
                                      Button(type: ButtonType.text, color: ThemeColorName.primary, icon: Icons.chevron_right),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                ],
              ),
            ),

            if (_hasMore)
              Button(
                label: 'Load More',
                type: ButtonType.outlined,
                color: ThemeColorName.secondary,
                onPressed: () {
                  _paginateMore();
                },
              ),
          ],
        ),
      ),
    );
  }
}
