String walletFormatAmount(num amount) {
  if (amount == 0) return '0';
  final asDouble = amount.toDouble();
  if (asDouble < 1 && asDouble > 0) return asDouble.toStringAsFixed(4);
  if (asDouble == asDouble.roundToDouble()) {
    final intAmount = asDouble.toInt();
    if (intAmount >= 1000) {
      final str = intAmount.toString();
      final buffer = StringBuffer();
      for (int i = 0; i < str.length; i++) {
        if (i > 0 && (str.length - i) % 3 == 0) buffer.write(',');
        buffer.write(str[i]);
      }
      return buffer.toString();
    }
    return intAmount.toString();
  }
  return asDouble.toStringAsFixed(2);
}
