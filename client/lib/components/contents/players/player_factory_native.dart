import 'package:client/components/contents/players/player_interface.dart';
import 'media_kit_player.dart';

AppVideoPlayer createPlatformPlayer() => MediaKitVideoPlayer();
