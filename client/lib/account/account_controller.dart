import 'dart:typed_data';

import 'package:client/account/account_api.dart';
import 'package:client/account/models/user_info.dart';
import 'package:client/api/api_call_extensions.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Plain service object, not a Notifier — it holds no state of its own.
/// Loading/error bookkeeping for whichever action is in flight is
/// handled the same way it is on the auth page: by wrapping each call
/// in authActionControllerProvider.run() at the call site.
class AccountController implements AccountApi {
  final Dio _authDio;

  AccountController(this._authDio);

  @override
  Future<UserInfo> getUserInfo() async {
    final response = await _authDio.get('/api/auth/info');
    return UserInfo.fromJson(response.unwrapData<Map<String, dynamic>>());
  }

  /// Endpoint guessed — no avatar route was given anywhere. Returns
  /// null on failure rather than throwing: a broken avatar shouldn't
  /// block startup or force the user back to a login screen the way a
  /// failed getUserInfo() call should.
  Future<Uint8List?> fetchAvatar(String avatarKey) async {
    try {
      final response = await _authDio.get('/api/avatar/$avatarKey', options: Options(responseType: ResponseType.bytes));
      return Uint8List.fromList(response.data as List<int>);
    } on DioException {
      return null;
    }
  }

  @override
  Future<void> changePassword({required String currentPassword, required String newPassword}) async {
    await _authDio
        .post('/api/auth/email/change-password', data: {'currentPassword': currentPassword, 'newPassword': newPassword})
        .notifyOnSuccess('Password updated.');
  }

  @override
  Future<void> requestEmailChange({required String newEmail}) async {
    await _authDio.post('/api/auth/email/change', data: {'newEmail': newEmail}).notifyOnSuccess('Verification code sent to your new email.');
  }

  @override
  Future<void> verifyEmailChange({required String newEmail, required String code}) async {
    await _authDio.post('/api/auth/email/change/verify', data: {'newEmail': newEmail, 'code': code}).notifyOnSuccess('Email updated.');
  }

  @override
  Future<void> requestPhoneChange({required String newPhone}) async {
    await _authDio.post('/api/auth/otp/change/request', data: {'phoneNumber': newPhone}).notifyOnSuccess('Code sent to your new number.');
  }

  @override
  Future<void> verifyPhoneChange({required String newPhone, required String code}) async {
    await _authDio.post('/api/auth/otp/change/verify', data: {'phoneNumber': newPhone, 'code': code}).notifyOnSuccess('Phone number updated.');
  }
}

final accountControllerProvider = Provider<AccountController>((ref) {
  return AccountController(ref.watch(authDioProvider));
});

final userInfoProvider = FutureProvider.autoDispose<UserInfo>((ref) async {
  final account = ref.watch(accountControllerProvider);
  return account.getUserInfo();
});

/// Written once by AuthController._onAuthenticated() during startup —
/// nothing else should call getUserInfo()/fetchAvatar() again just to
/// populate this; read it, don't re-fetch it.
class AvatarBytesNotifier extends Notifier<Uint8List?> {
  @override
  Uint8List? build() => null;

  void set(Uint8List? bytes) => state = bytes;
}

final avatarBytesProvider = NotifierProvider<AvatarBytesNotifier, Uint8List?>(AvatarBytesNotifier.new);
