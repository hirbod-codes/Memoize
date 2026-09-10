import 'package:client/auth/models/auth_models.dart';

/// Mirrors /api/auth/info's response shape. Deliberately has no
/// `password` field — even though the backend's validation schema
/// includes one (it's shared with write/insert validation), an info
/// endpoint should never actually send a password or hash back to the
/// client. If yours currently does, that's worth fixing server-side
/// regardless of anything here.
///
/// Reuses AuthMethod from lib/auth/models/auth_models.dart rather than
/// defining a second email/phone enum — same concept, one source of truth.
class UserInfo {
  final String? id;
  final String role;
  final String planTitle;
  final AuthMethod authMethod;
  final String? username;
  final String? phoneNumber;
  final String? email;
  final String? avatarKey;
  final bool temporaryAvatar;

  const UserInfo({
    this.id,
    required this.role,
    required this.planTitle,
    required this.authMethod,
    this.username,
    this.phoneNumber,
    this.email,
    this.avatarKey,
    required this.temporaryAvatar,
  });

  factory UserInfo.fromJson(Map<String, dynamic> json) => UserInfo(
    id: json['_id'] as String?,
    role: json['role'] as String,
    planTitle: json['planTitle'] as String,
    authMethod: json['authMethod'] == 'phone' ? AuthMethod.phone : AuthMethod.email,
    username: json['username'] as String?,
    phoneNumber: json['phoneNumber'] as String?,
    email: json['email'] as String?,
    avatarKey: json['avatarKey'] as String?,
    temporaryAvatar: json['temporaryAvatar'] as bool,
  );
}