import 'dart:typed_data';

import 'package:client/account/models/user_info.dart';
import 'package:client/account/models/user_usage.dart';
import 'package:client/api/api_call.dart';
import 'package:client/api/api_call_extensions.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:client/api/root_navigator_key.dart';
import 'package:client/l10n/app_localizations.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

/// Plain service object, not a Notifier — it holds no state of its own.
/// Loading/error bookkeeping for whichever action is in flight is
/// handled the same way it is on the auth page: by wrapping each call
/// in authActionControllerProvider.run() at the call site.
class AccountController extends Notifier {
  late final Dio _authDio;

  @override
  void build() {
    _authDio = ref.read(authDioProvider);
  }

  Future<UserInfo?> getUserInfo() async {
    final response = await apiCall<UserInfo>(() => _authDio.get('/api/user/info'), fromJson: (data) => UserInfo.fromJson(data));
    return response.dataOrNull;
  }

  Future<UserUsage?> getUserUsage() async {
    final response = await apiCall<UserUsage>(() => _authDio.get('/api/user/usage'), fromJson: (data) => UserUsage.fromJson(data));
    return response.dataOrNull;
  }

  /// Endpoint guessed — no avatar route was given anywhere. Returns
  /// null on failure rather than throwing: a broken avatar shouldn't
  /// block startup or force the user back to a login screen the way a
  /// failed getUserInfo() call should.
  Future<Uint8List?> fetchAvatar() async {
    try {
      final response = await _authDio.get('/api/user/avatar', options: Options(responseType: ResponseType.bytes));
      if (response.data == null) return null;

      return Uint8List.fromList(response.data!);
    } on DioException {
      return null;
    } catch (e, st) {
      Talker().error('caught error in fetchAvatar method of AccountController', e, st);
      return null;
    }
  }

  Future<void> changePassword({required String currentPassword, required String newPassword}) async {
    await apiCall(
      () => _authDio
          .post('/api/auth/email/change-password', data: {'currentPassword': currentPassword, 'newPassword': newPassword})
          .notifyOnSuccess(rootContext == null ? 'Password updated.' : (AppLocalizations.of(rootContext!)?.password_updated ?? 'Password updated.')),
    );
  }

  Future<void> requestEmailChange({required String newEmail}) async {
    await apiCall(
      () => _authDio
          .post('/api/auth/email/change', data: {'newEmail': newEmail})
          .notifyOnSuccess(
            rootContext == null
                ? 'Verification code sent to your new email.'
                : (AppLocalizations.of(rootContext!)?.code_sent_to_email ?? 'Verification code sent to your new email.'),
          ),
    );
  }

  Future<void> verifyEmailChange({required String newEmail, required String code}) async {
    await apiCall(
      () => _authDio
          .post('/api/auth/email/change/verify', data: {'newEmail': newEmail, 'code': code})
          .notifyOnSuccess(rootContext == null ? 'Email updated.' : (AppLocalizations.of(rootContext!)?.email_updated ?? 'Email updated.')),
    );
  }

  Future<void> requestPhoneChange({required String newPhone}) async {
    await apiCall(
      () => _authDio
          .post('/api/auth/otp/change/request', data: {'phoneNumber': newPhone})
          .notifyOnSuccess(
            rootContext == null ? 'Code sent to your new number.' : (AppLocalizations.of(rootContext!)?.code_sent_to_phone ?? 'Code sent to your new number.'),
          ),
    );
  }

  Future<void> verifyPhoneChange({required String newPhone, required String code}) async {
    await apiCall(
      () => _authDio
          .post('/api/auth/otp/change/verify', data: {'phoneNumber': newPhone, 'code': code})
          .notifyOnSuccess(
            rootContext == null ? 'Phone number updated.' : (AppLocalizations.of(rootContext!)?.phone_number_updated ?? 'Phone number updated.'),
          ),
    );
  }
}

/// Written once by AuthController._onAuthenticated() during startup —
/// nothing else should call getUserInfo()/fetchAvatar() again just to
/// populate this; read it, don't re-fetch it.
class AvatarBytesNotifier extends Notifier<Uint8List?> {
  @override
  Uint8List? build() => null;

  void set(Uint8List? bytes) => state = bytes;
}

final avatarBytesProvider = NotifierProvider<AvatarBytesNotifier, Uint8List?>(AvatarBytesNotifier.new);

final accountControllerProvider = NotifierProvider<AccountController, void>(AccountController.new);
