import 'package:flutter/widgets.dart';

/// Non-web platforms: nothing to render, nowhere to inject HTML into.
Widget buildFooterBadgeWidget() => const SizedBox.shrink();
