import 'dart:developer';

import 'package:client/auth/auth_controller.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();

  bool loading = false;

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  void login() async {
    setState(() => loading = true);

    try {
      final email = emailController.text.trim();
      final password = passwordController.text;

      await ref.read(authControllerProvider.notifier).login(email, password);
    } on DioException catch (e) {
      log(e.toString());

      String message = 'Login failed';

      // 👇 Handle 400 / server validation errors
      if (e.response?.statusCode == 400) {
        final data = e.response?.data;

        // common API formats:
        if (data is Map && data['message'] != null) {
          message = data['message'].toString();
        } else if (data is String) {
          message = data != '' ? data : 'Invalid credentials';
        } else {
          message = 'Invalid credentials';
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), duration: const Duration(seconds: 3)));
      }

      return;
    } catch (e) {
      log(e.toString());

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Unexpected error occurred'), duration: Duration(seconds: 3)));
      }

      return;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('Login', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),

                const SizedBox(height: 24),

                TextField(
                  controller: emailController,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),

                const SizedBox(height: 12),

                TextField(
                  controller: passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password'),
                ),

                const SizedBox(height: 24),

                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: loading ? null : login,
                    child: loading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Login'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
