import 'package:client/theme/theme_colors.dart';
import 'package:client/theme/theme_mode_notifier.dart';
import 'package:client/theme/theme_radius.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum ButtonType { elevated, text, outlined, floatingAction }

enum ButtonVariant { filled, outline, ghost }

class Button extends ConsumerWidget {
  final String? label;
  final VoidCallback? onPressed;

  final ButtonType type;
  final ThemeColorName color;
  final ThemeColorName? onColor;

  final bool isLoading;
  final IconData? icon;

  final double? width;
  final double? height;
  final double radius;

  const Button({super.key, this.label, this.onPressed, this.type = ButtonType.elevated, this.color = ThemeColorName.primary, this.onColor = ThemeColorName.onPrimary, this.isLoading = false, this.icon, this.width, this.height, this.radius = AppRadius.md});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    final baseColor = theme.getThemeColor(color);
    final fg = onColor != null ? theme.getThemeColor(onColor!) : theme.getThemeOnColor(color);

    switch (type) {
      case ButtonType.elevated:
        return _elevated(baseColor, fg);
      case ButtonType.text:
        return _text(baseColor);
      case ButtonType.outlined:
        return _outlined(baseColor);
      case ButtonType.floatingAction:
        return _fab(baseColor, fg);
    }
  }

  Widget _elevated(Color baseColor, Color fg) {
    return SizedBox(
      width: width,
      height: height,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(backgroundColor: baseColor, foregroundColor: fg, shape: _shape()),
        child: _child(textColor: fg),
      ),
    );
  }

  Widget _outlined(Color baseColor) {
    return SizedBox(
      width: width,
      height: height,
      child: OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: baseColor,
          side: BorderSide(color: baseColor, width: 1.5),
          shape: _shape(),
        ),
        child: _child(textColor: baseColor),
      ),
    );
  }

  Widget _text(Color baseColor) {
    return TextButton(
      onPressed: isLoading ? null : onPressed,
      style: TextButton.styleFrom(foregroundColor: baseColor, shape: label == null ? CircleBorder() : null),
      child: _child(textColor: baseColor),
    );
  }

  Widget _fab(Color baseColor, Color fg) {
    return FloatingActionButton(
      onPressed: isLoading ? null : onPressed,
      backgroundColor: baseColor,
      foregroundColor: fg,
      child: isLoading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : (icon != null ? Icon(icon, color: Colors.white) : const Icon(Icons.add, color: Colors.white)),
    );
  }

  Widget _child({required Color textColor}) {
    if (isLoading) {
      return SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: textColor));
    }

    if (icon == null) {
      return Text(label ?? "");
    }

    List<Widget> children = [Icon(icon, size: 18, color: textColor)];
    if (label != null) {
      children.add(const SizedBox(width: 8));
      children.add(Text(label ?? ""));
    }

    return Row(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, mainAxisSize: MainAxisSize.min, children: children);
  }

  RoundedRectangleBorder _shape() {
    return RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius));
  }
}
