package com.univalle.pedrochacolla.data.model

/**
 * Sticker system data models — replicates frontend sticker.model.ts
 */

/** Catalog entry — one per sticker PNG */
data class StickerDefinition(
    val key: String,      // filename without extension (e.g. "aguastaypi")
    val name: String,     // display name (e.g. "Aguas Taypi")
    val imagePath: String // path in assets (e.g. "map-stickers/aguastaypi.png")
)

/** A placed sticker instance on the map */
data class StickerInstance(
    val id: String,
    val stickerKey: String,
    val lat: Double,
    val lng: Double,
    val scale: Float = 1.0f,      // 0.1 – 5.0
    val rotation: Float = 0f,     // 0 – 360
    val opacity: Float = 1.0f     // 0.0 – 1.0
)

/** Named collection of sticker instances */
data class StickerLayer(
    val id: String,
    val name: String,
    val visible: Boolean = true,
    val opacity: Float = 1.0f,  // 0.0 – 1.0 applied to ALL stickers in the layer
    val stickers: MutableList<StickerInstance> = mutableListOf()
)

/** Complete catalog of stickers matching frontend */
val STICKER_CATALOG: List<StickerDefinition> = listOf(
    // Elementos del parque (001–033)
    StickerDefinition("001", "Elemento 01", "map-stickers/001.svg"),
    StickerDefinition("002", "Elemento 02", "map-stickers/002.svg"),
    StickerDefinition("003", "Elemento 03", "map-stickers/003.svg"),
    StickerDefinition("004", "Elemento 04", "map-stickers/004.svg"),
    StickerDefinition("005", "Elemento 05", "map-stickers/005.svg"),
    StickerDefinition("006", "Elemento 06", "map-stickers/006.svg"),
    StickerDefinition("007", "Elemento 07", "map-stickers/007.svg"),
    StickerDefinition("008", "Elemento 08", "map-stickers/008.svg"),
    StickerDefinition("009", "Elemento 09", "map-stickers/009.svg"),
    StickerDefinition("010", "Elemento 10", "map-stickers/010.svg"),
    StickerDefinition("011", "Elemento 11", "map-stickers/011.svg"),
    StickerDefinition("012", "Elemento 12", "map-stickers/012.svg"),
    StickerDefinition("013", "Elemento 13", "map-stickers/013.svg"),
    StickerDefinition("014", "Elemento 14", "map-stickers/014.svg"),
    StickerDefinition("015", "Elemento 15", "map-stickers/015.svg"),
    StickerDefinition("016", "Elemento 16", "map-stickers/016.svg"),
    StickerDefinition("017", "Elemento 17", "map-stickers/017.svg"),
    StickerDefinition("018", "Elemento 18", "map-stickers/018.svg"),
    StickerDefinition("019", "Elemento 19", "map-stickers/019.svg"),
    StickerDefinition("020", "Elemento 20", "map-stickers/020.svg"),
    StickerDefinition("021", "Elemento 21", "map-stickers/021.svg"),
    StickerDefinition("022", "Elemento 22", "map-stickers/022.svg"),
    StickerDefinition("023", "Elemento 23", "map-stickers/023.svg"),
    StickerDefinition("024", "Elemento 24", "map-stickers/024.svg"),
    StickerDefinition("025", "Elemento 25", "map-stickers/025.svg"),
    StickerDefinition("026", "Elemento 26", "map-stickers/026.svg"),
    StickerDefinition("027", "Elemento 27", "map-stickers/027.svg"),
    StickerDefinition("028", "Elemento 28", "map-stickers/028.svg"),
    StickerDefinition("029", "Elemento 29", "map-stickers/029.svg"),
    StickerDefinition("030", "Elemento 30", "map-stickers/030.svg"),
    StickerDefinition("031", "Elemento 31", "map-stickers/031.svg"),
    StickerDefinition("032", "Elemento 32", "map-stickers/032.svg"),
    StickerDefinition("033", "Elemento 33", "map-stickers/033.svg"),
    // Árboles
    StickerDefinition("tree-1", "Árbol 1", "map-stickers/tree-1.svg"),
    StickerDefinition("tree-2", "Árbol 2", "map-stickers/tree-2.svg"),
    StickerDefinition("tree-3", "Árbol 3", "map-stickers/tree-3.svg"),
    StickerDefinition("tree-4", "Árbol 4", "map-stickers/tree-4.svg"),
    StickerDefinition("tree-5", "Árbol 5", "map-stickers/tree-5.svg"),
    StickerDefinition("tree-6", "Árbol 6", "map-stickers/tree-6.svg"),
    // Otros
    StickerDefinition("zampona", "Zampoña", "map-stickers/zampona.png")
)
