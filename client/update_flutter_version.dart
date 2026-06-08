// tool/update_version.dart
import 'dart:io';

void main(List<String> args) {
  final version = args[0];
  final build = args[1];

  final file = File('pubspec.yaml');
  final content = file.readAsStringSync();

  file.writeAsStringSync(content.replaceFirst(RegExp(r'^version:.*$', multiLine: true), 'version: $version+$build'));
}
