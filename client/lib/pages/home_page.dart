import 'dart:async';

import 'package:client/api/folder_controller.dart';
import 'package:client/api/leaf_controller.dart';
import 'package:client/api/models/folder.dart';
import 'package:client/api/models/leaf.dart';
import 'package:client/auth/token_storage.dart';
import 'package:client/components/button.dart';
import 'package:client/components/file_manager.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  Filter _filter = .folder;

  int _folderSkip = 0;
  int _fileSkip = 0;
  bool _hasMore = true;

  Timer? _debouncer;
  String _search = '';

  bool _fetching = false;

  String? _title;

  final List<String> _location = ['root'];

  List<Folder> _folders = [];
  List<Leaf>? _files;

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
    await _paginate();
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
      await _paginate(reset: true);

      if (!mounted) return;
      setState(() {
        _location.removeLast();
        _title = null;
        _files = [];
        _filter = .folder;
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

    _debouncer = Timer(.new(milliseconds: 700), () {
      _paginate(search: value, reset: true);
    });
  }

  Future<void> _paginate({String? search, int limit = 2, String? parentId, bool reset = false, Filter? filter}) async {
    if (!reset && !_hasMore) return;

    filter = filter ?? _filter;

    setState(() {
      _fetching = true;
    });

    if (_location.length == 1 || filter == .folder) {
      final folderController = ref.read(folderControllerProvider);

      final folders = await folderController.getPaginated(limit: limit, parentId: parentId, skip: reset ? 0 : _folderSkip, search: search);

      // to avoid exceptions if the user navigates away before the request completes.
      if (!mounted) return;

      setState(() {
        _fetching = false;

        _hasMore = folders.length >= limit;

        if (reset) {
          _folderSkip = folders.length;
          _folders = folders;
        } else {
          _folderSkip = folders.length + _folderSkip;
          _folders = [..._folders, ...folders];
        }
      });
    } else if (filter == .file) {
      final fileController = ref.read(leafControllerProvider);

      final files = await fileController.getPaginated(limit: limit, parentId: parentId!, skip: reset ? 0 : _fileSkip, search: search);

      if (!mounted) return;

      setState(() {
        _fetching = false;

        _hasMore = files.length >= limit;

        if (reset) {
          _fileSkip = files.length;
          _files = files;
        } else {
          _fileSkip = files.length + _fileSkip;
          _files = [...(_files ?? []), ...files];
        }
      });
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
      _folders = _folders.where((w) => w.id != folder.id).toList();
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
      _files = _files?.where((w) => w.id != file.id).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    return Card(
      elevation: 10,
      color: theme.surfaceContainer,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          mainAxisAlignment: .center,
          crossAxisAlignment: .stretch,
          children: [
            // Buttons
            Row(
              mainAxisAlignment: _location.length > 1 ? .spaceBetween : .end,
              children: [
                if (_location.length > 1) ...[Button(type: .text, iconSize: 28, isLoading: _fetching, icon: Icons.chevron_left, onPressed: _previousLocation)],
                Button(
                  type: .text,
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

            if (_location.length > 1) ...[
              const SizedBox(height: 8),

              // Tabs
              Container(
                decoration: BoxDecoration(
                  border: .fromLTRB(bottom: .new(width: 1, color: theme.outlineVariant)),
                ),
                child: Row(
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        border: _filter == .folder ? .fromLTRB(bottom: .new(width: 5, color: theme.primary)) : .fromLTRB(bottom: .new(width: 5, color: Colors.transparent)),
                      ),
                      child: Button(
                        label: 'Folders',
                        width: 100,
                        height: 40,
                        radius: 0,
                        type: .text,
                        color: _filter == .folder ? .primary : .onSurface,
                        onPressed: () {
                          _onFilterChange(.folder);
                        },
                      ),
                    ),

                    Container(
                      decoration: BoxDecoration(
                        border: _filter == .file ? .fromLTRB(bottom: .new(width: 5, color: theme.primary)) : .fromLTRB(bottom: .new(width: 5, color: Colors.transparent)),
                      ),
                      child: Button(
                        label: 'Files',
                        width: 100,
                        height: 40,
                        radius: 0,
                        type: .text,
                        color: _filter == .file ? .primary : .onSurface,
                        onPressed: () {
                          _onFilterChange(.file);
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
                      mainAxisAlignment: .center,
                      children: [SizedBox(width: 48, height: 48, child: CircularProgressIndicator(strokeWidth: 2, color: theme.primary))],
                    ),

                  // Folders list
                  if (!_fetching)
                    if (_location.length == 1 || _filter == .folder)
                      ListView.builder(
                        shrinkWrap: true,
                        physics: NeverScrollableScrollPhysics(),
                        itemCount: _folders.length,
                        itemBuilder: (context, index) => Card(
                          clipBehavior: Clip.hardEdge,
                          child: InkWell(
                            onTap: () {
                              _nextLocation(_folders[index]);
                            },
                            child: Padding(
                              padding: .all(8),
                              child: ListTile(
                                title: Text(_folders[index].title),
                                trailing: Row(
                                  mainAxisSize: .min,
                                  children: [
                                    if (_editing) ...[
                                      Button(
                                        isLoading: _deletingFolder == index,
                                        type: .text,
                                        color: .error,
                                        icon: Icons.remove_circle_outline,
                                        onPressed: () {
                                          _removeFolder(_folders[index], index);
                                        },
                                      ),
                                    ],
                                    Button(type: .text, color: .primary, icon: Icons.chevron_right),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),

                  // Files list
                  if (!_fetching)
                    if (_location.length > 1 && _filter == .file && _files != null && _files!.isNotEmpty)
                      ListView.builder(
                        shrinkWrap: true,
                        physics: NeverScrollableScrollPhysics(),
                        itemCount: _files!.length,
                        itemBuilder: (context, index) {
                          final file = _files![index];
                          return Card(
                            clipBehavior: Clip.hardEdge,
                            child: InkWell(
                              onTap: () {
                                showDialog(
                                  context: context,
                                  barrierDismissible: true,
                                  builder: (_) => FileManager(
                                    file: file,
                                    onClose: () {
                                      Navigator.of(context).pop();
                                    },
                                    onFileChanged: (updateFile) {
                                      setState(() {
                                        _files![index] = updateFile;
                                      });
                                    },
                                  ),
                                );
                              },
                              child: Padding(
                                padding: .all(5),
                                child: ListTile(
                                  title: Text(file.title),
                                  trailing: Row(
                                    mainAxisSize: .min,
                                    children: [
                                      if (_editing) ...[
                                        Button(
                                          isLoading: _deletingFile == index,
                                          type: .text,
                                          color: .error,
                                          icon: Icons.remove_circle_outline,
                                          onPressed: () {
                                            _removeFile(file, index);
                                          },
                                        ),
                                      ],
                                      Button(type: .text, color: .primary, icon: Icons.chevron_right),
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
                type: .outlined,
                color: .secondary,
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
