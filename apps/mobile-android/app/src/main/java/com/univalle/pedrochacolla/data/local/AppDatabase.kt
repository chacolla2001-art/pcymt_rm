package com.univalle.pedrochacolla.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.univalle.pedrochacolla.data.local.dao.MapTileDao
import com.univalle.pedrochacolla.data.local.entity.MapManifestEntity
import com.univalle.pedrochacolla.data.local.entity.MapOverlayEntity
import com.univalle.pedrochacolla.data.local.entity.MapTileEntity

@Database(
    entities = [
        MapManifestEntity::class,
        MapOverlayEntity::class,
        MapTileEntity::class,
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun mapTileDao(): MapTileDao
}
