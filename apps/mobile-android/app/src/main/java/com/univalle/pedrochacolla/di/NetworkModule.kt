package com.univalle.pedrochacolla.di

import com.univalle.pedrochacolla.data.remote.RetrofitClient
import com.univalle.pedrochacolla.data.remote.api.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

/**
 * NetworkModule - Provides network-related dependencies
 *
 * @Module tells Hilt this is a dependency provider
 * @InstallIn(SingletonComponent::class) makes dependencies available app-wide
 * @Singleton ensures single instance across the app
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideRetrofit(): Retrofit = RetrofitClient.retrofit

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApiService =
        retrofit.create(AuthApiService::class.java)

    @Provides
    @Singleton
    fun provideLocationApi(retrofit: Retrofit): LocationApiService =
        retrofit.create(LocationApiService::class.java)

    @Provides
    @Singleton
    fun provideVirtualAssetApi(retrofit: Retrofit): VirtualAssetApiService =
        retrofit.create(VirtualAssetApiService::class.java)

    @Provides
    @Singleton
    fun provideInteractionApi(retrofit: Retrofit): InteractionApiService =
        retrofit.create(InteractionApiService::class.java)

    @Provides
    @Singleton
    fun provideUserApi(retrofit: Retrofit): UserApiService =
        retrofit.create(UserApiService::class.java)

    @Provides
    @Singleton
    fun provideMapTileApi(retrofit: Retrofit): MapTileApiService =
        retrofit.create(MapTileApiService::class.java)
}
