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
        versionCode = 37
        versionName = "4.6"
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
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
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

    implementation("androidx.tv:tv-foundation:1.0.0-alpha10")
    implementation("androidx.tv:tv-material:1.0.0-alpha10")

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

    // Socket.IO client — used for TV-to-TV chat delivery (chat/ChatSocket.kt)
    // and channel live-viewer presence (player/ChannelViewerSocket.kt), both
    // talking to the same backend/src/realtime/socket.service.js server the
    // Flutter app and website connect to.
    implementation("io.socket:socket.io-client:2.1.1") {
        exclude(group = "org.json", module = "json")
    }
}
