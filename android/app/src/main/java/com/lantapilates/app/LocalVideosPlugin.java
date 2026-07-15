package com.lantapilates.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import android.webkit.MimeTypeMap;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

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

    private static final Set<String> VIDEO_EXTENSIONS = new HashSet<>(
        Arrays.asList("mp4", "m4v", "webm", "mkv", "mov", "avi", "3gp", "ts", "mts", "m2ts")
    );

    @PluginMethod
    public void hasFolder(PluginCall call) {
        Uri treeUri = getStoredTreeUri();
        JSObject ret = new JSObject();

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
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
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

        Uri treeUri = result.getData().getData();
        if (treeUri == null) {
            call.reject("No folder selected.");
            return;
        }

        try {
            ContentResolver resolver = getContext().getContentResolver();
            int takeFlags =
                result.getData().getFlags()
                    & (Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            resolver.takePersistableUriPermission(treeUri, takeFlags);

            saveTreeUri(treeUri);

            List<JSObject> videos = listVideoObjects(treeUri);
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
        Uri treeUri = getStoredTreeUri();
        if (treeUri == null) {
            call.reject("No video folder selected.");
            return;
        }

        try {
            List<JSObject> videos = listVideoObjects(treeUri);
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
        if (scheme == null || (!scheme.equals("content") && !scheme.equals("file"))) {
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

    private List<JSObject> listVideoObjects(Uri treeUri) {
        DocumentFile root = DocumentFile.fromTreeUri(getContext(), treeUri);
        if (root == null || !root.canRead()) {
            throw new IllegalStateException("Cannot read selected folder.");
        }

        List<JSObject> videos = new ArrayList<>();
        collectVideos(root, videos);

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

        return videos;
    }

    private void collectVideos(DocumentFile directory, List<JSObject> videos) {
        DocumentFile[] files = directory.listFiles();
        if (files == null) {
            return;
        }

        for (DocumentFile file : files) {
            if (file.isDirectory()) {
                collectVideos(file, videos);
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

        String name = file.getName();
        if (name == null) {
            return false;
        }

        int dotIndex = name.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == name.length() - 1) {
            return false;
        }

        String extension = name.substring(dotIndex + 1).toLowerCase(Locale.US);
        return VIDEO_EXTENSIONS.contains(extension);
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
