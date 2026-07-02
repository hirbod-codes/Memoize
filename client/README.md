# Client

A new Flutter project.

## Run

```bash
flutter run -d windows --dart-define=API_URL=https://api.example.com --dart-define=ENV=prod
flutter run -d windows --dart-define=API_URL=https://api.example.com --dart-define=ENV=dev
```

## Run it once after each `flutter pub get`

```bash
dart run scripts/patch_media_kit.dart
```

## Run after change in video_player_provider.dart file run

```bash
dart run build_runner build
```

or:

```bash
dart run build_runner watch --delete-conflicting-outputs
```
