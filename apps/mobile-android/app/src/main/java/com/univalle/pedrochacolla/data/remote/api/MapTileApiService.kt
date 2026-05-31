package com.univalle.pedrochacolla.data.remote.api

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Path
import retrofit2.http.Streaming

/**
 * Retrofit service for the pre-rendered tile-map API.
 *
 * All GET endpoints are public (no auth required).
 * Supports ETag / If-None-Match for efficient cache validation.
 */
interface MapTileApiService {

    /** Fetch tile manifest (version, zoom levels, overlay list, hashes). */
    @GET("api/map/manifest")
    suspend fun getManifest(
        @Header("If-None-Match") etag: String? = null
    ): Response<ResponseBody>

    /** Fetch a single tile image at zoom/x/y. */
    @Streaming
    @GET("api/map/tiles/{z}/{x}_{y}.png")
    suspend fun getTile(
        @Path("z") z: Int,
        @Path("x") x: Int,
        @Path("y") y: Int
    ): Response<ResponseBody>

    /** Download all tiles for a zoom level as a ZIP archive. */
    @Streaming
    @GET("api/map/tiles/{z}/all.zip")
    suspend fun getZoomZip(
        @Path("z") z: Int
    ): Response<ResponseBody>

    /** Fetch a named overlay JSON (anchors, zones, stickers, pois). */
    @GET("api/map/overlays/{name}")
    suspend fun getOverlay(
        @Path("name") name: String,
        @Header("If-None-Match") etag: String? = null
    ): Response<ResponseBody>
}
