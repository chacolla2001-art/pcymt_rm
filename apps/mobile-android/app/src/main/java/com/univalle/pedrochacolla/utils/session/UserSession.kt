package com.univalle.pedrochacolla.utils.session

import com.univalle.pedrochacolla.data.model.UserData

object UserSession {
    @Volatile
    var currentUser: UserData? = null

    fun clear() {
        currentUser = null
    }
}
