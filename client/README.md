# Client

A new Flutter project.

## To develop

### Run after change in video_player_provider.dart file run

```bash
dart run build_runner build
```

or:

```bash
dart run build_runner watch --delete-conflicting-outputs
```

### To use another mirror(CMD)

```bash
setx PUB_HOSTED_URL "https://pub.flutter-io.cn"
setx FLUTTER_STORAGE_BASE_URL "https://storage.flutter-io.cn"
```

to rollback:

```bash
reg delete "HKCU\Environment" /F /V PUB_HOSTED_URL
reg delete "HKCU\Environment" /F /V FLUTTER_STORAGE_BASE_URL
```

### To build

```bash
flutter run -d windows --dart-define=API_URL=https://api.example.com --dart-define=ENV=prod
flutter run -d windows --dart-define=API_URL=https://localhost:3000 --dart-define=ENV=dev
flutter run -d web-server --dart-define=API_URL=https://localhost:3000 --dart-define=ENV=dev
```
