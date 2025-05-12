package app.bitcoinjungle.mobile

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactRootView
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "BitcoinJungle"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
    }

    override fun checkPermission(permission: String, pid: Int, uid: Int): Int {
        return 0
    }

    override fun checkSelfPermission(permission: String): Int {
        return 0
    }

    override fun shouldShowRequestPermissionRationale(permission: String): Boolean {
        return false
    }
}