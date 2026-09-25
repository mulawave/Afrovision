import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.afrovision.tv"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.afrovision.tv"
        minSdk = 24
        targetSdk = 36
        versionCode = 40
        versionName = "4.7"
    }

    signingConfigs {
        val propsFile = rootProject.file("key.properties")
        if (propsFile.exists()) {
            create("release") {
                val props = Properties().apply { load(FileInputStream(propsFile)) }
                keyAlias = props["keyAlias"] as String
                keyPassword = props["keyPassword"] as String
                storeFile = rootProject.file(props["storeFile"] as String)
                storePassword = props["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // No debug-key fallback: a debug-signed release can never be
            // upgraded by the real (Ricardo Roze Limited) key already on
            // installed TVs. If key.properties is missing, the release
            // build fails below instead of quietly shipping a dead end.
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    lint {
        disable += setOf(
            "AndroidGradlePluginVersion",
            "GradleDependency"
        )
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")

    val composeBom = platform("androidx.compose:compose-bom:2024.09.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")

    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.5")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.5")

    val media3 = "1.4.1"
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-exoplayer-hls:$media3")
    implementation("androidx.media3:media3-exoplayer-dash:$media3")
    implementation("androidx.media3:media3-session:$media3")
    implementation("androidx.media3:media3-ui:$media3")

    implementation("androidx.media3:media3-datasource-okhttp:1.4.1")

    implementation("io.coil-kt:coil-compose:2.7.0")

    implementation("com.google.zxing:core:3.5.3")
    implementation("androidx.tvprovider:tvprovider:1.1.0")

    val kotlinx = "1.7.3"
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:$kotlinx")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$kotlinx")

    val retrofit = "2.11.0"
    implementation("com.squareup.retrofit2:retrofit:$retrofit")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:$retrofit")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    implementation("androidx.datastore:datastore-preferences:1.1.1")

    implementation("io.socket:socket.io-client:2.1.1") {
        exclude(group = "org.json", module = "json")
    }
}

// Fail release builds loudly when the real signing key isn't configured,
// rather than producing an unsigned (or debug-signed) APK/AAB. Debug builds
// are unaffected.
gradle.taskGraph.whenReady {
    val buildsRelease = allTasks.any { task ->
        task.project == project && task.name.contains("Release") &&
            (task.name.startsWith("assemble") || task.name.startsWith("bundle") ||
                task.name.startsWith("package") || task.name.startsWith("install"))
    }
    if (buildsRelease && android.signingConfigs.findByName("release") == null) {
        throw GradleException(
            "Release signing is not configured: tv/key.properties is missing. " +
                "Add it (keyAlias, keyPassword, storeFile, storePassword) to build a release."
        )
    }
}
