import 'package:client/theme/AppColors.dart';
import 'package:flutter/material.dart';

enum ButtonType { elevated, text, outlined, floatingAction }

enum ButtonVariant { filled, outline, ghost }

enum ButtonColor { primary, secondary, success, error, warning }

class Button extends StatelessWidget {
  final String? label;
  final VoidCallback? onPressed;

  final ButtonType type;
  final ButtonColor color;

  final bool isLoading;
  final IconData? icon;

  final double? width;
  final double height;
  final double radius;

  const Button({super.key, this.label, this.onPressed, this.type = ButtonType.elevated, this.color = ButtonColor.primary, this.isLoading = false, this.icon, this.width, this.height = 48, this.radius = 12});

  static Color resolve(ButtonColor token) {
    switch (token) {
      case ButtonColor.primary:
        return AppColors.primary;
      case ButtonColor.secondary:
        return AppColors.secondary;
      case ButtonColor.success:
        return AppColors.success;
      case ButtonColor.warning:
        return AppColors.warning;
      case ButtonColor.error:
        return AppColors.error;
    }
  }

  Color get baseColor => Button.resolve(color);

  @override
  Widget build(BuildContext context) {
    switch (type) {
      case ButtonType.elevated:
        return _elevated();
      case ButtonType.text:
        return _text();
      case ButtonType.outlined:
        return _outlined();
      case ButtonType.floatingAction:
        return _fab();
    }
  }

  // ---------- ELEVATED ----------
  Widget _elevated() {
    return SizedBox(
      width: width,
      height: height,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(backgroundColor: baseColor, foregroundColor: Colors.white, shape: _shape()),
        child: _child(Colors.white),
      ),
    );
  }

  // ---------- OUTLINED ----------
  Widget _outlined() {
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
        child: _child(baseColor),
      ),
    );
  }

  // ---------- TEXT ----------
  Widget _text() {
    return TextButton(
      onPressed: isLoading ? null : onPressed,
      style: TextButton.styleFrom(foregroundColor: baseColor, shape: label == null ? CircleBorder() : null),
      child: _child(baseColor),
    );
  }

  // ---------- FLOATING ACTION ----------
  Widget _fab() {
    return FloatingActionButton(
      onPressed: isLoading ? null : onPressed,
      backgroundColor: baseColor,
      child: isLoading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : (icon != null ? Icon(icon, color: Colors.white) : const Icon(Icons.add, color: Colors.white)),
    );
  }

  // ---------- COMMON ----------
  Widget _child(Color textColor) {
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
