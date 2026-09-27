import 'package:client/api/api_call.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:client/plan/models/currency_label.dart';
import 'package:client/plan/models/plan.dart'; // for Currency and Plan
import 'package:client/components/global/notification_service.dart';
import 'package:client/l10n/app_localizations.dart';
import 'package:client/pages/plan/currency_formatter.dart';
import 'package:client/subscription/models/subscription.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';
import 'package:url_launcher/url_launcher.dart';

Currency currencyForPaymentMethod(String method) {
  switch (method) {
    case 'zarinpal':
      return Currency.irt;
    case 'zibal':
      return Currency.irr;
    case 'stripe':
      return Currency.usd;
    case 'paypal':
      return Currency.usd;
    default:
      throw ArgumentError('Unknown payment method: $method');
  }
}

Future<void> showCheckoutDialog(BuildContext context, {required Plan plan, Subscription? subscription}) {
  return showDialog(
    context: context,
    builder: (_) => CheckoutDialog(plan: plan, subscription: subscription),
  );
}

class CheckoutDialog extends ConsumerStatefulWidget {
  final Plan plan;
  final Subscription? subscription;

  const CheckoutDialog({super.key, required this.plan, this.subscription});

  @override
  ConsumerState<CheckoutDialog> createState() => _CheckoutDialogState();
}

class _CheckoutDialogState extends ConsumerState<CheckoutDialog> {
  Dio get _authDio => ref.read(authDioProvider);

  bool _loadingMethods = true;
  bool _submitting = false;
  String? _loadError;
  List<String> _methods = [];
  String? _selectedMethod;

  static const int _defaultDurationDays = 30;
  static const int _defaultAdditionalStorageGb = 0;

  late final TextEditingController _durationController;
  late final TextEditingController _additionalStorageController;

  int _durationDays = _defaultDurationDays;
  int _additionalStorageGb = _defaultAdditionalStorageGb;

  String? _durationError;
  String? _additionalStorageError;

  @override
  void initState() {
    super.initState();
    _durationController = TextEditingController(text: _defaultDurationDays.toString());
    _additionalStorageController = TextEditingController(
      text: widget.subscription == null
          ? _defaultAdditionalStorageGb.toString()
          : (widget.subscription!.privileges.storageBytes - widget.plan.privileges.storageBytes).toString(),
    );
    _fetchPaymentMethods();
  }

  @override
  void dispose() {
    _durationController.dispose();
    _additionalStorageController.dispose();
    super.dispose();
  }

  Currency? get _selectedCurrency => _selectedMethod == null ? null : currencyForPaymentMethod(_selectedMethod!);

  double? get _totalPriceRawPerMonth {
    final currency = _selectedCurrency;
    if (currency == null) return null;
    return widget.plan.price.forCurrency(currency);
  }

  Future<void> _fetchPaymentMethods() async {
    try {
      setState(() {
        _loadingMethods = true;
        _loadError = null;
      });

      final result = await apiCall(() => _authDio.get('/api/subscription/supported_payment_methods'));

      if (!mounted) return;

      if (result.isFailure || result.dataOrNull == null) {
        setState(() {
          _loadingMethods = false;
          _loadError = AppLocalizations.of(context)!.checkout_load_methods_failed;
        });
        return;
      }

      final raw = (result.dataOrNull!['methods'] as List<dynamic>?) ?? [];
      final methods = raw.cast<String>();

      setState(() {
        _methods = methods;
        _loadingMethods = false;
        _selectedMethod = methods.isNotEmpty ? methods.first : null;
      });
    } catch (e) {
      Talker().error('caught error in _fetchPaymentMethods method of _CheckoutDialogState class', e);
    }
  }

  Future<void> _pay() async {
    final l10n = AppLocalizations.of(context)!;

    if (_submitting || _selectedMethod == null || _totalPriceRawPerMonth == null || _durationError != null || _additionalStorageError != null) {
      return;
    }

    setState(() => _submitting = true);

    try {
      final result = await apiCall(
        () => _authDio.post(
          '/api/subscription/',
          data: {'planTitle': widget.plan.title, 'paymentMethod': _selectedMethod, 'subscriptionDueTSMS': _durationDays, '': _additionalStorageGb},
        ),
      );

      if (!mounted) return;

      if (result.isFailure || result.dataOrNull == null) {
        setState(() => _submitting = false);
        NotificationService.showError(context: context, message: l10n.checkout_pay_failed);
        return;
      }

      final redirectUrl = result.dataOrNull!?['redirectUrl'] as String?;
      if (redirectUrl == null) {
        setState(() => _submitting = false);
        NotificationService.showError(context: context, message: l10n.checkout_pay_failed);
        return;
      }

      final uri = Uri.parse(redirectUrl);
      var launched = false;
      try {
        launched = await launchUrl(
          uri,
          webOnlyWindowName: kIsWeb ? '_blank' : null,
          mode: kIsWeb ? LaunchMode.platformDefault : LaunchMode.externalApplication,
        );
      } catch (_) {
        launched = false;
      }

      if (!launched) {
        NotificationService.showError(context: context, message: l10n.checkout_pay_failed);
        return;
      }

      if (mounted) Navigator.of(context).pop();
    } catch (err) {
      Talker().error('caught error in _pay method of _CheckoutDialogState', err);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(widget.plan.title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(l10n.checkout_title, style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 16),

              _buildDurationPicker(l10n),
              const SizedBox(height: 20),

              _buildAdditionalStorageField(l10n),
              const SizedBox(height: 20),

              Text(l10n.checkout_payment_method, style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              _buildMethodsList(context, l10n),

              const SizedBox(height: 20),
              _buildPriceRow(context, l10n),
              const SizedBox(height: 20),

              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(onPressed: _submitting ? null : () => Navigator.of(context).pop(), child: Text(l10n.checkout_cancel)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed:
                          (_submitting ||
                              _selectedMethod == null ||
                              _totalPriceRawPerMonth == null ||
                              _durationError != null ||
                              _additionalStorageError != null)
                          ? null
                          : _pay,
                      child: _submitting ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : Text(l10n.checkout_pay),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDurationPicker(AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.checkout_duration_days, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 8),
        TextFormField(
          controller: _durationController,
          enabled: !_submitting,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(isDense: true, border: const OutlineInputBorder(), suffixText: l10n.checkout_days_suffix, errorText: _durationError),
          onChanged: (value) {
            final parsed = int.tryParse(value);
            setState(() {
              if (parsed == null || parsed < 1) {
                _durationError = l10n.checkout_duration_invalid;
              } else {
                _durationError = null;
                _durationDays = parsed;
              }
            });
          },
        ),
      ],
    );
  }

  Widget _buildAdditionalStorageField(AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.checkout_additional_storage, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 8),
        TextFormField(
          controller: _additionalStorageController,
          enabled: !_submitting,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(
            isDense: true,
            border: const OutlineInputBorder(),
            suffixText: 'GB',
            errorText: _additionalStorageError,
          ),
          onChanged: (value) {
            // Empty field is treated as 0 rather than invalid, since
            // most users will leave this blank/default.
            if (value.isEmpty) {
              setState(() {
                _additionalStorageError = null;
                _additionalStorageGb = _defaultAdditionalStorageGb;
              });
              return;
            }

            final parsed = int.tryParse(value);
            setState(() {
              if (parsed == null || parsed < 0) {
                _additionalStorageError = l10n.checkout_storage_invalid;
              } else {
                _additionalStorageError = null;
                _additionalStorageGb = parsed;
              }
            });
          },
        ),
      ],
    );
  }

  Widget _buildMethodsList(BuildContext context, AppLocalizations l10n) {
    if (_loadingMethods) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (_loadError != null) {
      return Column(
        children: [
          Text(_loadError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          const SizedBox(height: 8),
          TextButton(onPressed: _fetchPaymentMethods, child: Text(l10n.checkout_retry)),
        ],
      );
    }

    if (_methods.isEmpty) {
      return Text(l10n.checkout_no_methods);
    }

    return Column(
      children: _methods
          .map(
            (method) => RadioListTile<String>(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text(method), // swap for a display-name lookup if you want nicer labels than the raw identifier
              value: method,
              groupValue: _selectedMethod,
              onChanged: _submitting ? null : (value) => setState(() => _selectedMethod = value),
            ),
          )
          .toList(),
    );
  }

  Widget _buildPriceRow(BuildContext context, AppLocalizations l10n) {
    final locale = Localizations.localeOf(context).languageCode;
    final total = _totalPriceRawPerMonth;
    final currency = _selectedCurrency;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(l10n.checkout_total, style: Theme.of(context).textTheme.titleMedium),
        Text(
          (total == null || currency == null) ? '—' : CurrencyFormatter.format(total, currency, locale: locale),
          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
        ),
      ],
    );
  }
}
