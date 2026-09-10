import 'models/user_info.dart';

/// Actions for managing an already-authenticated account — distinct
/// from AuthApi (lib/auth/auth_api.dart), which only covers obtaining
/// or losing a session in the first place. Kept as a separate
/// interface/controller rather than piling more methods onto
/// AuthController, which already covers login, signup, and password
/// reset and doesn't need a fourth responsibility.
///
/// None of these endpoint paths are confirmed against your backend —
/// only GET /api/auth/info was given. The implementation
/// (AccountController) proposes paths following your existing
/// /api/auth/email/... and /api/auth/otp/... naming convention; adjust
/// once the real routes exist.
abstract class AccountApi {
  Future<UserInfo> getUserInfo();

  /// Knowing the current password is sufficient proof of identity here
  /// — unlike forgot-password, no OTP step is needed since the user is
  /// already authenticated.
  Future<void> changePassword({required String currentPassword, required String newPassword});

  // Only relevant when UserInfo.authMethod == AuthMethod.email.
  Future<void> requestEmailChange({required String newEmail});
  Future<void> verifyEmailChange({required String newEmail, required String code});

  // Only relevant when UserInfo.authMethod == AuthMethod.phone.
  Future<void> requestPhoneChange({required String newPhone});
  Future<void> verifyPhoneChange({required String newPhone, required String code});
}
