import 'package:client/api/api_call.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:client/api/models/plan.dart'; // for Currency and Plan
import 'package:client/components/global/notification_service.dart';
import 'package:client/l10n/app_localizations.dart';
import 'package:client/pages/plan/currency_formatter.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

enum SubscriptionDuration { month, year }

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

Future<void> showCheckoutDialog(BuildContext context, {required Plan plan}) {
  return showDialog(
    context: context,
    builder: (_) => CheckoutDialog(plan: plan),
  );
}

class CheckoutDialog extends ConsumerStatefulWidget {
  final Plan plan;

  const CheckoutDialog({super.key, required this.plan});

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
  SubscriptionDuration _duration = SubscriptionDuration.month;

  @override
  void initState() {
    super.initState();
    _fetchPaymentMethods();
  }

  Future<void> _fetchPaymentMethods() async {
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
  }

  Currency? get _selectedCurrency => _selectedMethod == null ? null : currencyForPaymentMethod(_selectedMethod!);

  int? get _totalPriceRaw {
    final currency = _selectedCurrency;
    if (currency == null) return null;
    final monthly = widget.plan.price.forCurrency(currency);
    return _duration == SubscriptionDuration.month ? monthly : monthly * 12;
  }

  Future<void> _pay() async {
    final l10n = AppLocalizations.of(context)!;

    if (_selectedMethod == null) {
      NotificationService.showError(context: context, message: l10n.checkout_select_method);
      return;
    }

    setState(() => _submitting = true);

    final result = await apiCall(
      () => _authDio.post(
        '/api/subscription/',
        data: {'planTitle': widget.plan.title, 'paymentMethod': _selectedMethod, 'duration': _duration == SubscriptionDuration.month ? 'month' : 'year'},
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
      launched = await launchUrl(uri, webOnlyWindowName: kIsWeb ? '_blank' : null, mode: kIsWeb ? LaunchMode.platformDefault : LaunchMode.externalApplication);
    } catch (_) {
      launched = false;
    }

    if (!mounted) return;
    setState(() => _submitting = false);

    if (!launched) {
      NotificationService.showError(context: context, message: l10n.checkout_pay_failed);
      return;
    }

    Navigator.of(context).pop();
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
                      onPressed: (_submitting || _selectedMethod == null || _totalPriceRaw == null) ? null : _pay,
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
    return SegmentedButton<SubscriptionDuration>(
      segments: [
        ButtonSegment(value: SubscriptionDuration.month, label: Text(l10n.checkout_duration_month)),
        ButtonSegment(value: SubscriptionDuration.year, label: Text(l10n.checkout_duration_year)),
      ],
      selected: {_duration},
      onSelectionChanged: _submitting ? null : (selection) => setState(() => _duration = selection.first),
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
    final total = _totalPriceRaw;
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
