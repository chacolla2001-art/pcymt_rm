package com.univalle.pedrochacolla.utils.session

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * AuthEventBus - Global event bus for authentication lifecycle events.
 *
 * Bridges the OkHttp background threads (Authenticator) with the UI layer
 * (MainActivity) without coupling them directly.
 *
 * Consumers:
 *   - Emitter: TokenAuthenticator (background thread via tryEmit)
 *   - Observer: MainActivity (main thread via lifecycleScope)
 */
object AuthEventBus {

    private val _events = MutableSharedFlow<AuthEvent>(extraBufferCapacity = 1)

    /** Observable stream of auth events. Collect this in UI components. */
    val events: SharedFlow<AuthEvent> = _events.asSharedFlow()

    /**
     * Emit an auth event. Safe to call from any thread.
     * extraBufferCapacity = 1 guarantees tryEmit never drops the event.
     */
    fun emit(event: AuthEvent) {
        _events.tryEmit(event)
    }
}

/** Auth lifecycle events */
sealed class AuthEvent {
    /** The access token is invalid/expired and could not be refreshed. User must log in again. */
    object SessionExpired : AuthEvent()
}
