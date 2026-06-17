import 'package:client/components/contents/players/player_interface.dart';
import 'web_video_player.dart';

AppVideoPlayer createPlatformPlayer() => WebVideoPlayer();
