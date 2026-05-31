package com.univalle.pedrochacolla.di

import com.univalle.pedrochacolla.data.remote.api.*
import com.univalle.pedrochacolla.data.repository.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * RepositoryModule - Provides repository dependencies
 *
 * Repositories depend on API services (provided by NetworkModule)
 * Hilt automatically resolves these dependencies
 */
@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideAuthRepository(
        authApi: AuthApiService,
        userApi: UserApiService
    ): AuthRepository = AuthRepository()

    @Provides
    @Singleton
    fun provideLocationRepository(): LocationRepository = LocationRepository()

    @Provides
    @Singleton
    fun provideVirtualAssetRepository(): VirtualAssetRepository = VirtualAssetRepository()

    @Provides
    @Singleton
    fun provideInteractionRepository(): InteractionRepository = InteractionRepository()
}
