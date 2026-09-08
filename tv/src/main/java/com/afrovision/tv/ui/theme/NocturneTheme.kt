package com.afrovision.tv.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class NocturneTokens(
    val background: Color = Color(0xFF161826),
    val surface: Color = Color(0xFF232532),
    val surfaceRaised: Color = Color(0xFF101D43),
    val text: Color = Color(0xFFE9E9ED),
    val textMuted: Color = Color(0xFFB2B6CA),
    val textFaint: Color = Color(0xFF9397AB),
    val accent: Color = Color(0xFF9184D9),
    val accentSoft: Color = Color(0xFFA7A1DB),
    val accentLight: Color = Color(0xFFF5F4FF),
    val gold: Color = Color(0xFFF0A52A),
    val goldSoft: Color = Color(0xFFF5C266),
    val divider: Color = Color(0x26E9E9ED),
    val border: Color = Color(0xFF22325E),
    val borderCard: Color = Color(0xFF595D6C),
    val neutral100: Color = Color(0xFFF3F5FE),
    val neutral900: Color = Color(0xFF292B31),
    val accent100: Color = Color(0xFFF5F4FF),
    val accent700: Color = Color(0xFF5D5294),
    val accent900: Color = Color(0xFF2B2741),
    val section: Color = Color(0xFF262A60),
    val radiusSm: Float = 4f,
    val radiusMd: Float = 8f,
    val radiusLg: Float = 14f,
    val spaceRail: Int = 146,
    val spaceStage: Int = 60,
    val spaceTopChrome: Int = 44
)

val LocalNocturne = staticCompositionLocalOf { NocturneTokens() }

private val NocturneColorScheme = darkColorScheme(
    primary = NocturneTokens().accent,
    onPrimary = NocturneTokens().text,
    primaryContainer = NocturneTokens().accent900,
    onPrimaryContainer = NocturneTokens().accent100,
    secondary = NocturneTokens().accentSoft,
    onSecondary = NocturneTokens().text,
    secondaryContainer = NocturneTokens().accent900,
    onSecondaryContainer = NocturneTokens().accent100,
    tertiary = NocturneTokens().gold,
    onTertiary = NocturneTokens().text,
    background = NocturneTokens().background,
    onBackground = NocturneTokens().text,
    surface = NocturneTokens().surface,
    onSurface = NocturneTokens().text,
    surfaceVariant = NocturneTokens().surfaceRaised,
    onSurfaceVariant = NocturneTokens().textMuted,
    outline = NocturneTokens().border,
    outlineVariant = NocturneTokens().borderCard,
    error = Color(0xFFFF4D4D),
    onError = Color.White
)

private val NocturneTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 52.sp,
        lineHeight = 58.sp,
        letterSpacing = (-0.015).sp
    ),
    displayMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 42.sp,
        lineHeight = 48.sp
    ),
    displaySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 32.sp,
        lineHeight = 36.sp
    ),
    headlineLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 32.sp,
        lineHeight = 36.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 25.sp,
        lineHeight = 28.sp
    ),
    headlineSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 20.sp,
        lineHeight = 24.sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 20.sp,
        lineHeight = 24.sp
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 20.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 24.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 20.sp
    ),
    bodySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 11.sp,
        lineHeight = 16.sp
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        lineHeight = 16.sp
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp
    )
)

private val NocturneShapes = Shapes(
    small = RoundedCornerShape(4.dp),
    medium = RoundedCornerShape(8.dp),
    large = RoundedCornerShape(14.dp)
)

@Composable
fun AfroVisionTVTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit
) {
    val nocturne = NocturneTokens()
    CompositionLocalProvider(LocalNocturne provides nocturne) {
        MaterialTheme(
            colorScheme = NocturneColorScheme,
            typography = NocturneTypography,
            shapes = NocturneShapes,
            content = content
        )
    }
}
