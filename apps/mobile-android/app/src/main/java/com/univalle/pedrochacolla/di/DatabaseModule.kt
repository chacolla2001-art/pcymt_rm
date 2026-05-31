package com.univalle.pedrochacolla.di

import android.content.Context
import androidx.room.Room
import com.univalle.pedrochacolla.data.local.AppDatabase
import com.univalle.pedrochacolla.data.local.dao.MapTileDao
import com.univalle.pedrochacolla.data.repository.MapSyncManager
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "pcymt_rm_db"
        ).build()

    @Provides
    @Singleton
    fun provideMapTileDao(db: AppDatabase): MapTileDao =
        db.mapTileDao()

    @Provides
    @Singleton
    fun provideMapSyncManager(
        @ApplicationContext context: Context,
        dao: MapTileDao
    ): MapSyncManager = MapSyncManager(context, dao)
}
