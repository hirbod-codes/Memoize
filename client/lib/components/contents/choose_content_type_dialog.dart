import 'package:client/api/models/leaf.dart';
import 'package:client/components/button.dart';
import 'package:client/l10n/app_localizations.dart';
import 'package:client/theme/theme_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ChooseContentTypeDialog extends ConsumerStatefulWidget {
  const ChooseContentTypeDialog({super.key});

  @override
  ConsumerState<ChooseContentTypeDialog> createState() => _ChooseContentTypeDialog();
}

class _ChooseContentTypeDialog extends ConsumerState<ChooseContentTypeDialog> {
  ContentType selected = ContentType.string;

  Future<void> _done() async {
    Navigator.pop(context, selected);
  }

  @override
  Widget build(BuildContext context) {
    AppLocalizations l10n = AppLocalizations.of(context)!;

    return Dialog(
      insetPadding: const EdgeInsets.all(20),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 600),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 10,
            children: [
              Text(l10n.choose_new_account, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),

              const SizedBox(height: 16),

              DropdownButtonFormField<ContentType>(
                initialValue: selected,
                decoration: InputDecoration(labelText: l10n.option, border: OutlineInputBorder()),
                items: ContentType.values.map((m) {
                  return DropdownMenuItem(value: m, child: Text(Content.stringifyContentType(m).replaceAll('Id', '')));
                }).toList(),
                onChanged: (value) {
                  if (value != null) {
                    setState(() => selected = value);
                  }
                },
              ),
              // Actions
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(onPressed: () => Navigator.pop(context), child: Text(l10n.cancel)),

                  const SizedBox(width: 8),

                  Button(type: ButtonType.elevated, color: ThemeColorName.secondary, onPressed: _done, label: l10n.choose),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
