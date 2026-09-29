// import 'package:client/api/dio/dio_providers.dart';
// import 'package:client/l10n/app_localizations.dart';
// import 'package:dio/dio.dart';
// import 'package:flutter/material.dart';
// import 'package:flutter_riverpod/flutter_riverpod.dart';
// import 'package:go_router/go_router.dart';

// enum _PaymentResultStatus { loading, success, failure }

// class PaymentResultPage extends ConsumerStatefulWidget {
//   final String uuid;

//   const PaymentResultPage({super.key, required this.uuid});

//   @override
//   ConsumerState<PaymentResultPage> createState() => _PaymentResultPageState();
// }

// class _PaymentResultPageState extends ConsumerState<PaymentResultPage> {
//   Dio get _authDio => ref.read(authDioProvider);

//   _PaymentResultStatus _status = _PaymentResultStatus.loading;
//   String? _errorCode;

//   @override
//   void initState() {
//     super.initState();
//     _checkPaymentStatus();
//   }

//   Future<void> _checkPaymentStatus() async {
//     try {
//       final response = await _authDio.get(
//         '/endpoint',
//         queryParameters: {'uuid': widget.uuid},
//         // 2xx is treated as success, 4xx/5xx won't throw here so we can
//         // read the error_code out of the body ourselves below.
//         options: Options(validateStatus: (code) => code != null && code < 500),
//       );

//       if (!mounted) return;

//       final statusCode = response.statusCode ?? 0;

//       if (statusCode >= 200 && statusCode < 300) {
//         setState(() => _status = _PaymentResultStatus.success);
//         return;
//       }

//       final body = response.data;
//       final errorCode = body is Map ? body['error_code'] as String? : null;

//       setState(() {
//         _status = _PaymentResultStatus.failure;
//         _errorCode = errorCode;
//       });
//     } catch (e) {
//       if (!mounted) return;
//       setState(() {
//         _status = _PaymentResultStatus.failure;
//         _errorCode = null;
//       });
//     }
//   }

//   @override
//   Widget build(BuildContext context) {
//     final l10n = AppLocalizations.of(context)!;

//     return Scaffold(
//       body: SafeArea(
//         child: Center(
//           child: Padding(
//             padding: const EdgeInsets.all(24),
//             child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 420), child: _buildBody(context, l10n)),
//           ),
//         ),
//       ),
//     );
//   }

//   Widget _buildBody(BuildContext context, AppLocalizations l10n) {
//     switch (_status) {
//       case _PaymentResultStatus.loading:
//         return const Column(mainAxisSize: MainAxisSize.min, children: [CircularProgressIndicator()]);

//       case _PaymentResultStatus.success:
//         return _buildSuccess(context, l10n);

//       case _PaymentResultStatus.failure:
//         return _buildFailure(context, l10n);
//     }
//   }

//   Widget _buildSuccess(BuildContext context, AppLocalizations l10n) {
//     return Column(
//       mainAxisSize: MainAxisSize.min,
//       children: [
//         Icon(Icons.check_circle, color: Colors.green, size: 64),
//         const SizedBox(height: 16),
//         Text(l10n.payment_result_success_title, style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
//         const SizedBox(height: 8),
//         Text(l10n.payment_result_open_app_hint, style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
//         const SizedBox(height: 24),
//         FilledButton(onPressed: () => context.go('/'), child: Text(l10n.payment_result_go_home)),
//       ],
//     );
//   }

//   Widget _buildFailure(BuildContext context, AppLocalizations l10n) {
//     return Column(
//       mainAxisSize: MainAxisSize.min,
//       children: [
//         Icon(Icons.error, color: Theme.of(context).colorScheme.error, size: 64),
//         const SizedBox(height: 16),
//         Text(l10n.payment_result_failure_title, style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
//         if (_errorCode != null) ...[
//           const SizedBox(height: 8),
//           Text(_describeErrorCode(l10n, _errorCode!), style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
//         ],
//         const SizedBox(height: 24),
//         FilledButton(onPressed: () => context.go('/'), child: Text(l10n.payment_result_go_home)),
//       ],
//     );
//   }

//   String _describeErrorCode(AppLocalizations l10n, String code) {
//     switch (code) {
//       case 'UUID_NOT_FOUND':
//         return l10n.payment_result_error_uuid_not_found;
//       default:
//         return l10n.payment_result_error_unknown;
//     }
//   }
// }
