class AppConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://afrovision-backend-134538542038.us-central1.run.app',
  );
}
