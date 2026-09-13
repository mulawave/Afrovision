package com.afrovision.tv.ui.screens

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.afrovision.tv.data.ActivationState
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.ui.theme.LocalNocturne
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter

private val Accent200 = Color(0xFFE7E5FE)
private val Accent300 = Color(0xFFD2CEFD)
private val Accent600 = Color(0xFF796CBF)
private val Neutral300 = Color(0xFFCFD3E5)
private val Neutral400 = Color(0xFFB2B6CA)
private val Neutral500 = Color(0xFF9397AB)
private val Neutral700 = Color(0xFF595D6C)
private val Neutral800 = Color(0xFF3F424D)
private val ErrorRed = Color(0xFFFF6B6B)
private val SuccessGreen = Color(0xFF6FD39A)

// Choice/Register/SignIn are all "step 1" (who you are) in the 3-step intro
// pane - an existing-account owner should never have to retype their name/
// email/phone from scratch just to activate a TV (that's how duplicate or
// misattributed accounts happened before), so Choice branches into a real
// password-verified Sign in or a fresh Register, both landing on the same
// Code step afterward.
private enum class SetupStep { Choice, Register, SignIn, Code, Done }

private fun SetupStep.introGroup(): Int = when (this) {
    SetupStep.Choice, SetupStep.Register, SetupStep.SignIn -> 0
    SetupStep.Code -> 1
    SetupStep.Done -> 2
}

private const val MAX_CODE_LENGTH = 18

private fun formatActivationCode(raw: String): String {
    val cleaned = raw.uppercase().filter { it.isLetterOrDigit() }
    val body = if (cleaned.startsWith("AV")) cleaned.drop(2) else cleaned
    val groups = body.take(12).chunked(4)
    return if (groups.isEmpty()) "AV" else "AV-" + groups.joinToString("-")
}

private fun isCompleteCode(code: String): Boolean {
    val cleaned = code.uppercase().filter { it.isLetterOrDigit() }
    val body = if (cleaned.startsWith("AV")) cleaned.drop(2) else cleaned
    return body.length == 12
}

@Composable
fun ActivationScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    val state = viewModel.activationState
    val alreadyPaired by viewModel.isPaired.collectAsState()

    var step by rememberSaveable { mutableStateOf(SetupStep.Choice) }
    var chosenMode by rememberSaveable { mutableStateOf("register") }
    var fullName by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    var validationError by remember { mutableStateOf<String?>(null) }
    var showQr by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(state) {
        // QR pairing completes asynchronously from the phone, while the TV
        // may still be sitting on the QR pane (showQr=true) - without also
        // clearing showQr here, that pane keeps rendering forever even
        // though `step` has already correctly moved to Done underneath it,
        // so nothing on screen ever visibly reacts to a successful pairing.
        if (state is ActivationState.Activated) {
            step = SetupStep.Done
            showQr = false
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.background)) {
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.radialGradient(
                    colors = listOf(Color(0xFF262A60), Color(0xFF1A1C2C), Color(0xFF0F1018)),
                    center = androidx.compose.ui.geometry.Offset(230f, 220f),
                    radius = 1800f
                )
            )
        )

        Row(modifier = Modifier.fillMaxSize()) {
            SetupIntroPane(step = step, modifier = Modifier.width(660.dp).fillMaxHeight())

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .background(
                        Brush.horizontalGradient(
                            listOf(Color.Transparent, Color(0x8C0D0E17))
                        )
                    )
                    .padding(horizontal = 80.dp, vertical = 100.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                if (showQr) {
                    QrPairingPane(
                        viewModel = viewModel,
                        onBack = {
                            viewModel.stopSessionPolling()
                            showQr = false
                        },
                        onCancel = if (alreadyPaired) ({ viewModel.stopSessionPolling(); viewModel.navigateTo(com.afrovision.tv.ui.navigation.Screen.Home) }) else null
                    )
                } else {
                    AnimatedContent(targetState = step, label = "setupStep") { current ->
                        when (current) {
                            SetupStep.Choice -> ChoiceStep(
                                onSignIn = { chosenMode = "signin"; validationError = null; step = SetupStep.SignIn },
                                onRegister = { chosenMode = "register"; validationError = null; step = SetupStep.Register },
                                onUseQr = { showQr = true },
                                onCancel = if (alreadyPaired) ({ viewModel.navigateTo(com.afrovision.tv.ui.navigation.Screen.Home) }) else null
                            )
                            SetupStep.SignIn -> SignInStep(
                                email = email,
                                password = password,
                                error = validationError,
                                onEmail = { email = it; validationError = null },
                                onPassword = { password = it; validationError = null },
                                onContinue = {
                                    validationError = validateSignIn(email, password)
                                    if (validationError == null) step = SetupStep.Code
                                },
                                onBack = { validationError = null; step = SetupStep.Choice }
                            )
                            SetupStep.Register -> DetailsStep(
                                fullName = fullName,
                                email = email,
                                phone = phone,
                                error = validationError,
                                onFullName = { fullName = it; validationError = null },
                                onEmail = { email = it; validationError = null },
                                onPhone = { phone = it; validationError = null },
                                onContinue = {
                                    validationError = validateDetails(fullName, email, phone)
                                    if (validationError == null) step = SetupStep.Code
                                },
                                onBack = { validationError = null; step = SetupStep.Choice }
                            )
                            SetupStep.Code -> CodeStep(
                                code = code,
                                state = state,
                                error = validationError,
                                onCode = {
                                    code = it.uppercase().take(MAX_CODE_LENGTH)
                                    validationError = null
                                    if (state is ActivationState.Error) viewModel.resetActivation()
                                },
                                onActivate = {
                                    if (!isCompleteCode(code)) {
                                        validationError = "Enter the full 12-character activation code (AV-XXXX-XXXX-XXXX)."
                                    } else {
                                        validationError = null
                                        if (chosenMode == "signin") {
                                            viewModel.activate(formatActivationCode(code), "", email, "", mode = "signin", ownerPassword = password)
                                        } else {
                                            viewModel.activate(formatActivationCode(code), fullName, email, phone, mode = "register")
                                        }
                                    }
                                },
                                onBack = {
                                    viewModel.resetActivation()
                                    validationError = null
                                    step = if (chosenMode == "signin") SetupStep.SignIn else SetupStep.Register
                                }
                            )
                            SetupStep.Done -> DoneStep(
                                state = state as? ActivationState.Activated,
                                onEnter = { viewModel.enterAfterActivation() }
                            )
                        }
                    }
                }
            }
        }

        Text(
            text = "Arrows to move   ·   Enter to select   ·   Back to return",
            color = Neutral500,
            fontSize = 18.sp,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 64.dp, bottom = 28.dp)
                .clip(RoundedCornerShape(nocturne.radiusMd.dp))
                .background(Color(0xE60D0E17))
                .padding(horizontal = 22.dp, vertical = 12.dp)
        )
    }
}

private fun validateDetails(fullName: String, email: String, phone: String): String? {
    if (fullName.trim().length < 2) return "Please enter your full name."
    val e = email.trim()
    if (!e.contains("@") || !e.substringAfter("@").contains(".")) return "Please enter a valid email address."
    if (phone.trim().filter { it.isDigit() }.length < 6) return "Please enter a valid phone number."
    return null
}

@Composable
private fun SetupIntroPane(step: SetupStep, modifier: Modifier = Modifier) {
    val nocturne = LocalNocturne.current
    Column(
        modifier = modifier.padding(horizontal = 70.dp, vertical = 120.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(18.dp))
                .border(1.dp, Accent600, RoundedCornerShape(18.dp)),
            contentAlignment = Alignment.Center
        ) {
            Image(
                painter = androidx.compose.ui.res.painterResource(com.afrovision.tv.R.drawable.logo_dark),
                contentDescription = "AfroVision",
                modifier = Modifier.size(40.dp)
            )
        }
        Spacer(modifier = Modifier.height(34.dp))
        Text(
            text = "Set up your\nAfrovision box",
            color = nocturne.text,
            fontSize = 58.sp,
            lineHeight = 61.sp,
            fontWeight = FontWeight.Medium,
            letterSpacing = (-1.4).sp
        )
        Spacer(modifier = Modifier.height(22.dp))
        Text(
            text = "Three minutes and your activation code, and this television is yours — channels, Waves, the library and your downloads.",
            color = Neutral300,
            fontSize = 22.sp,
            lineHeight = 34.sp,
            modifier = Modifier.widthIn(max = 480.dp)
        )
        Spacer(modifier = Modifier.height(40.dp))
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            StepRow(number = 1, label = "Sign in or register", active = step.introGroup() == 0, done = step.introGroup() > 0)
            StepRow(number = 2, label = "Activation code", active = step.introGroup() == 1, done = step.introGroup() > 1)
            StepRow(number = 3, label = "Start watching", active = step.introGroup() == 2, done = false)
        }
    }
}

@Composable
private fun StepRow(number: Int, label: String, active: Boolean, done: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Box(
            modifier = Modifier
                .size(30.dp)
                .clip(CircleShape)
                .border(1.dp, if (active || done) Accent600 else Neutral700, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = if (done) "✓" else number.toString(),
                color = if (active || done) Accent200 else Neutral400,
                fontSize = 15.sp
            )
        }
        Text(text = label, color = if (active) Accent200 else Neutral400, fontSize = 19.sp)
    }
}

@Composable
private fun StepLabel(text: String) {
    Text(
        text = text.uppercase(),
        color = Accent300,
        fontSize = 17.sp,
        letterSpacing = 2.7.sp
    )
}

@Composable
private fun ChoiceStep(
    onSignIn: () -> Unit,
    onRegister: () -> Unit,
    onUseQr: () -> Unit,
    onCancel: (() -> Unit)? = null
) {
    val signInButton = remember { FocusRequester() }
    var placed by remember { mutableStateOf(false) }
    LaunchedEffect(placed) {
        if (placed) {
            kotlinx.coroutines.delay(350)
            try { signInButton.requestFocus() } catch (_: IllegalStateException) { }
        }
    }

    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.onGloballyPositioned { if (!placed) placed = true }
    ) {
        StepLabel("Step 1 of 3 · who's activating")
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = "Already have an AfroVision account?",
            color = Neutral300,
            fontSize = 21.sp
        )
        Spacer(modifier = Modifier.height(4.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            SetupButton(label = "Sign in", primary = true, onClick = onSignIn, focusRequester = signInButton)
            SetupButton(label = "Create a new account", primary = false, onClick = onRegister)
        }
        Spacer(modifier = Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            SetupButton(label = "Pair with phone instead", primary = false, onClick = onUseQr)
            if (onCancel != null) {
                SetupButton(label = "Cancel", primary = false, onClick = onCancel)
            }
        }
        StatusLine(
            text = "Signing in links this TV to your existing account - no need to retype your details. New here? Create an account instead.",
            isError = false
        )
    }
}

@Composable
private fun SignInStep(
    email: String,
    password: String,
    error: String?,
    onEmail: (String) -> Unit,
    onPassword: (String) -> Unit,
    onContinue: () -> Unit,
    onBack: () -> Unit
) {
    val focusManager = LocalFocusManager.current
    val firstField = remember { FocusRequester() }
    var placed by remember { mutableStateOf(false) }
    LaunchedEffect(placed) {
        if (placed) {
            kotlinx.coroutines.delay(350)
            try { firstField.requestFocus() } catch (_: IllegalStateException) { }
        }
    }

    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.onGloballyPositioned { if (!placed) placed = true }
    ) {
        StepLabel("Step 1 of 3 · sign in")
        Spacer(modifier = Modifier.height(10.dp))
        SetupField(
            label = "Email",
            value = email,
            onValueChange = onEmail,
            placeholder = "amara.dike@mail.com",
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Next,
            onImeAction = { focusManager.moveFocus(androidx.compose.ui.focus.FocusDirection.Down) },
            focusRequester = firstField
        )
        SetupField(
            label = "Password",
            value = password,
            onValueChange = onPassword,
            placeholder = "••••••••",
            keyboardType = KeyboardType.Password,
            imeAction = ImeAction.Done,
            onImeAction = { focusManager.clearFocus(); onContinue() },
            isPassword = true
        )
        Spacer(modifier = Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            SetupButton(label = "Continue", primary = true, onClick = onContinue)
            SetupButton(label = "Back", primary = false, onClick = onBack)
        }
        StatusLine(
            text = error ?: "Sign in with your existing AfroVision account. Your activation code comes next.",
            isError = error != null
        )
    }
}

private fun validateSignIn(email: String, password: String): String? {
    val e = email.trim()
    if (!e.contains("@") || !e.substringAfter("@").contains(".")) return "Please enter a valid email address."
    if (password.isEmpty()) return "Please enter your password."
    return null
}

@Composable
private fun DetailsStep(
    fullName: String,
    email: String,
    phone: String,
    error: String?,
    onFullName: (String) -> Unit,
    onEmail: (String) -> Unit,
    onPhone: (String) -> Unit,
    onContinue: () -> Unit,
    onBack: () -> Unit
) {
    val focusManager = LocalFocusManager.current
    val firstField = remember { FocusRequester() }
    var placed by remember { mutableStateOf(false) }
    LaunchedEffect(placed) {
        if (placed) {
            kotlinx.coroutines.delay(350)
            try { firstField.requestFocus() } catch (_: IllegalStateException) { }
        }
    }

    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.onGloballyPositioned { if (!placed) placed = true }
    ) {
        StepLabel("Step 1 of 3 · create your account")
        Spacer(modifier = Modifier.height(10.dp))
        SetupField(
            label = "Full name",
            value = fullName,
            onValueChange = onFullName,
            placeholder = "Amara Dike",
            keyboardType = KeyboardType.Text,
            capitalization = KeyboardCapitalization.Words,
            imeAction = ImeAction.Next,
            onImeAction = { focusManager.moveFocus(androidx.compose.ui.focus.FocusDirection.Down) },
            focusRequester = firstField
        )
        SetupField(
            label = "Email",
            value = email,
            onValueChange = onEmail,
            placeholder = "amara.dike@mail.com",
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Next,
            onImeAction = { focusManager.moveFocus(androidx.compose.ui.focus.FocusDirection.Down) }
        )
        SetupField(
            label = "Phone",
            value = phone,
            onValueChange = onPhone,
            placeholder = "+234 803 555 0142",
            keyboardType = KeyboardType.Phone,
            imeAction = ImeAction.Done,
            onImeAction = { focusManager.clearFocus(); onContinue() }
        )
        Spacer(modifier = Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            SetupButton(label = "Continue", primary = true, onClick = onContinue)
            SetupButton(label = "Back", primary = false, onClick = onBack)
        }
        StatusLine(
            text = error ?: "These details register the owner of this TV. Your activation code comes next.",
            isError = error != null
        )
    }
}

@Composable
private fun CodeStep(
    code: String,
    state: ActivationState,
    error: String?,
    onCode: (String) -> Unit,
    onActivate: () -> Unit,
    onBack: () -> Unit
) {
    val focusManager = LocalFocusManager.current
    val codeField = remember { FocusRequester() }
    var placed by remember { mutableStateOf(false) }
    LaunchedEffect(placed) {
        if (placed) {
            kotlinx.coroutines.delay(350)
            try { codeField.requestFocus() } catch (_: IllegalStateException) { }
        }
    }

    val activating = state is ActivationState.Activating
    val serverError = (state as? ActivationState.Error)?.message

    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.onGloballyPositioned { if (!placed) placed = true }
    ) {
        StepLabel("Step 2 of 3 · activation code")
        Spacer(modifier = Modifier.height(10.dp))
        SetupField(
            label = "Activation code",
            value = code,
            onValueChange = onCode,
            placeholder = "AV-XXXX-XXXX-XXXX",
            keyboardType = KeyboardType.Ascii,
            capitalization = KeyboardCapitalization.Characters,
            imeAction = ImeAction.Done,
            onImeAction = { focusManager.clearFocus(); onActivate() },
            focusRequester = codeField,
            highlighted = true,
            valueFontSize = 26.sp,
            valueLetterSpacing = 6.sp,
            trailing = if (isCompleteCode(code)) "✓" else null,
            enabled = !activating
        )
        Spacer(modifier = Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            SetupButton(label = if (activating) "Activating…" else "Activate", primary = true, onClick = onActivate, enabled = !activating)
            SetupButton(label = "Back", primary = false, onClick = onBack, enabled = !activating)
            if (activating) {
                CircularProgressIndicator(color = Accent300, strokeWidth = 3.dp, modifier = Modifier.size(28.dp))
            }
        }
        StatusLine(
            text = error ?: serverError
                ?: "Your distributor or marketer gave you a 12-character code. One code activates exactly one TV.",
            isError = error != null || serverError != null
        )
    }
}

@Composable
private fun DoneStep(state: ActivationState.Activated?, onEnter: () -> Unit) {
    val nocturne = LocalNocturne.current
    val button = remember { FocusRequester() }
    var placed by remember { mutableStateOf(false) }
    LaunchedEffect(placed) {
        if (placed) {
            kotlinx.coroutines.delay(350)
            try { button.requestFocus() } catch (_: IllegalStateException) { }
        }
    }

    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.onGloballyPositioned { if (!placed) placed = true }
    ) {
        StepLabel("Step 3 of 3 · start watching")
        Spacer(modifier = Modifier.height(10.dp))
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(CircleShape)
                .background(SuccessGreen.copy(alpha = 0.15f))
                .border(1.dp, SuccessGreen, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(text = "✓", color = SuccessGreen, fontSize = 34.sp)
        }
        Text(
            text = if (state?.reactivated == true) "Welcome back" else "Activation complete",
            color = nocturne.text,
            fontSize = 42.sp,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = buildString {
                append("This TV is now registered to ")
                append(state?.ownerName?.takeIf { it.isNotBlank() } ?: "you")
                append(". Live channels, Waves, movies, series and the library are ready.")
            },
            color = Neutral300,
            fontSize = 22.sp,
            lineHeight = 34.sp,
            modifier = Modifier.widthIn(max = 640.dp)
        )
        Spacer(modifier = Modifier.height(6.dp))
        SetupButton(label = "Start watching", primary = true, onClick = onEnter, focusRequester = button)
    }
}

@Composable
private fun QrPairingPane(viewModel: TvViewModel, onBack: () -> Unit, onCancel: (() -> Unit)? = null) {
    val nocturne = LocalNocturne.current
    var qrUrl by remember { mutableStateOf<String?>(null) }
    var pairingCode by remember { mutableStateOf<String?>(null) }
    var failed by remember { mutableStateOf(false) }
    val backButton = remember { FocusRequester() }
    var placed by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val session = viewModel.createSession()
        if (session == null) {
            failed = true
        } else {
            qrUrl = session.qrUrl
            pairingCode = session.pairingCode
        }
    }

    LaunchedEffect(placed) {
        if (placed) {
            kotlinx.coroutines.delay(350)
            try { backButton.requestFocus() } catch (_: IllegalStateException) { }
        }
    }

    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.onGloballyPositioned { if (!placed) placed = true }
    ) {
        StepLabel("Pair with your phone")
        Spacer(modifier = Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(40.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(300.dp)
                    .clip(RoundedCornerShape(nocturne.radiusLg.dp))
                    .background(Color.White)
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                val data = qrUrl
                if (data != null) {
                    Image(
                        bitmap = generateQrBitmap(data, 520).asImageBitmap(),
                        contentDescription = "Pairing QR",
                        modifier = Modifier.fillMaxSize()
                    )
                } else if (!failed) {
                    CircularProgressIndicator(color = Accent600, strokeWidth = 3.dp)
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.widthIn(max = 520.dp)) {
                Text(text = "Open AfroVision on your phone → Connect TV", color = nocturne.text, fontSize = 24.sp)
                Text(
                    text = "Scan the code, or type this pairing code in the app. QR pairing is only available to authorised accounts — everyone else should use an activation code.",
                    color = Neutral400,
                    fontSize = 19.sp,
                    lineHeight = 29.sp
                )
                Text(
                    text = pairingCode ?: if (failed) "Unavailable" else "······",
                    color = Accent200,
                    fontSize = 40.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 8.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(nocturne.radiusMd.dp))
                        .background(Color(0x592B2741))
                        .border(1.dp, nocturne.accent700, RoundedCornerShape(nocturne.radiusMd.dp))
                        .padding(horizontal = 24.dp, vertical = 14.dp)
                )
            }
        }
        Spacer(modifier = Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            SetupButton(label = "Use activation code", primary = true, onClick = onBack, focusRequester = backButton)
            if (onCancel != null) {
                SetupButton(label = "Cancel", primary = false, onClick = onCancel)
            }
        }
        StatusLine(
            text = if (failed) "Could not start a pairing session. Check your connection and try again." else "Waiting for your phone to confirm…",
            isError = failed
        )
    }
}

@Composable
private fun StatusLine(text: String, isError: Boolean) {
    Text(
        text = text,
        color = if (isError) ErrorRed else Neutral500,
        fontSize = 19.sp,
        lineHeight = 27.sp,
        modifier = Modifier.padding(top = 8.dp).widthIn(max = 760.dp)
    )
}

@Composable
private fun SetupField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    keyboardType: KeyboardType,
    imeAction: ImeAction,
    onImeAction: () -> Unit,
    capitalization: KeyboardCapitalization = KeyboardCapitalization.None,
    focusRequester: FocusRequester = remember { FocusRequester() },
    highlighted: Boolean = false,
    valueFontSize: androidx.compose.ui.unit.TextUnit = 23.sp,
    valueLetterSpacing: androidx.compose.ui.unit.TextUnit = 0.sp,
    trailing: String? = null,
    enabled: Boolean = true,
    isPassword: Boolean = false
) {
    val nocturne = LocalNocturne.current
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (focused) 1.015f else 1f, tween(180), label = "fieldScale")
    val borderColor = when {
        focused -> nocturne.accent
        highlighted -> nocturne.accent700
        else -> Neutral700
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .scale(scale)
            .clip(RoundedCornerShape(nocturne.radiusMd.dp))
            .background(if (highlighted || focused) Color(0x592B2741) else Color.Transparent)
            .border(if (focused) 2.dp else 1.dp, borderColor, RoundedCornerShape(nocturne.radiusMd.dp))
            .padding(horizontal = 24.dp, vertical = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Text(text = label, color = Neutral500, fontSize = 18.sp, modifier = Modifier.width(190.dp))
        Box(modifier = Modifier.weight(1f)) {
            if (value.isEmpty()) {
                Text(text = placeholder, color = Neutral700, fontSize = valueFontSize, letterSpacing = valueLetterSpacing)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                enabled = enabled,
                textStyle = TextStyle(color = nocturne.text, fontSize = valueFontSize, letterSpacing = valueLetterSpacing),
                cursorBrush = SolidColor(nocturne.accent),
                visualTransformation = if (isPassword) androidx.compose.ui.text.input.PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
                keyboardOptions = KeyboardOptions(
                    keyboardType = keyboardType,
                    imeAction = imeAction,
                    capitalization = capitalization,
                    autoCorrectEnabled = false
                ),
                keyboardActions = KeyboardActions(
                    onNext = { onImeAction() },
                    onDone = { onImeAction() }
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester)
                    .onFocusChanged { focused = it.isFocused }
            )
        }
        if (trailing != null) {
            Text(text = trailing, color = Accent300, fontSize = 26.sp)
        }
    }
}

@Composable
private fun SetupButton(
    label: String,
    primary: Boolean,
    onClick: () -> Unit,
    enabled: Boolean = true,
    focusRequester: FocusRequester = remember { FocusRequester() }
) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val scale by animateFloatAsState(if (focused) 1.04f else 1f, tween(180), label = "btnScale")
    val borderColor = when {
        focused -> nocturne.accent
        primary -> nocturne.accent
        else -> Neutral700
    }
    Box(
        modifier = Modifier
            .scale(scale)
            .clip(RoundedCornerShape(nocturne.radiusMd.dp))
            .background(if (focused) nocturne.accent900 else Color.Transparent)
            .border(if (focused) 2.dp else 1.dp, borderColor, RoundedCornerShape(nocturne.radiusMd.dp))
            .focusRequester(focusRequester)
            .clickable(enabled = enabled, interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = if (primary) 30.dp else 26.dp, vertical = 17.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = when {
                !enabled -> Neutral700
                primary -> Accent200
                else -> Neutral300
            },
            fontSize = 21.sp
        )
    }
}

fun generateQrBitmap(data: String, size: Int): Bitmap {
    val bits = QRCodeWriter().encode(data, BarcodeFormat.QR_CODE, size, size)
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
    for (x in 0 until size) {
        for (y in 0 until size) {
            bitmap.setPixel(x, y, if (bits[x, y]) AndroidColor.BLACK else AndroidColor.WHITE)
        }
    }
    return bitmap
}

