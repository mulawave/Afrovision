import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../channel/screens/channel_list_screen.dart';
import '../../profile/screens/profile_screen.dart';
import '../../wallet/screens/digital_assets_screen.dart';
import '../../wave/screens/wave_screen.dart';
import 'media_center_screen.dart';

/// Root bottom-navigation shell for the app.
///
/// Tabs are fixed as requested:
///   0. Media Center
///   1. Channels
///   2. Waves
///   3. Assets
///   4. Profile
///
/// Each tab is kept alive via [IndexedStack] so the VOD feed, channel list,
/// and wave list maintain scroll position and state while the user switches.
class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  final List<Widget> _tabs = const [
    MediaCenterScreen(),
    ChannelListScreen(),
    WaveScreen(),
    DigitalAssetsScreen(),
    ProfileScreen(),
  ];

  final List<_NavItem> _items = const [
    _NavItem(Icons.movie, 'Media Center'),
    _NavItem(Icons.live_tv, 'Channels'),
    _NavItem(Icons.waves, 'Waves'),
    _NavItem(Icons.account_balance_wallet, 'Assets'),
    _NavItem(Icons.person, 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _tabs,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          border: Border(
            top: BorderSide(color: AppColors.inputBorder),
          ),
        ),
        child: SafeArea(
          child: BottomNavigationBar(
            currentIndex: _currentIndex,
            onTap: (index) => setState(() => _currentIndex = index),
            type: BottomNavigationBarType.fixed,
            backgroundColor: AppColors.cardBg,
            selectedItemColor: AppColors.orange,
            unselectedItemColor: AppColors.hintText,
            selectedFontSize: 12,
            unselectedFontSize: 11,
            elevation: 0,
            items: _items
                .map((item) => BottomNavigationBarItem(
                      icon: Icon(item.icon),
                      label: item.label,
                    ))
                .toList(),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final String label;

  const _NavItem(this.icon, this.label);
}
