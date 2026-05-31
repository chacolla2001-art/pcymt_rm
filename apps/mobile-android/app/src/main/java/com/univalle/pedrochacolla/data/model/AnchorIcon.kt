package com.univalle.pedrochacolla.data.model

/**
 * Represents an anchor point icon for display in the collection/carousel
 * No longer depends on Google Maps LatLng
 */
data class AnchorIcon(
    val anchorId: String,
    val iconUrl: String,
    val latitude: Double,
    val longitude: Double,
    val description: String
)
