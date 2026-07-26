package com.lantapilates.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "LocalVideos")
public class LocalVideosPlugin extends Plugin {

    private static final String PREFS_NAME = "local_videos_prefs";
    private static final String KEY_TREE_URI = "tree_uri";
    private static final String KEY_FOLDER_PATH = "folder_path";

    private static final Set<String> VIDEO_EXTENSIONS = new HashSet<>(
        Arrays.asList("mp4", "m4v", "webm", "mkv", "mov", "avi", "3gp", "ts", "mts", "m2ts")
    );

    @PluginMethod
    public void hasFolder(PluginCall call) {
        JSObject ret = new JSObject();

        String folderPath = getStoredFolderPath();
        if (folderPath != null) {
            File folder = new File(folderPath);
            if (folder.isDirectory() && folder.canRead()) {
                ret.put("hasFolder", true);
                ret.put("folderName", folder.getName());
                call.resolve(ret);
                return;
            }
        }

        Uri treeUri = getStoredTreeUri();
        if (treeUri == null) {
            ret.put("hasFolder", false);
            call.resolve(ret);
            return;
        }

        ret.put("hasFolder", true);
        ret.put("folderName", getFolderDisplayName(treeUri));
        call.resolve(ret);
    }

    @PluginMethod
    public void pickFolder(PluginCall call) {
        // TV boxes usually have no DocumentsUI — use our in-app browser instead.
        Intent intent = new Intent(getContext(), FolderBrowserActivity.class);
        startActivityForResult(call, intent, "pickFolderResult");
    }

    @ActivityCallback
    private void pickFolderResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Folder selection cancelled.");
            return;
        }

        String folderPath = result.getData().getStringExtra(FolderBrowserActivity.EXTRA_FOLDER_PATH);
        if (folderPath == null || folderPath.isEmpty()) {
            // Legacy SAF fallback if somehow returned.
            Uri treeUri = result.getData().getData();
            if (treeUri != null) {
                handleSafFolder(call, result, treeUri);
                return;
            }
            call.reject("No folder selected.");
            return;
        }

        try {
            File folder = new File(folderPath);
            if (!folder.isDirectory() || !folder.canRead()) {
                call.reject("Cannot read the selected folder.");
                return;
            }

            clearStoredTreeUri();
            saveFolderPath(folderPath);

            List<JSObject> videos = listVideoObjectsFromFile(folder);
            JSObject ret = new JSObject();
            ret.put("folderName", folder.getName());
            ret.put("videoCount", videos.size());
            call.resolve(ret);
        } catch (Exception exception) {
            call.reject("Failed to access folder: " + exception.getMessage());
        }
    }

    private void handleSafFolder(PluginCall call, ActivityResult result, Uri treeUri) {
        try {
            ContentResolver resolver = getContext().getContentResolver();
            int takeFlags =
                result.getData().getFlags()
                    & (Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            resolver.takePersistableUriPermission(treeUri, takeFlags);

            clearStoredFolderPath();
            saveTreeUri(treeUri);

            List<JSObject> videos = listVideoObjectsFromTree(treeUri);
            JSObject ret = new JSObject();
            ret.put("folderName", getFolderDisplayName(treeUri));
            ret.put("videoCount", videos.size());
            call.resolve(ret);
        } catch (Exception exception) {
            call.reject("Failed to access folder: " + exception.getMessage());
        }
    }

    @PluginMethod
    public void listVideos(PluginCall call) {
        try {
            String folderPath = getStoredFolderPath();
            if (folderPath != null) {
                File folder = new File(folderPath);
                if (!folder.isDirectory() || !folder.canRead()) {
                    call.reject("Cannot read the selected folder.");
                    return;
                }
                List<JSObject> videos = listVideoObjectsFromFile(folder);
                JSObject ret = new JSObject();
                JSArray array = new JSArray();
                for (JSObject video : videos) {
                    array.put(video);
                }
                ret.put("videos", array);
                call.resolve(ret);
                return;
            }

            Uri treeUri = getStoredTreeUri();
            if (treeUri == null) {
                call.reject("No video folder selected.");
                return;
            }

            List<JSObject> videos = listVideoObjectsFromTree(treeUri);
            JSObject ret = new JSObject();
            JSArray array = new JSArray();
            for (JSObject video : videos) {
                array.put(video);
            }
            ret.put("videos", array);
            call.resolve(ret);
        } catch (Exception exception) {
            call.reject("Could not list videos: " + exception.getMessage());
        }
    }

    @PluginMethod
    public void clearFolder(PluginCall call) {
        clearStoredTreeUri();
        clearStoredFolderPath();
        call.resolve();
    }

    @PluginMethod
    public void resolvePlaybackUrl(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null || uriString.isEmpty()) {
            call.reject("Missing video uri.");
            return;
        }

        Uri uri = Uri.parse(uriString);
        String scheme = uri.getScheme();

        // Absolute filesystem paths (no scheme) from the TV folder browser.
        if (scheme == null) {
            File source = new File(uriString);
            if (!source.exists() || !source.canRead()) {
                call.reject("Video file is missing or unreadable.");
                return;
            }

            String requestedName = call.getString("name");
            String safeName = sanitizeFileName(
                requestedName != null && !requestedName.isEmpty()
                    ? requestedName
                    : source.getName()
            );

            // Copy into app cache so mpegts.js can fetch via Capacitor's https bridge.
            try {
                File cacheDir = new File(getContext().getCacheDir(), "lanta-videos");
                if (!cacheDir.exists() && !cacheDir.mkdirs()) {
                    call.reject("Could not create video cache directory.");
                    return;
                }

                File outFile = new File(cacheDir, safeName);
                if (!outFile.exists() || outFile.length() != source.length()) {
                    copyFile(source, outFile);
                }

                JSObject ret = new JSObject();
                ret.put("playbackUrl", outFile.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception exception) {
                call.reject("Could not prepare video for playback: " + exception.getMessage());
            }
            return;
        }

        if (scheme.equals("file")) {
            String path = uri.getPath();
            if (path == null || path.isEmpty()) {
                call.reject("Invalid file path.");
                return;
            }
            File source = new File(path);
            if (!source.exists() || !source.canRead()) {
                call.reject("Video file is missing or unreadable.");
                return;
            }
            String requestedName = call.getString("name");
            String safeName = sanitizeFileName(
                requestedName != null && !requestedName.isEmpty()
                    ? requestedName
                    : source.getName()
            );
            try {
                File cacheDir = new File(getContext().getCacheDir(), "lanta-videos");
                if (!cacheDir.exists() && !cacheDir.mkdirs()) {
                    call.reject("Could not create video cache directory.");
                    return;
                }
                File outFile = new File(cacheDir, safeName);
                if (!outFile.exists() || outFile.length() != source.length()) {
                    copyFile(source, outFile);
                }
                JSObject ret = new JSObject();
                ret.put("playbackUrl", outFile.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception exception) {
                call.reject("Could not prepare video for playback: " + exception.getMessage());
            }
            return;
        }

        if (!scheme.equals("content")) {
            JSObject ret = new JSObject();
            ret.put("playbackUrl", uriString);
            call.resolve(ret);
            return;
        }

        String requestedName = call.getString("name");
        String safeName = sanitizeFileName(
            requestedName != null && !requestedName.isEmpty() ? requestedName : "video.ts"
        );

        try {
            File cacheDir = new File(getContext().getCacheDir(), "lanta-videos");
            if (!cacheDir.exists() && !cacheDir.mkdirs()) {
                call.reject("Could not create video cache directory.");
                return;
            }

            File outFile = new File(cacheDir, safeName);
            if (!outFile.exists() || outFile.length() == 0) {
                try (
                    java.io.InputStream input = getContext().getContentResolver().openInputStream(uri);
                    java.io.FileOutputStream output = new java.io.FileOutputStream(outFile)
                ) {
                    if (input == null) {
                        call.reject("Could not open selected video file.");
                        return;
                    }

                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        output.write(buffer, 0, read);
                    }
                    output.flush();
                }
            }

            JSObject ret = new JSObject();
            ret.put("playbackUrl", outFile.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception exception) {
            call.reject("Could not prepare video for playback: " + exception.getMessage());
        }
    }

    private String sanitizeFileName(String name) {
        return name.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private void copyFile(File source, File destination) throws Exception {
        try (
            java.io.InputStream input = new java.io.FileInputStream(source);
            java.io.FileOutputStream output = new java.io.FileOutputStream(destination)
        ) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            output.flush();
        }
    }

    private List<JSObject> listVideoObjectsFromFile(File directory) {
        List<JSObject> videos = new ArrayList<>();
        collectVideosFromFile(directory, videos);
        sortVideos(videos);
        return videos;
    }

    private void collectVideosFromFile(File directory, List<JSObject> videos) {
        File[] files = directory.listFiles();
        if (files == null) {
            return;
        }

        for (File file : files) {
            // Prefer !isDirectory over isFile — some USB/TV mounts report odd file types.
            if (file.isDirectory()) {
                collectVideosFromFile(file, videos);
                continue;
            }

            String name = file.getName();
            if (name == null || name.startsWith(".")) {
                continue;
            }

            if (!isVideoFileName(name)) {
                continue;
            }

            String absolutePath = file.getAbsolutePath();
            JSObject video = new JSObject();
            video.put("id", encodeId(absolutePath));
            video.put("name", name);
            // Absolute path works better with Capacitor.convertFileSrc than file:// URIs.
            video.put("playbackUrl", absolutePath);
            videos.add(video);
        }
    }

    private List<JSObject> listVideoObjectsFromTree(Uri treeUri) {
        DocumentFile root = DocumentFile.fromTreeUri(getContext(), treeUri);
        if (root == null || !root.canRead()) {
            throw new IllegalStateException("Cannot read selected folder.");
        }

        List<JSObject> videos = new ArrayList<>();
        collectVideosFromTree(root, videos);
        sortVideos(videos);
        return videos;
    }

    private void sortVideos(List<JSObject> videos) {
        Collections.sort(
            videos,
            new Comparator<JSObject>() {
                @Override
                public int compare(JSObject left, JSObject right) {
                    String leftName = left.getString("name", "");
                    String rightName = right.getString("name", "");
                    return leftName.compareToIgnoreCase(rightName);
                }
            }
        );
    }

    private void collectVideosFromTree(DocumentFile directory, List<JSObject> videos) {
        DocumentFile[] files = directory.listFiles();
        if (files == null) {
            return;
        }

        for (DocumentFile file : files) {
            if (file.isDirectory()) {
                collectVideosFromTree(file, videos);
                continue;
            }

            if (!isVideoFile(file)) {
                continue;
            }

            Uri documentUri = file.getUri();
            JSObject video = new JSObject();
            video.put("id", encodeId(documentUri.toString()));
            video.put("name", file.getName() == null ? "Video" : file.getName());
            video.put("playbackUrl", documentUri.toString());
            videos.add(video);
        }
    }

    private boolean isVideoFile(DocumentFile file) {
        String mimeType = file.getType();
        if (mimeType != null && (mimeType.startsWith("video/") || mimeType.equals("video/mp2t"))) {
            return true;
        }
        return isVideoFileName(file.getName());
    }

    private boolean isVideoFileName(String name) {
        if (name == null) {
            return false;
        }

        String lower = name.toLowerCase(Locale.US).trim();
        // Strip trailing whitespace / accidental suffixes from some TV file managers.
        lower = lower.replaceAll("\\s+$", "");

        int dotIndex = lower.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == lower.length() - 1) {
            return false;
        }

        String extension = lower.substring(dotIndex + 1);
        // Some exports use ".ts.tmp" / ".TS" — also accept names ending with .ts before extra dots.
        if (VIDEO_EXTENSIONS.contains(extension)) {
            return true;
        }

        return lower.contains(".ts.")
            || lower.endsWith(".ts")
            || lower.endsWith(".mts")
            || lower.endsWith(".m2ts");
    }

    private String encodeId(String value) {
        return Base64.encodeToString(
            value.getBytes(StandardCharsets.UTF_8),
            Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING
        );
    }

    private Uri getStoredTreeUri() {
        SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
        String uriValue = prefs.getString(KEY_TREE_URI, null);
        if (uriValue == null || uriValue.isEmpty()) {
            return null;
        }
        return Uri.parse(uriValue);
    }

    private void saveTreeUri(Uri treeUri) {
        SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
        prefs.edit().putString(KEY_TREE_URI, treeUri.toString()).apply();
    }

    private void clearStoredTreeUri() {
        SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
        prefs.edit().remove(KEY_TREE_URI).apply();
    }

    private String getStoredFolderPath() {
        SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
        String path = prefs.getString(KEY_FOLDER_PATH, null);
        if (path == null || path.isEmpty()) {
            return null;
        }
        return path;
    }

    private void saveFolderPath(String path) {
        SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
        prefs.edit().putString(KEY_FOLDER_PATH, path).apply();
    }

    private void clearStoredFolderPath() {
        SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
        prefs.edit().remove(KEY_FOLDER_PATH).apply();
    }

    private String getFolderDisplayName(Uri treeUri) {
        String documentId = DocumentsContract.getTreeDocumentId(treeUri);
        if (documentId == null) {
            return "Selected folder";
        }

        String[] parts = documentId.split(":");
        if (parts.length >= 2) {
            return parts[parts.length - 1];
        }

        ContentResolver resolver = getContext().getContentResolver();
        Uri documentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId);

        try (Cursor cursor =
            resolver.query(
                documentUri,
                new String[] { DocumentsContract.Document.COLUMN_DISPLAY_NAME },
                null,
                null,
                null
            )) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
                if (nameIndex >= 0) {
                    String displayName = cursor.getString(nameIndex);
                    if (displayName != null && !displayName.isEmpty()) {
                        return displayName;
                    }
                }
            }
        } catch (Exception ignored) {
            return documentId;
        }

        return documentId;
    }
}
