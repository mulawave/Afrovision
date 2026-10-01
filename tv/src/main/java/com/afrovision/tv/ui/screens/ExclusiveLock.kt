package com.afrovision.tv.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.afrovision.tv.data.TvViewModel
import com.afrovision.tv.ui.sound.TvSoundManager
import com.afrovision.tv.ui.theme.LocalNocturne
import kotlinx.coroutines.delay

private const val PIN_LENGTH = 4
private const val PIC_LENGTH = 10
private const val HIDDEN_PRESSES_TO_REVEAL = 7
private const val HIDDEN_PRESS_GAP_MS = 3_000L

/**
 * The Exclusive screen before the PIN is entered: empty on purpose. A hidden
 * spot in the bottom-right corner (the only focusable thing here, so D-pad
 * right from the menu lands on it) reveals the PIN field after OK is pressed
 * 7+ times in a row. Nothing on screen hints that it exists.
 */
@Composable
fun ExclusiveLockedScreen(viewModel: TvViewModel) {
    val nocturne = LocalNocturne.current
    var presses by remember { mutableIntStateOf(0) }
    var lastPressAt by remember { mutableLongStateOf(0L) }
    var showPin by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize().background(nocturne.background)) {
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .size(120.dp)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null
                ) {
                    val now = System.currentTimeMillis()
                    presses = if (now - lastPressAt > HIDDEN_PRESS_GAP_MS) 1 else presses + 1
                    lastPressAt = now
                    if (presses >= HIDDEN_PRESSES_TO_REVEAL) {
                        presses = 0
                        showPin = true
                    }
                }
        )
    }

    if (showPin) {
        LockDialog(onDismiss = { showPin = false }) {
            PinUnlockContent(viewModel = viewModel, onCancel = { showPin = false })
        }
    }
}

@Composable
private fun PinUnlockContent(viewModel: TvViewModel, onCancel: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun submit() {
        if (busy) return
        if (pin.length != PIN_LENGTH) {
            error = "Enter your $PIN_LENGTH-digit PIN."
            return
        }
        busy = true
        viewModel.unlockExclusive(pin) { message ->
            busy = false
            if (message != null) {
                error = message
                pin = ""
            }
        }
    }

    LockTitle("Enter PIN")
    CodeField(
        value = pin,
        onValueChange = { pin = it.filter(Char::isDigit).take(PIN_LENGTH); error = null },
        placeholder = "$PIN_LENGTH-digit PIN",
        secret = true,
        onSubmit = ::submit
    )
    LockError(error)
    LockButtons(primary = if (busy) "Checking…" else "Unlock", onPrimary = ::submit, onCancel = onCancel)
}

private enum class ActivationStep { Channel, Pic, CreatePin, ConfirmPin, Done }

/**
 * Profile → "Activate exclusive content": PIC (from My PICs in the app or
 * website) → create PIN → confirm PIN. Only subscribers have a PIC, so the
 * channel list comes from the account's active exclusive subscriptions.
 */
@Composable
fun ExclusiveActivationDialog(viewModel: TvViewModel, onDismiss: () -> Unit) {
    val subscriptions = viewModel.exclusiveSubscriptions
    var channelId by remember { mutableStateOf(subscriptions.singleOrNull()?.channelId) }
    var step by remember { mutableStateOf(if (subscriptions.size > 1) ActivationStep.Channel else ActivationStep.Pic) }
    var pic by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    LockDialog(onDismiss = onDismiss) {
        if (subscriptions.isEmpty()) {
            LockTitle("No exclusive subscription")
            LockBody("Exclusive content needs an active subscription to an exclusive channel. Your PIC is shown under My PICs in the AfroVision app and website.")
            LockButtons(primary = "Close", onPrimary = onDismiss, onCancel = null)
            return@LockDialog
        }

        when (step) {
            ActivationStep.Channel -> {
                LockTitle("Choose the channel")
                LockBody("Pick the exclusive channel whose PIC you'll enter.")
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    subscriptions.forEach { access ->
                        LockButton(
                            label = access.channelName.ifBlank { "Exclusive channel" },
                            primary = false,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            channelId = access.channelId
                            step = ActivationStep.Pic
                        }
                    }
                }
                LockButtons(primary = null, onPrimary = {}, onCancel = onDismiss)
            }

            ActivationStep.Pic -> {
                fun submit() {
                    val id = channelId ?: return
                    if (busy) return
                    if (pic.length != PIC_LENGTH) {
                        error = "Your PIC is $PIC_LENGTH characters."
                        return
                    }
                    busy = true
                    viewModel.verifyExclusivePic(id, pic) { message ->
                        busy = false
                        if (message == null) {
                            error = null
                            step = ActivationStep.CreatePin
                        } else {
                            error = message
                        }
                    }
                }
                LockTitle("Enter your PIC")
                LockBody("Find it under My PICs in the AfroVision app or website.")
                CodeField(
                    value = pic,
                    onValueChange = { value ->
                        pic = value.uppercase().filter { it.isLetterOrDigit() }.take(PIC_LENGTH)
                        error = null
                    },
                    placeholder = "$PIC_LENGTH-character PIC",
                    secret = false,
                    onSubmit = ::submit
                )
                LockError(error)
                LockButtons(primary = if (busy) "Checking…" else "Continue", onPrimary = ::submit, onCancel = onDismiss)
            }

            ActivationStep.CreatePin -> {
                fun submit() {
                    if (pin.length != PIN_LENGTH) {
                        error = "Choose a $PIN_LENGTH-digit PIN."
                        return
                    }
                    error = null
                    step = ActivationStep.ConfirmPin
                }
                LockTitle("Create a PIN")
                LockBody("You'll enter this PIN on this TV to open Exclusive.")
                CodeField(
                    value = pin,
                    onValueChange = { pin = it.filter(Char::isDigit).take(PIN_LENGTH); error = null },
                    placeholder = "$PIN_LENGTH-digit PIN",
                    secret = true,
                    onSubmit = ::submit
                )
                LockError(error)
                LockButtons(primary = "Continue", onPrimary = ::submit, onCancel = onDismiss)
            }

            ActivationStep.ConfirmPin -> {
                fun submit() {
                    if (confirm != pin) {
                        error = "The PINs don't match. Try again."
                        pin = ""
                        confirm = ""
                        step = ActivationStep.CreatePin
                        return
                    }
                    viewModel.setExclusivePin(pin)
                    error = null
                    step = ActivationStep.Done
                }
                LockTitle("Confirm your PIN")
                CodeField(
                    value = confirm,
                    onValueChange = { confirm = it.filter(Char::isDigit).take(PIN_LENGTH); error = null },
                    placeholder = "Re-enter PIN",
                    secret = true,
                    onSubmit = ::submit
                )
                LockError(error)
                LockButtons(primary = "Save PIN", onPrimary = ::submit, onCancel = onDismiss)
            }

            ActivationStep.Done -> {
                LockTitle("Exclusive activated")
                LockBody("Exclusive is now in the menu. It opens locked; enter your PIN to view it.")
                LockButtons(primary = "Done", onPrimary = onDismiss, onCancel = null)
            }
        }
    }
}

// ── Shared pieces ───────────────────────────────────────────────

@Composable
private fun LockDialog(onDismiss: () -> Unit, content: @Composable () -> Unit) {
    val nocturne = LocalNocturne.current
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        BackHandler { TvSoundManager.play("back"); onDismiss() }
        Box(
            modifier = Modifier.fillMaxSize().background(nocturne.background.copy(alpha = 0.94f)),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier
                    .width(620.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(nocturne.surfaceRaised)
                    .border(1.dp, nocturne.borderCard, RoundedCornerShape(18.dp))
                    .padding(40.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                content()
            }
        }
    }
}

@Composable
private fun LockTitle(text: String) {
    Text(text = text, color = LocalNocturne.current.text, fontSize = 30.sp, fontWeight = FontWeight.Medium)
}

@Composable
private fun LockBody(text: String) {
    Text(text = text, color = LocalNocturne.current.textMuted, fontSize = 18.sp, lineHeight = 26.sp)
}

@Composable
private fun LockError(text: String?) {
    if (text != null) Text(text = text, color = LocalNocturne.current.red, fontSize = 17.sp)
}

@Composable
private fun CodeField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    secret: Boolean,
    onSubmit: () -> Unit
) {
    val nocturne = LocalNocturne.current
    val focusRequester = remember { FocusRequester() }
    var focused by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(250)
        try { focusRequester.requestFocus() } catch (_: IllegalStateException) { }
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(72.dp)
            .clip(RoundedCornerShape(12.dp))
            .border(2.dp, if (focused) nocturne.accent else nocturne.borderCard, RoundedCornerShape(12.dp))
            .background(nocturne.surface)
            .padding(horizontal = 24.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        if (value.isEmpty()) {
            Text(text = placeholder, color = nocturne.textHint, fontSize = 22.sp)
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = TextStyle(color = nocturne.text, fontSize = 28.sp, letterSpacing = 6.sp),
            cursorBrush = SolidColor(nocturne.accent),
            visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(
                keyboardType = if (secret) KeyboardType.NumberPassword else KeyboardType.Ascii,
                capitalization = if (secret) KeyboardCapitalization.None else KeyboardCapitalization.Characters,
                autoCorrect = false,
                imeAction = ImeAction.Done
            ),
            keyboardActions = KeyboardActions(onDone = { onSubmit() }),
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(focusRequester)
                .onFocusChanged { focused = it.isFocused }
        )
    }
}

@Composable
private fun LockButtons(primary: String?, onPrimary: () -> Unit, onCancel: (() -> Unit)?) {
    Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(top = 4.dp)) {
        if (primary != null) LockButton(label = primary, primary = true, onClick = onPrimary)
        if (onCancel != null) LockButton(label = "Cancel", primary = false, onClick = onCancel)
    }
}

@Composable
private fun LockButton(label: String, primary: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val nocturne = LocalNocturne.current
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    LaunchedEffect(focused) { if (focused) TvSoundManager.play("move") }

    Box(
        modifier = modifier
            .height(60.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (primary) nocturne.accent.copy(alpha = if (focused) 1f else 0.85f) else nocturne.surface)
            .border(2.dp, if (focused) nocturne.text else if (primary) nocturne.accent else nocturne.borderCard, RoundedCornerShape(12.dp))
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 30.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = if (primary) nocturne.background else nocturne.text,
            fontSize = 20.sp,
            fontWeight = FontWeight.Medium
        )
    }
}
