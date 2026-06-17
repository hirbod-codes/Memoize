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
  final bool isTransparent;
  final ThemeColorName color;
  final ThemeColorName? onColor;

  final bool isLoading;
  final IconData? icon;

  final double? width;
  final double? height;

  final double radius;
  final RoundedRectangleBorder? shape;

  final double? iconSize;

  const Button({super.key, this.label, this.onPressed, this.type = ButtonType.elevated, this.isTransparent = false, this.color = ThemeColorName.primary, this.onColor = ThemeColorName.onPrimary, this.isLoading = false, this.icon, this.iconSize = 18, this.width, this.height, this.radius = AppRadius.md, this.shape});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ThemeModeNotifier.getTheme(ref.watch(themeModeProvider));

    final baseColor = isTransparent ? Colors.transparent : theme.getThemeColor(color);
    final fg = onColor != null ? theme.getThemeColor(onColor!) : (isTransparent ? theme.onSurface : theme.getThemeOnColor(color));

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
        style: ElevatedButton.styleFrom(backgroundColor: baseColor, foregroundColor: fg, shape: shape ?? _shape()),
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
          shape: shape ?? _shape(),
        ),
        child: _child(textColor: baseColor),
      ),
    );
  }

  Widget _text(Color baseColor) {
    return TextButton(
      onPressed: isLoading ? null : onPressed,
      style: TextButton.styleFrom(foregroundColor: baseColor, shape: label == null && icon != null ? CircleBorder() : shape ?? _shape()),
      child: _child(textColor: baseColor),
    );
  }

  Widget _fab(Color baseColor, Color fg) {
    return FloatingActionButton(
      onPressed: isLoading ? null : onPressed,
      backgroundColor: baseColor,
      foregroundColor: fg,
      child: isLoading ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: fg)) : (icon != null ? Icon(icon, size: iconSize, color: fg) : Icon(Icons.add, size: iconSize, color: fg)),
    );
  }

  Widget _child({required Color textColor}) {
    if (isLoading) {
      return SizedBox(
        width: iconSize,
        height: iconSize,
        child: CircularProgressIndicator(strokeWidth: 2, color: textColor),
      );
    }

    if (icon == null) {
      return Text(label ?? "", style: .new(color: textColor));
    }

    List<Widget> children = [Icon(icon, size: iconSize, color: textColor)];
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
