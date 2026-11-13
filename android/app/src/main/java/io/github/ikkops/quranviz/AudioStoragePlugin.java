package io.github.ikkops.quranviz;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.annotation.ActivityCallback;
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
 *
 * The learner may instead choose any folder (pickFolder). Writing there by
 * path needs Android's "All files access" (MANAGE_EXTERNAL_STORAGE), which the
 * learner grants on a system screen (requestAccess); audio in such a folder
 * survives an uninstall.
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

    /** Whether the app may write anywhere on shared storage. */
    @PluginMethod
    public void access(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasAllFilesAccess());
        call.resolve(result);
    }

    /** Open the system screen where the learner grants "All files access". */
    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            call.reject("unsupported");
            return;
        }
        Context context = getContext();
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                Uri.parse("package:" + context.getPackageName())
            );
            getActivity().startActivity(intent);
        } catch (Exception e) {
            // Some devices only have the list of all apps.
            getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION));
        }
        call.resolve();
    }

    /** Let the learner choose a folder; resolves with its path. */
    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("cancelled");
            return;
        }
        String path = pathOfTree(data.getData());
        if (path == null) {
            call.reject("unsupported");
            return;
        }
        JSObject out = new JSObject();
        out.put("path", path);
        call.resolve(out);
    }

    /** A chosen folder as a volume (created if missing); `writable` says whether audio can go there. */
    @PluginMethod
    public void folder(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("path");
            return;
        }
        File dir = new File(path);
        boolean removable = false;
        boolean writable = false;
        try {
            if (!dir.exists()) dir.mkdirs();
            writable = dir.isDirectory() && dir.canWrite();
            removable = Environment.isExternalStorageRemovable(dir);
        } catch (Exception e) {
            // Not on a mounted volume (the card is out), or no access.
        }
        JSObject o = volume(path, dir, removable);
        o.put("writable", writable);
        o.put("custom", true);
        call.resolve(o);
    }

    private static boolean hasAllFilesAccess() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && Environment.isExternalStorageManager();
    }

    /** The file path behind a tree URI from the system's storage picker, or null for other providers. */
    private static String pathOfTree(Uri tree) {
        if (!"com.android.externalstorage.documents".equals(tree.getAuthority())) return null;
        String id = DocumentsContract.getTreeDocumentId(tree); // "primary:Music/Quran", "1A2B-3C4D:Quran"
        int colon = id.indexOf(':');
        if (colon < 0) return null;
        String volume = id.substring(0, colon);
        String rel = id.substring(colon + 1);
        String root = "primary".equalsIgnoreCase(volume)
            ? Environment.getExternalStorageDirectory().getAbsolutePath()
            : "/storage/" + volume;
        return rel.isEmpty() ? root : root + "/" + rel;
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
