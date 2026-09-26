import 'package:client/api/api_call.dart';
import 'package:client/api/dio/dio_providers.dart';
import 'package:client/l10n/app_localizations.dart';
import 'package:client/plan/models/currency_label.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

class PaymentCurrency {
  final String paymentMethod;
  final Currency currency;

  PaymentCurrency({required this.paymentMethod, required this.currency});
}

class ChoosePaymentCurrency extends ConsumerStatefulWidget {
  final void Function(PaymentCurrency paymentCurrency)? onSelect;

  const ChoosePaymentCurrency({super.key, this.onSelect});

  @override
  ConsumerState<ChoosePaymentCurrency> createState() => _ChoosePaymentCurrencyState();
}

class _ChoosePaymentCurrencyState extends ConsumerState<ChoosePaymentCurrency> {
  Dio get _authDio => ref.read(authDioProvider);

  bool _loadingMethods = true;
  String? _error;
  List<String> _supportedMethods = [];
  List<String> _displayableMethods = [];
  List<Currency> _supportedCurrencies = [];
  String? _selectedMethod;
  Currency? _selectedCurrency;

  @override
  void initState() {
    super.initState();
    _fetchPaymentMethods();
  }

  Future<void> _fetchPaymentMethods() async {
    try {
      setState(() {
        _loadingMethods = true;
        _error = null;
      });

      final result = await apiCall(() => _authDio.get('/api/subscription/supported_payment_methods'));

      if (!mounted) return;

      if (result.isFailure || result.dataOrNull == null) {
        setState(() {
          _loadingMethods = false;
          _error = AppLocalizations.of(context)!.checkout_load_methods_failed;
        });
        return;
      }

      final raw = (result.dataOrNull!['methods'] as List<dynamic>?) ?? [];
      final supportedMethods = raw.cast<String>();
      final supportedCurrencies = Currency.values.where((c) {
        switch (c) {
          case Currency.usd:
            return supportedMethods.contains('paypal');
          case Currency.eur:
            return supportedMethods.contains('paypal');
          case Currency.irr:
            return supportedMethods.contains('zibal') || supportedMethods.contains('zarinpal');
          case Currency.irt:
            return supportedMethods.contains('zibal') || supportedMethods.contains('zarinpal');
          case Currency.btc:
            return supportedMethods.contains('bitcoin');
          case Currency.eth:
            return supportedMethods.contains('bitcoin');
        }
      }).toList();

      final selectedCurrency = supportedCurrencies.isNotEmpty ? supportedCurrencies.first : null;

      List<String> displayableMethods = selectedCurrency == null ? [] : _resolveDisplayableMethods(selectedCurrency);

      final selectedMethod = displayableMethods.isNotEmpty ? supportedMethods.first : null;

      if (selectedMethod != null && selectedCurrency != null) {
        widget.onSelect?.call(PaymentCurrency(paymentMethod: selectedMethod, currency: selectedCurrency));
      }

      setState(() {
        _loadingMethods = false;
        _supportedMethods = supportedMethods;
        _supportedCurrencies = supportedCurrencies;
        _selectedMethod = selectedMethod;
        _selectedCurrency = selectedCurrency;
        _displayableMethods = displayableMethods;
      });
    } catch (e) {
      Talker().error('caught error in _fetchPaymentMethods method of _ChoosePaymentCurrencyState class', e);
    }
  }

  List<String> _resolveDisplayableMethods(Currency currency) {
    switch (currency) {
      case Currency.usd:
        return _supportedMethods.contains('paypal') ? ['paypal'] : [];
      case Currency.eur:
        return _supportedMethods.contains('paypal') ? ['paypal'] : [];
      case Currency.irr:
        List<String> methods = [];
        if (_supportedMethods.contains('zibal')) methods.add('zibal');
        if (_supportedMethods.contains('zarinpal')) methods.add('zarinpal');
        return methods;
      case Currency.irt:
        List<String> methods = [];
        if (_supportedMethods.contains('zibal')) methods.add('zibal');
        if (_supportedMethods.contains('zarinpal')) methods.add('zarinpal');
        return methods;
      case Currency.btc:
        return _supportedMethods.contains('bitcoin') ? ['bitcoin'] : [];
      case Currency.eth:
        return _supportedMethods.contains('bitcoin') ? ['bitcoin'] : [];
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingMethods) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    final l10n = AppLocalizations.of(context)!;

    if (_error != null) {
      return Column(
        children: [
          Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          const SizedBox(height: 8),
          TextButton(onPressed: _fetchPaymentMethods, child: Text(l10n.checkout_retry)),
        ],
      );
    }

    if (_selectedMethod == null || _selectedCurrency == null) {
      return Column(
        children: [
          Text(l10n.checkout_no_methods),
          const SizedBox(height: 8),
          TextButton(onPressed: _fetchPaymentMethods, child: Text(l10n.checkout_retry)),
        ],
      );
    }

    final List<Widget> widgets = [
      Center(
        child: SegmentedButton<Currency>(
          segments: _supportedCurrencies.map((c) => ButtonSegment(value: c, label: Text(c.label))).toList(),
          selected: {_selectedCurrency!},
          onSelectionChanged: (selection) {
            final selectedCurrency = selection.first;

            List<String> displayableMethods = _resolveDisplayableMethods(selectedCurrency);
            final selectedMethod = displayableMethods.first;

            widget.onSelect?.call(PaymentCurrency(paymentMethod: selectedMethod, currency: selectedCurrency));

            setState(() {
              _selectedCurrency = selectedCurrency;
              _displayableMethods = displayableMethods;
              _selectedMethod = selectedMethod;
            });
          },
          showSelectedIcon: false,
        ),
      ),
    ].toList();

    widgets.addAll(
      _displayableMethods
          .map(
            (method) => RadioListTile<String>(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text(method), // swap for a display-name lookup if you want nicer labels than the raw identifier
              value: method,
              groupValue: _selectedMethod!,
              onChanged: (value) {
                final selectedMethod = value;

                widget.onSelect?.call(PaymentCurrency(paymentMethod: selectedMethod!, currency: _selectedCurrency!));

                setState(() => _selectedMethod = selectedMethod);
              },
            ),
          )
          .toList(),
    );

    return Column(children: widgets);
  }
}
