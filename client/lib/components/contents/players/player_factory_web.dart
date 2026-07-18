import 'package:client/components/contents/players/player_interface.dart';
import 'hlsjs/web_video_player.dart';

AppVideoPlayer createPlatformPlayer() => HlsWebVideoPlayer();