package com.afrovision.tv.ui.sound

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

private data class Voice(
    val f: Float,
    val to: Float,
    val type: String,
    val dur: Float,
    val peak: Float
)

private data class Cue(val voices: List<Voice>)

object TvSoundManager {
    private const val SAMPLE_RATE = 44100
    private const val ATTACK = 0.008f

    private val cueMap: Map<String, Cue> = mapOf(
        "move" to Cue(listOf(
            Voice(f = 1180f, to = 1180f, type = "triangle", dur = 0.045f, peak = 0.35f),
            Voice(f = 2360f, to = 2360f, type = "sine", dur = 0.03f, peak = 0.12f)
        )),
        "row" to Cue(listOf(
            Voice(f = 720f, to = 900f, type = "triangle", dur = 0.075f, peak = 0.4f)
        )),
        "rail" to Cue(listOf(
            Voice(f = 520f, to = 470f, type = "sine", dur = 0.09f, peak = 0.4f)
        )),
        "select" to Cue(listOf(
            Voice(f = 620f, to = 980f, type = "sine", dur = 0.13f, peak = 0.5f),
            Voice(f = 1240f, to = 1960f, type = "sine", dur = 0.11f, peak = 0.16f)
        )),
        "screen" to Cue(listOf(
            Voice(f = 380f, to = 620f, type = "sine", dur = 0.18f, peak = 0.42f)
        )),
        "back" to Cue(listOf(
            Voice(f = 520f, to = 340f, type = "sine", dur = 0.12f, peak = 0.4f)
        )),
        "edge" to Cue(listOf(
            Voice(f = 190f, to = 150f, type = "sine", dur = 0.1f, peak = 0.3f)
        )),
        "boot" to Cue(listOf(
            Voice(f = 220f, to = 660f, type = "sine", dur = 0.9f, peak = 0.4f),
            Voice(f = 330f, to = 990f, type = "triangle", dur = 0.7f, peak = 0.12f)
        )),
        "toggle" to Cue(listOf(
            Voice(f = 460f, to = 700f, type = "square", dur = 0.06f, peak = 0.1f)
        )),
        "success" to Cue(listOf(
            Voice(f = 520f, to = 660f, type = "sine", dur = 0.14f, peak = 0.4f),
            Voice(f = 780f, to = 1040f, type = "sine", dur = 0.34f, peak = 0.26f)
        )),
        "tune" to Cue(listOf(
            Voice(f = 300f, to = 1500f, type = "sawtooth", dur = 0.42f, peak = 0.16f),
            Voice(f = 900f, to = 600f, type = "sine", dur = 0.3f, peak = 0.22f)
        )),
        "locked" to Cue(listOf(
            Voice(f = 300f, to = 120f, type = "square", dur = 0.16f, peak = 0.14f)
        )),
        "surfer" to Cue(listOf(
            Voice(f = 800f, to = 1320f, type = "triangle", dur = 0.14f, peak = 0.32f)
        )),
        "chan" to Cue(listOf(
            Voice(f = 1500f, to = 1180f, type = "triangle", dur = 0.06f, peak = 0.34f),
            Voice(f = 620f, to = 620f, type = "sine", dur = 0.05f, peak = 0.14f)
        )),
        "like" to Cue(listOf(
            Voice(f = 880f, to = 1760f, type = "sine", dur = 0.14f, peak = 0.4f)
        )),
        "reshare" to Cue(listOf(
            Voice(f = 700f, to = 1050f, type = "triangle", dur = 0.16f, peak = 0.3f),
            Voice(f = 1400f, to = 2100f, type = "sine", dur = 0.1f, peak = 0.1f)
        )),
        "send" to Cue(listOf(
            Voice(f = 520f, to = 1800f, type = "sine", dur = 0.3f, peak = 0.3f)
        )),
        "page" to Cue(listOf(
            Voice(f = 1400f, to = 900f, type = "triangle", dur = 0.09f, peak = 0.28f)
        )),
        "more" to Cue(listOf(
            Voice(f = 420f, to = 700f, type = "sine", dur = 0.16f, peak = 0.3f)
        )),
        "read" to Cue(listOf(
            Voice(f = 980f, to = 1240f, type = "sine", dur = 0.09f, peak = 0.28f)
        )),
        "update" to Cue(listOf(
            Voice(f = 520f, to = 780f, type = "sine", dur = 0.24f, peak = 0.36f),
            Voice(f = 780f, to = 1170f, type = "sine", dur = 0.34f, peak = 0.2f)
        )),
        "close" to Cue(listOf(
            Voice(f = 700f, to = 260f, type = "sine", dur = 0.16f, peak = 0.34f)
        ))
    )

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    @Volatile
    var enabled: Boolean = true

    @Volatile
    var volume: Float = 0.5f

    fun play(kind: String) {
        val cue = cueMap[kind] ?: return
        scope.launch {
            if (!enabled) return@launch
            val masterVolume = volume * 0.5f
            val samples = renderCue(cue, masterVolume)
            playSamples(samples)
        }
    }

    private fun renderCue(cue: Cue, masterVolume: Float): ShortArray {
        val totalDur = cue.voices.maxOf { it.dur }
        val totalSamples = (totalDur * SAMPLE_RATE).toInt()
        val buffer = ShortArray(totalSamples) { 0 }

        for (voice in cue.voices) {
            val voiceSamples = renderVoice(voice, masterVolume)
            for (i in voiceSamples.indices) {
                if (i < buffer.size) {
                    val sum = buffer[i].toInt() + voiceSamples[i].toInt()
                    buffer[i] = sum.toShort()
                }
            }
        }
        return buffer
    }

    private fun renderVoice(voice: Voice, masterVolume: Float): ShortArray {
        val n = (voice.dur * SAMPLE_RATE).toInt()
        val samples = ShortArray(n)
        var phase = 0.0

        for (i in 0 until n) {
            val t = i / SAMPLE_RATE.toFloat()
            val ratio = t / voice.dur
            val freq = if (voice.f == voice.to) {
                voice.f
            } else {
                voice.f * exp(ln(voice.to / voice.f) * ratio)
            }

            phase += 2.0 * PI * freq / SAMPLE_RATE
            phase %= 2.0 * PI

            val raw = when (voice.type) {
                "sine" -> sin(phase)
                "triangle" -> (2.0 / PI) * asin(sin(phase))
                "square" -> if (sin(phase) >= 0) 1.0 else -1.0
                "sawtooth" -> 2.0 * (phase / (2.0 * PI) - floor(phase / (2.0 * PI) + 0.5))
                else -> sin(phase)
            }

            val amp = when {
                voice.dur <= ATTACK -> {
                    val decayRatio = t / voice.dur
                    voice.peak * exp(ln(0.0001f / voice.peak) * decayRatio)
                }
                t < ATTACK -> {
                    val attackRatio = t / ATTACK
                    0.0001f * exp(ln(voice.peak / 0.0001f) * attackRatio)
                }
                else -> {
                    val decayRatio = (t - ATTACK) / (voice.dur - ATTACK)
                    voice.peak * exp(ln(0.0001f / voice.peak) * decayRatio)
                }
            }

            val value = raw * amp * masterVolume
            val scaled = min(max(value, -1.0), 1.0) * Short.MAX_VALUE
            samples[i] = scaled.toInt().toShort()
        }

        return samples
    }

    private suspend fun playSamples(samples: ShortArray) {
        val minBuffer = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        val bufferSize = max(samples.size * 2, minBuffer)

        val track = try {
            AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setSampleRate(SAMPLE_RATE)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .build()
                )
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()
        } catch (e: Exception) {
            return
        }

        val written = track.write(samples, 0, samples.size)
        if (written > 0) {
            track.play()
            val durationMs = (samples.size * 1000L / SAMPLE_RATE) + 120L
            delay(durationMs)
        }
        track.stop()
        track.release()
    }
}
