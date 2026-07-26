package com.lantapilates.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(name = "LocalVideos")
public class LocalVideosPlugin extends Plugin {

    private static final String PREFS_NAME = "local_videos_prefs";
    private static final String KEY_TREE_URI = "tree_uri";
    private static final String KEY_FOLDER_PATH = "folder_path";
    /** Hardcoded offline library folder — drop videos here on the TV/tablet. */
    public static final String DEFAULT_LIBRARY_FOLDER = "LantaPilates";
    private static final long MIN_FALLBACK_FILE_BYTES = 50 * 1024L;

    private static final Set<String> VIDEO_EXTENSIONS = new HashSet<>(
        Arrays.asList(
            "mp4", "m4v", "webm", "mkv", "mov", "avi", "3gp",
            "ts", "mts", "m2ts", "m2t", "mpg", "mpeg", "mpegts"
        )
    );

    @PluginMethod
    public void hasFolder(PluginCall call) {
        JSObject ret = new JSObject();

        File library = ensureLibraryFolder();
        if (library != null) {
            ret.put("hasFolder", true);
            ret.put("folderName", library.getName());
            call.resolve(ret);
            return;
        }

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
        // Prefer the hardcoded LantaPilates folder when it already has videos.
        File library = findLantaPilatesFolder();
        if (library != null) {
            List<JSObject> videos = listVideoObjectsFromFile(library);
            if (!videos.isEmpty()) {
                clearStoredTreeUri();
                saveFolderPath(library.getAbsolutePath());
                call.resolve(buildFolderResult(library.getName(), videos));
                return;
            }
        }

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
            call.resolve(buildFolderResult(folder.getName(), videos));
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
            call.resolve(buildFolderResult(getFolderDisplayName(treeUri), videos));
        } catch (Exception exception) {
            call.reject("Failed to access folder: " + exception.getMessage());
        }
    }

    @PluginMethod
    public void listVideos(PluginCall call) {
        try {
            File library = ensureLibraryFolder();
            File folder = library;

            if (folder == null) {
                String folderPath = getStoredFolderPath();
                if (folderPath != null) {
                    folder = new File(folderPath);
                }
            }

            if (folder != null && folder.isDirectory() && folder.canRead()) {
                List<JSObject> videos = listVideoObjectsFromFile(folder);
                JSObject ret = new JSObject();
                ret.put("videos", toJsArray(videos));
                call.resolve(ret);
                return;
            }

            Uri treeUri = getStoredTreeUri();
            if (treeUri == null) {
                call.reject("No video folder selected. Create a LantaPilates folder with your videos.");
                return;
            }

            List<JSObject> videos = listVideoObjectsFromTree(treeUri);
            JSObject ret = new JSObject();
            ret.put("videos", toJsArray(videos));
            call.resolve(ret);
        } catch (Exception exception) {
            call.reject("Could not list videos: " + exception.getMessage());
        }
    }

    private JSObject buildFolderResult(String folderName, List<JSObject> videos) {
        JSObject ret = new JSObject();
        ret.put("folderName", folderName);
        ret.put("videoCount", videos.size());
        ret.put("videos", toJsArray(videos));
        return ret;
    }

    private JSArray toJsArray(List<JSObject> videos) {
        JSArray array = new JSArray();
        for (JSObject video : videos) {
            array.put(video);
        }
        return array;
    }

    /**
     * Auto-binds the hardcoded LantaPilates folder when present and readable.
     */
    private File ensureLibraryFolder() {
        File library = findLantaPilatesFolder();
        if (library == null) {
            return null;
        }
        clearStoredTreeUri();
        saveFolderPath(library.getAbsolutePath());
        return library;
    }

    /**
     * Finds /LantaPilates on internal storage, Movies, Download, Documents, and USB volumes.
     */
    private File findLantaPilatesFolder() {
        for (File root : getSearchRoots()) {
            if (root == null || !root.isDirectory() || !root.canRead()) {
                continue;
            }

            if (DEFAULT_LIBRARY_FOLDER.equalsIgnoreCase(root.getName())) {
                return root;
            }

            File direct = new File(root, DEFAULT_LIBRARY_FOLDER);
            if (direct.isDirectory() && direct.canRead()) {
                return direct;
            }

            File[] children = root.listFiles();
            if (children == null) {
                continue;
            }
            for (File child : children) {
                if (child != null
                    && child.isDirectory()
                    && child.canRead()
                    && DEFAULT_LIBRARY_FOLDER.equalsIgnoreCase(child.getName())) {
                    return child;
                }
            }
        }
        return null;
    }

    private List<File> getSearchRoots() {
        List<File> roots = new ArrayList<>();
        File primary = Environment.getExternalStorageDirectory();
        if (primary != null) {
            roots.add(primary);
            roots.add(new File(primary, "Movies"));
            roots.add(new File(primary, "Download"));
            roots.add(new File(primary, "Documents"));
            roots.add(new File(primary, "DCIM"));
        }

        File storageRoot = new File("/storage");
        File[] volumes = storageRoot.listFiles();
        if (volumes != null) {
            for (File volume : volumes) {
                if (volume == null || !volume.isDirectory()) {
                    continue;
                }
                String name = volume.getName();
                if ("emulated".equalsIgnoreCase(name) || "self".equalsIgnoreCase(name)) {
                    continue;
                }
                roots.add(volume);
                roots.add(new File(volume, "Movies"));
            }
        }
        return roots;
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
        Map<String, JSObject> byPath = new LinkedHashMap<>();
        collectVideosFromFile(directory, byPath, 0, isLantaLibraryFolder(directory));
        collectVideosFromMediaStore(directory, byPath);

        // Last resort for the hardcoded library: treat large files as videos even without
        // a known extension (some TV file managers strip or mangle .ts).
        if (byPath.isEmpty() && isLantaLibraryFolder(directory)) {
            collectAllLargeFiles(directory, byPath, 0);
        }

        List<JSObject> videos = new ArrayList<>(byPath.values());
        sortVideos(videos);
        return videos;
    }

    private boolean isLantaLibraryFolder(File directory) {
        if (directory == null) {
            return false;
        }
        return DEFAULT_LIBRARY_FOLDER.equalsIgnoreCase(directory.getName());
    }

    /**
     * Recursively collects video files with listFiles()/list() fallbacks for flaky TV mounts.
     *
     * @param directory - Folder to scan
     * @param byPath - Deduped output keyed by absolute path
     * @param depth - Recursion depth
     * @param acceptAllInLibrary - When true, also accept large extension-less files
     */
    private void collectVideosFromFile(
        File directory,
        Map<String, JSObject> byPath,
        int depth,
        boolean acceptAllInLibrary
    ) {
        if (directory == null || depth > 16) {
            return;
        }

        File[] files = directory.listFiles();
        if (files == null) {
            String[] names = directory.list();
            if (names == null) {
                return;
            }
            for (String name : names) {
                if (name == null || name.startsWith(".")) {
                    continue;
                }
                File child = new File(directory, name);
                if (child.isDirectory()) {
                    collectVideosFromFile(child, byPath, depth + 1, acceptAllInLibrary);
                    continue;
                }
                addVideoIfSupported(child, name, byPath, acceptAllInLibrary);
            }
            return;
        }

        for (File file : files) {
            if (file == null) {
                continue;
            }
            if (file.isDirectory()) {
                collectVideosFromFile(file, byPath, depth + 1, acceptAllInLibrary);
                continue;
            }

            String name = file.getName();
            if (name == null || name.startsWith(".")) {
                continue;
            }

            addVideoIfSupported(file, name, byPath, acceptAllInLibrary);
        }
    }

    private void collectAllLargeFiles(File directory, Map<String, JSObject> byPath, int depth) {
        if (directory == null || depth > 8) {
            return;
        }
        File[] files = directory.listFiles();
        if (files == null) {
            return;
        }
        for (File file : files) {
            if (file == null) {
                continue;
            }
            if (file.isDirectory()) {
                collectAllLargeFiles(file, byPath, depth + 1);
                continue;
            }
            String name = file.getName();
            if (name == null || name.startsWith(".")) {
                continue;
            }
            if (file.length() < MIN_FALLBACK_FILE_BYTES) {
                continue;
            }
            addVideoEntry(file.getAbsolutePath(), name, byPath);
        }
    }

    /**
     * MediaStore fallback — some TV firmwares hide .ts from File.listFiles() but still index them.
     */
    private void collectVideosFromMediaStore(File directory, Map<String, JSObject> byPath) {
        if (directory == null) {
            return;
        }

        String folderPath = directory.getAbsolutePath();
        ContentResolver resolver = getContext().getContentResolver();
        Uri uri = MediaStore.Files.getContentUri("external");
        String[] projection = {
            MediaStore.Files.FileColumns.DATA,
            MediaStore.Files.FileColumns.DISPLAY_NAME,
            MediaStore.Files.FileColumns.MIME_TYPE,
            MediaStore.Files.FileColumns.SIZE,
        };
        String selection = MediaStore.Files.FileColumns.DATA + " LIKE ?";
        String[] args = { folderPath + "/%" };

        try (Cursor cursor = resolver.query(uri, projection, selection, args, null)) {
            if (cursor == null) {
                return;
            }
            int dataIndex = cursor.getColumnIndex(MediaStore.Files.FileColumns.DATA);
            int nameIndex = cursor.getColumnIndex(MediaStore.Files.FileColumns.DISPLAY_NAME);
            int mimeIndex = cursor.getColumnIndex(MediaStore.Files.FileColumns.MIME_TYPE);
            int sizeIndex = cursor.getColumnIndex(MediaStore.Files.FileColumns.SIZE);
            while (cursor.moveToNext()) {
                String path = dataIndex >= 0 ? cursor.getString(dataIndex) : null;
                if (path == null || path.isEmpty()) {
                    continue;
                }
                String name = nameIndex >= 0 ? cursor.getString(nameIndex) : null;
                if (name == null || name.isEmpty()) {
                    name = new File(path).getName();
                }
                String mime = mimeIndex >= 0 ? cursor.getString(mimeIndex) : null;
                long size = sizeIndex >= 0 ? cursor.getLong(sizeIndex) : 0L;
                boolean mimeLooksVideo =
                    mime != null && (mime.startsWith("video/") || "video/mp2t".equals(mime));
                if (!isVideoFileName(name) && !mimeLooksVideo) {
                    if (!(isLantaLibraryFolder(directory) && size >= MIN_FALLBACK_FILE_BYTES)) {
                        continue;
                    }
                }
                addVideoEntry(path, name, byPath);
            }
        } catch (Exception ignored) {
            // MediaStore may be unavailable on some TV builds — File scan still applies.
        }
    }

    private void addVideoIfSupported(
        File file,
        String name,
        Map<String, JSObject> byPath,
        boolean acceptAllInLibrary
    ) {
        if (isVideoFileName(name)) {
            addVideoEntry(file.getAbsolutePath(), name, byPath);
            return;
        }
        if (acceptAllInLibrary && file.length() >= MIN_FALLBACK_FILE_BYTES) {
            addVideoEntry(file.getAbsolutePath(), name, byPath);
        }
    }

    private void addVideoEntry(String absolutePath, String name, Map<String, JSObject> byPath) {
        if (byPath.containsKey(absolutePath)) {
            return;
        }
        JSObject video = new JSObject();
        video.put("id", encodeId(absolutePath));
        video.put("name", name);
        video.put("playbackUrl", absolutePath);
        byPath.put(absolutePath, video);
    }

    private List<JSObject> listVideoObjectsFromTree(Uri treeUri) {
        DocumentFile root = DocumentFile.fromTreeUri(getContext(), treeUri);
        if (root == null || !root.canRead()) {
            throw new IllegalStateException("Cannot read selected folder.");
        }

        List<JSObject> videos = new ArrayList<>();
        collectVideosFromTree(root, videos, 0);
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

    private void collectVideosFromTree(DocumentFile directory, List<JSObject> videos, int depth) {
        if (directory == null || depth > 16) {
            return;
        }

        DocumentFile[] files = directory.listFiles();
        if (files == null) {
            return;
        }

        for (DocumentFile file : files) {
            if (file.isDirectory()) {
                collectVideosFromTree(file, videos, depth + 1);
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

        String lower = name.toLowerCase(Locale.US)
            .replace('\uFF0E', '.')
            .replace('\u3002', '.')
            .trim()
            .replaceAll("\\s+$", "");

        String extension = extensionOf(lower);
        if (VIDEO_EXTENSIONS.contains(extension)) {
            return true;
        }

        return lower.endsWith(".ts")
            || lower.endsWith(".mts")
            || lower.endsWith(".m2ts")
            || lower.endsWith(".m2t")
            || lower.contains(".ts.")
            || lower.matches(".*\\.ts\\d*$")
            || lower.endsWith(".mpegts")
            || lower.endsWith(".mpg")
            || lower.endsWith(".mpeg");
    }

    private String extensionOf(String lowerName) {
        int dotIndex = lowerName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == lowerName.length() - 1) {
            return "";
        }
        return lowerName.substring(dotIndex + 1);
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
        prefs.edit().putString(KEY_TREE_URI, treeUri.toString()).commit();
    }

    private void clearStoredTreeUri() {
        SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
        prefs.edit().remove(KEY_TREE_URI).commit();
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
        prefs.edit().putString(KEY_FOLDER_PATH, path).commit();
    }

    private void clearStoredFolderPath() {
        SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);
        prefs.edit().remove(KEY_FOLDER_PATH).commit();
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
