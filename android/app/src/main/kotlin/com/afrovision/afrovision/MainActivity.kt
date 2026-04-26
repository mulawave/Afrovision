package com.afrovision.afrovision

import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.afrovision.afrovision/integrity"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                if (call.method == "requestIntegrityToken") {
                    val nonce = call.argument<String>("nonce")
                    val projectNumberStr = call.argument<String>("cloudProjectNumber")
                    if (nonce == null || projectNumberStr == null) {
                        result.error("INVALID_ARGS", "Missing nonce or cloudProjectNumber", null)
                        return@setMethodCallHandler
                    }
                    val projectNumber = projectNumberStr.toLongOrNull()
                    if (projectNumber == null) {
                        result.error("INVALID_ARGS", "cloudProjectNumber is not a valid long", null)
                        return@setMethodCallHandler
                    }
                    val integrityManager = IntegrityManagerFactory.create(applicationContext)
                    integrityManager.requestIntegrityToken(
                        IntegrityTokenRequest.builder()
                            .setNonce(nonce)
                            .setCloudProjectNumber(projectNumber)
                            .build()
                    ).addOnSuccessListener { response ->
                        result.success(response.token())
                    }.addOnFailureListener { e ->
                        result.error("INTEGRITY_ERROR", e.message, null)
                    }
                } else {
                    result.notImplemented()
                }
            }
    }
}
