import 'package:client/localization/timezone_controller.dart';
import 'package:client/localization/timezone_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class TimezoneSwitcher extends ConsumerWidget {
  const TimezoneSwitcher({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(timezoneControllerProvider);

    return DropdownMenu<String>(
      initialSelection: current,
      enableFilter: true,
      requestFocusOnTap: true,
      label: const Text('Time zone'),
      onSelected: (zone) {
        if (zone != null) ref.read(timezoneControllerProvider.notifier).setZone(zone);
      },
      dropdownMenuEntries: [for (final zone in TimezoneService.allZoneNames) DropdownMenuEntry(value: zone, label: zone)],
    );
  }
}
