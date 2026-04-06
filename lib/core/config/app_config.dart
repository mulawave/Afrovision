class AppConfig {
  // Android emulator: 'http://10.0.2.2:3000'
  // iOS simulator / Chrome: 'http://localhost:3000'
  // Physical device: use your machine's local IP
  // Production: use HTTPS + domain (e.g. 'https://api.afrovision.app')
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://afrovision-backend-134538542038.us-central1.run.app',
  );
}
