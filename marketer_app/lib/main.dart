import 'package:flutter/material.dart';
import 'package:afrovision_marketer/core/services/api_service.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MarketerApp());
}

class MarketerApp extends StatelessWidget {
  const MarketerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AfroVision Marketer',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: Color(0xFF050A30),
        colorScheme: ColorScheme.dark(
          primary: Color(0xFFF49617),
          secondary: Color(0xFFF5C16C),
          surface: Color(0xFF050A30),
        ),
      ),
      home: const SplashGate(),
      routes: {
        '/': (ctx) => const SplashGate(),
      },
    );
  }
}

class SplashGate extends StatefulWidget {
  const SplashGate({super.key});

  @override
  State<SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<SplashGate> with SingleTickerProviderStateMixin {
  bool _checking = true;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(vsync: this, duration: Duration(milliseconds: 800));
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeIn);
    _animController.forward();
    _checkSession();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _checkSession() async {
    await ApiService.init();
    if (ApiService.token != null && ApiService.marketer != null) {
      // Verify token is still valid
      try {
        final data = await ApiService.me();
        if (data['success'] == true) {
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => HomeScreen()),
            );
            return;
          }
        }
      } catch (_) {}
    }
    if (mounted) {
      setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return Scaffold(
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF173A6D), Color(0xFF050A30)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: Center(
            child: FadeTransition(
              opacity: _fadeAnim,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Color(0xFFF49617), Color(0xFFF5C16C)],
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Center(
                      child: Text('A', style: TextStyle(fontSize: 40, fontWeight: FontWeight.bold, color: Color(0xFF050A30))),
                    ),
                  ),
                  SizedBox(height: 20),
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: 'Afro', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                        TextSpan(text: 'Vision', style: TextStyle(color: Color(0xFFF49617), fontSize: 22, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                  SizedBox(height: 4),
                  Text('Marketer', style: TextStyle(color: Color(0xFFF5C16C), fontSize: 12, letterSpacing: 4, fontWeight: FontWeight.w500)),
                  SizedBox(height: 30),
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFFF49617)),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    return LoginScreen();
  }
}
