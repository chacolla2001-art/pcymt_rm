import java.util.Properties
import java.io.FileInputStream

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.ksp)
}

// --------------------------------------------------
// Load local.properties (environment configuration)
// --------------------------------------------------
val localProperties = Properties().apply {
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        load(localPropertiesFile.inputStream())
    }
}

// Environment configuration with defaults
val baseUrl: String = localProperties.getProperty("BASE_URL")
    ?: error("BASE_URL not set in local.properties. Copy local.properties.example and configure it.")
val maxAnchorsPerSession: String = localProperties.getProperty("MAX_ANCHORS_PER_SESSION") ?: "5"
val arcoreApiKey: String = localProperties.getProperty("ARCORE_API_KEY") ?: ""
// WEB_CLIENT_ID is now fetched from backend via /api/config endpoint
// Google Maps API Key removed - using custom ParkMapView

// --------------------------------------------------
// Load key.properties (signing configuration)
// --------------------------------------------------
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")

if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.univalle.pedrochacolla"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.univalle.pedrochacolla"
        minSdk = 30
        targetSdk = 35
        compileSdk = 35
        versionCode = 17
        versionName = "1.0.5"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // API Configuration from local.properties
        buildConfigField("String", "BASE_URL", "\"$baseUrl\"")
        buildConfigField("int", "MAX_ANCHORS_PER_SESSION", maxAnchorsPerSession)
        // WEB_CLIENT_ID is now fetched from backend via ConfigManager
        // Maps API Key removed - using custom ParkMapView

        // Single build — admin features via user role, TTL extended via CLI
        resValue("string", "app_name", "Realidad Mixta")
        buildConfigField("String", "ARCORE_API_KEY", "\"$arcoreApiKey\"")
        manifestPlaceholders["ARCORE_API_KEY"] = arcoreApiKey
    }

    // --------------------------------------------------
    // Signing configuration (RELEASE).
    // --------------------------------------------------
    signingConfigs {
        create("release") {
            storeFile = rootProject.file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("release")
            buildConfigField("String", "BASE_URL", "\"$baseUrl\"")
            buildConfigField("int", "MAX_ANCHORS_PER_SESSION", maxAnchorsPerSession)
        }
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            buildConfigField("String", "BASE_URL", "\"$baseUrl\"")
            buildConfigField("int", "MAX_ANCHORS_PER_SESSION", maxAnchorsPerSession)
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    // AndroidX Core
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.constraintlayout)

    // Material Design
    implementation(libs.material)

    // Lifecycle
    implementation(libs.androidx.lifecycle.livedata.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)

    // Navigation
    implementation(libs.androidx.navigation.fragment.ktx)
    implementation(libs.androidx.navigation.ui.ktx)

    // Google Services
    implementation(libs.googleid)
    implementation(libs.play.services.location)
    // Google Maps removed - using custom ParkMapView

    // AR Core & SceneView
    implementation(libs.core)
    implementation(libs.sceneview)
    implementation(libs.arsceneview)

    // Networking
    implementation(libs.okhttp)
    implementation(libs.gson)

    // Credential Manager
    implementation(libs.credentials)
    implementation(libs.credentials.play.services)

    // Image Loading (Glide with OkHttp for authenticated requests)
    implementation(libs.glide)
    implementation(libs.glide.okhttp)
    ksp(libs.glide.ksp)

    // Security (EncryptedSharedPreferences)
    implementation(libs.androidx.security.crypto)

    // Networking (Retrofit)
    implementation(libs.retrofit)
    implementation(libs.retrofit.gson)
    implementation(libs.logging.interceptor)

    // Dependency Injection (Hilt)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    // Room (Local Database)
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // SVG rendering (for map stickers)
    implementation(libs.androidsvg)

    // Logging
    implementation(libs.timber)

    // Testing - Unit Tests
    testImplementation(libs.junit)
    testImplementation(libs.mockito.kotlin)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
    testImplementation(libs.androidx.arch.core.testing)

    // Testing - Instrumented Tests
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.runner)
    androidTestImplementation(libs.mockito.android)
    androidTestImplementation(libs.hilt.android.testing)
    kspAndroidTest(libs.hilt.compiler)
}

// Sync map stickers from monorepo shared source
tasks.register<Copy>("syncMapStickers") {
    from(rootProject.projectDir.resolve("../../shared/map-stickers"))
    into(layout.projectDirectory.dir("src/main/assets/map-stickers"))
}

tasks.named("preBuild") {
    dependsOn("syncMapStickers")
}
