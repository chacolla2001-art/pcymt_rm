# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep line number information for debugging stack traces.
-keepattributes SourceFile,LineNumberTable

# Preserve generic type signatures — Retrofit + Gson need all three of these
# attributes together; missing any one of them breaks ParameterizedType resolution
# in R8 full mode (default since AGP 8.0).
-keepattributes Signature, InnerClasses, EnclosingMethod

# Preserve method/parameter annotations (required by Retrofit for @Body, @Part, etc.)
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations

# Preserve default annotation values (e.g. retrofit2.http.Field.encoded)
-keepattributes AnnotationDefault

# Preserve other annotations (Hilt @Inject, Gson @SerializedName, etc.)
-keepattributes *Annotation*

# Hide the original source file name.
-renamesourcefileattribute SourceFile

# ═══════════════════════════════════════════════════════════════
# GSON - Keep model classes for JSON serialization
# ═══════════════════════════════════════════════════════════════

# Keep all model classes
-keep class com.univalle.pedrochacolla.data.model.** { *; }

# Gson specific classes
-dontwarn sun.misc.**
-keep class com.google.gson.stream.** { *; }

# Prevent proguard from stripping interface information from TypeAdapter, TypeAdapterFactory,
# JsonSerializer, JsonDeserializer instances (so they can be used in @JsonAdapter)
-keep class * extends com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Prevent R8 from leaving Data object members always null
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}

# ═══════════════════════════════════════════════════════════════
# OkHttp
# ═══════════════════════════════════════════════════════════════
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase
-dontwarn org.codehaus.mojo.animal_sniffer.*
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# ═══════════════════════════════════════════════════════════════
# Glide
# ═══════════════════════════════════════════════════════════════
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule {
 <init>(...);
}
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
  **[] $VALUES;
  public *;
}
-keep class com.bumptech.glide.load.data.ParcelFileDescriptorRewinder$InternalRewinder {
  *** rewind();
}

# ═══════════════════════════════════════════════════════════════
# ARCore / SceneView
# ═══════════════════════════════════════════════════════════════
-keep class com.google.ar.** { *; }
-keep class io.github.sceneview.** { *; }
-dontwarn com.google.ar.**
-dontwarn io.github.sceneview.**

# ═══════════════════════════════════════════════════════════════
# Google Play Services
# ═══════════════════════════════════════════════════════════════
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# ═══════════════════════════════════════════════════════════════
# AndroidX / Jetpack
# ═══════════════════════════════════════════════════════════════
-keep class androidx.** { *; }
-dontwarn androidx.**

# Keep ViewBinding classes
-keep class * implements androidx.viewbinding.ViewBinding {
    *;
}

# ═══════════════════════════════════════════════════════════════
# Kotlin
# ═══════════════════════════════════════════════════════════════
-dontwarn kotlin.**
-keep class kotlin.Metadata { *; }
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}

# ═══════════════════════════════════════════════════════════════
# RETROFIT 2 — Official rules for R8 full mode (AGP 8.x default)
# Source: https://github.com/square/retrofit/blob/trunk/retrofit/src/main/resources/META-INF/proguard/retrofit2.pro
# ═══════════════════════════════════════════════════════════════
-keep class retrofit2.** { *; }
-dontwarn retrofit2.**
-dontwarn retrofit2.Platform$Java8
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# Retain service method parameters when optimizing.
# NOTE: -keepclassmembers (NOT -keepclassmembernames) is required so that R8
# keeps the full generic method signature, not just the method name.
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

# With R8 full mode, interfaces are replaced with null because no subtypes
# are visible (they're created dynamically via Proxy). This rule prevents that.
-if interface * { @retrofit2.http.* <methods>; }
-keep,allowobfuscation interface <1>

# ═══════════════════════════════════════════════════════════════
# GSON — TypeToken / generic types (R8 full mode fix)
# Without these rules R8 removes the ParameterizedType info that
# Gson needs to deserialise ApiResponse<T> wrappers.
# ═══════════════════════════════════════════════════════════════
-keep,allowobfuscation,allowshrinking class com.google.gson.reflect.TypeToken
-keep,allowobfuscation,allowshrinking class * extends com.google.gson.reflect.TypeToken

# Also keep the internal Gson classes that use reflection
-keep class com.google.gson.** { *; }

# Keep all remote-API response wrappers (AuthResponse, AppConfig …)
-keep class com.univalle.pedrochacolla.data.remote.api.** { *; }

# ═══════════════════════════════════════════════════════════════
# CREDENTIAL MANAGER — Google Sign-In (Jetpack)
# R8 strips these classes in release, causing the Credential
# Manager flow to crash before it can reach the server.
# ═══════════════════════════════════════════════════════════════
-keep class androidx.credentials.** { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }
-dontwarn androidx.credentials.**
-dontwarn com.google.android.libraries.identity.googleid.**

# ═══════════════════════════════════════════════════════════════
# HILT / DAGGER
# ═══════════════════════════════════════════════════════════════
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-dontwarn dagger.hilt.**
-keepclassmembers class * {
    @javax.inject.Inject <init>(...);
    @javax.inject.Inject <fields>;
}

# Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

# ═══════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ═══════════════════════════════════════════════════════════════
# Parcelable
# ═══════════════════════════════════════════════════════════════
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# ═══════════════════════════════════════════════════════════════
# Serializable
# ═══════════════════════════════════════════════════════════════
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ═══════════════════════════════════════════════════════════════
# androidsvg — Keep SVG parser and renderer classes
# ═══════════════════════════════════════════════════════════════
-keep class com.caverock.androidsvg.** { *; }
