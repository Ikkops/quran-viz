package io.github.ikkops.quranviz;

import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * Where recitation audio can be kept: the app's internal storage and, when one
 * is inserted, the app's own folder on an SD card
 * (Android/data/io.github.ikkops.quranviz/files). Both are private to the app
 * and need no storage permission; Android deletes them when the app is
 * uninstalled. The web side reads and writes there through the Filesystem and
 * FileTransfer plugins with the returned file:// URIs (src/data/audioStore.ts).
 */
@CapacitorPlugin(name = "AudioStorage")
public class AudioStoragePlugin extends Plugin {

    @PluginMethod
    public void volumes(PluginCall call) {
        Context context = getContext();
        JSArray list = new JSArray();
        list.put(volume("internal", context.getFilesDir(), false));
        File[] external = context.getExternalFilesDirs(null);
        for (File dir : external) {
            if (dir == null) continue; // a card that is listed but not mounted
            boolean removable;
            try {
                removable = Environment.isExternalStorageRemovable(dir);
            } catch (IllegalArgumentException e) {
                continue;
            }
            // The primary "external" storage is the built-in flash, which
            // internal already covers; only removable cards are offered.
            if (!removable) continue;
            if (!Environment.MEDIA_MOUNTED.equals(Environment.getExternalStorageState(dir))) continue;
            list.put(volume(dir.getAbsolutePath(), dir, true));
        }
        JSObject result = new JSObject();
        result.put("volumes", list);
        call.resolve(result);
    }

    private static JSObject volume(String id, File dir, boolean removable) {
        JSObject o = new JSObject();
        o.put("id", id);
        o.put("uri", Uri.fromFile(dir).toString());
        o.put("removable", removable);
        o.put("free", dir.getUsableSpace());
        o.put("total", dir.getTotalSpace());
        return o;
    }
}
