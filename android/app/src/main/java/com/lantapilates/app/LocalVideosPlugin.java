package com.lantapilates.app;

import android.app.Activity;
import android.content.ContentResolver;
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

        ret.put("hasFolder", false);
        ret.put("folderName", DEFAULT_LIBRARY_FOLDER);
        call.resolve(ret);
    }

    @PluginMethod
    public void pickFolder(PluginCall call) {
        // Folder picking is disabled — always bind the fixed LantaPilates library.
        File library = ensureLibraryFolder();
        if (library == null) {
            call.reject(
                "Create a folder named LantaPilates on Internal storage or USB, "
                    + "copy your videos into it, then try again."
            );
            return;
        }

        List<JSObject> videos = listAllLibraryVideos();
        call.resolve(buildFolderResult(library.getName(), videos));
    }

    @ActivityCallback
    private void pickFolderResult(PluginCall call, ActivityResult result) {
        // Legacy callback — redirect to fixed library.
        if (call == null) {
            return;
        }
        pickFolder(call);
    }

    private void handleSafFolder(PluginCall call, ActivityResult ignoredResult, Uri ignoredTreeUri) {
        pickFolder(call);
    }

    @PluginMethod
    public void listVideos(PluginCall call) {
        try {
            File library = ensureLibraryFolder();
            if (library == null) {
                call.reject(
                    "LantaPilates folder not found. Create it on Internal storage or USB."
                );
                return;
            }

            // Merge across internal + USB copies of LantaPilates (and MediaStore).
            List<JSObject> videos = listAllLibraryVideos();
            JSObject ret = new JSObject();
            ret.put("videos", toJsArray(videos));
            call.resolve(ret);
        } catch (Exception exception) {
            call.reject("Could not list videos: " + exception.getMessage());
        }
    }

    /**
     * Collects videos from every LantaPilates folder found (internal + USB) plus MediaStore.
     */
    private List<JSObject> listAllLibraryVideos() {
        Map<String, JSObject> byPath = new LinkedHashMap<>();
        for (File candidate : findAllLantaPilatesCandidates()) {
            if (candidate == null || !candidate.isDirectory()) {
                continue;
            }
            for (JSObject video : listVideoObjectsFromFile(candidate)) {
                String path = video.getString("playbackUrl", "");
                if (path != null && !path.isEmpty()) {
                    byPath.put(path, video);
                }
            }
        }
        collectVideosFromMediaStoreGlobal(byPath);
        List<JSObject> videos = new ArrayList<>(byPath.values());
        sortVideos(videos);
        return videos;
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
     * Finds LantaPilates on internal storage and USB / removable volumes.
     * Prefers a folder that already contains videos (USB wins when both have videos).
     */
    private File findLantaPilatesFolder() {
        File bestWithVideos = null;
        File bestEmpty = null;

        for (File candidate : findAllLantaPilatesCandidates()) {
            if (candidate == null || !candidate.isDirectory()) {
                continue;
            }
            // Removable volumes sometimes report canRead()=false until listed — still try.
            List<JSObject> videos = listVideoObjectsFromFile(candidate);
            boolean removable = isLikelyRemovablePath(candidate.getAbsolutePath());
            if (!videos.isEmpty()) {
                if (removable) {
                    return candidate;
                }
                if (bestWithVideos == null) {
                    bestWithVideos = candidate;
                }
            } else if (bestEmpty == null) {
                bestEmpty = candidate;
            }
        }

        if (bestWithVideos != null) {
            return bestWithVideos;
        }

        // MediaStore may see videos under LantaPilates even when File.listFiles() is empty.
        Map<String, JSObject> mediaOnly = new LinkedHashMap<>();
        collectVideosFromMediaStoreGlobal(mediaOnly);
        if (!mediaOnly.isEmpty()) {
            for (JSObject video : mediaOnly.values()) {
                String path = video.getString("playbackUrl", "");
                if (path == null || path.isEmpty()) {
                    continue;
                }
                File parent = new File(path).getParentFile();
                while (parent != null) {
                    if (DEFAULT_LIBRARY_FOLDER.equalsIgnoreCase(parent.getName())) {
                        return parent;
                    }
                    parent = parent.getParentFile();
                }
            }
        }

        return bestEmpty;
    }

    private List<File> findAllLantaPilatesCandidates() {
        List<File> found = new ArrayList<>();
        for (File root : getSearchRoots()) {
            if (root == null || !root.isDirectory()) {
                continue;
            }

            if (DEFAULT_LIBRARY_FOLDER.equalsIgnoreCase(root.getName())) {
                found.add(root);
                continue;
            }

            File direct = new File(root, DEFAULT_LIBRARY_FOLDER);
            if (direct.isDirectory()) {
                found.add(direct);
            }

            File[] children = root.listFiles();
            if (children == null) {
                continue;
            }
            for (File child : children) {
                if (child != null
                    && child.isDirectory()
                    && DEFAULT_LIBRARY_FOLDER.equalsIgnoreCase(child.getName())) {
                    found.add(child);
                }
            }
        }
        return found;
    }

    private boolean isLikelyRemovablePath(String path) {
        if (path == null) {
            return false;
        }
        String lower = path.toLowerCase(Locale.US);
        return lower.startsWith("/storage/")
            && !lower.startsWith("/storage/emulated")
            && !lower.startsWith("/storage/self");
    }

    private List<File> getSearchRoots() {
        LinkedHashMap<String, File> roots = new LinkedHashMap<>();

        File primary = Environment.getExternalStorageDirectory();
        if (primary != null) {
            addRoot(roots, primary);
            addRoot(roots, new File(primary, "Movies"));
            addRoot(roots, new File(primary, "Download"));
            addRoot(roots, new File(primary, "Documents"));
            addRoot(roots, new File(primary, "DCIM"));
        }

        // USB / SD card volumes (do NOT require canRead — many TV boxes lie until opened).
        addVolumeChildren(roots, new File("/storage"));
        addVolumeChildren(roots, new File("/mnt/media_rw"));
        addVolumeChildren(roots, new File("/mnt/usb"));
        addVolumeChildren(roots, new File("/mnt/usb_storage"));

        // App-visible external dirs often reveal the removable volume root.
        File[] externals = getContext().getExternalFilesDirs(null);
        if (externals != null) {
            for (File external : externals) {
                if (external == null) {
                    continue;
                }
                File walk = external;
                for (int i = 0; i < 6 && walk != null; i += 1) {
                    addRoot(roots, walk);
                    if (DEFAULT_LIBRARY_FOLDER.equalsIgnoreCase(walk.getName())) {
                        break;
                    }
                    walk = walk.getParentFile();
                }
            }
        }

        return new ArrayList<>(roots.values());
    }

    private void addVolumeChildren(Map<String, File> roots, File parent) {
        if (parent == null || !parent.isDirectory()) {
            return;
        }
        File[] volumes = parent.listFiles();
        if (volumes == null) {
            return;
        }
        for (File volume : volumes) {
            if (volume == null || !volume.isDirectory()) {
                continue;
            }
            String name = volume.getName();
            if ("emulated".equalsIgnoreCase(name) || "self".equalsIgnoreCase(name)) {
                continue;
            }
            addRoot(roots, volume);
            addRoot(roots, new File(volume, "Movies"));
            addRoot(roots, new File(volume, "Download"));
            addRoot(roots, new File(volume, DEFAULT_LIBRARY_FOLDER));
        }
    }

    private void addRoot(Map<String, File> roots, File folder) {
        if (folder == null) {
            return;
        }
        roots.put(folder.getAbsolutePath(), folder);
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

        // Absolute filesystem paths: serve in place when readable (avoids slow full-file copy).
        if (scheme == null) {
            File source = new File(uriString);
            if (!source.exists() || !source.canRead()) {
                call.reject("Video file is missing or unreadable.");
                return;
            }

            JSObject ret = new JSObject();
            ret.put("playbackUrl", source.getAbsolutePath());
            call.resolve(ret);
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
            JSObject ret = new JSObject();
            ret.put("playbackUrl", source.getAbsolutePath());
            call.resolve(ret);
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
        queryMediaStoreVideos(
            byPath,
            MediaStore.Files.FileColumns.DATA + " LIKE ?",
            new String[] { folderPath + "/%" },
            true
        );
    }

    /**
     * Scans MediaStore for anything under a LantaPilates path (any volume).
     * Helps when File.listFiles() is blocked but the indexer still knows the files.
     */
    private void collectVideosFromMediaStoreGlobal(Map<String, JSObject> byPath) {
        queryMediaStoreVideos(
            byPath,
            "("
                + MediaStore.Files.FileColumns.DATA + " LIKE ? OR "
                + MediaStore.Files.FileColumns.DATA + " LIKE ?"
                + ")",
            new String[] { "%/LantaPilates/%", "%/lantapilates/%" },
            true
        );
    }

    private void queryMediaStoreVideos(
        Map<String, JSObject> byPath,
        String selection,
        String[] args,
        boolean acceptLargeUnknownInLibrary
    ) {
        ContentResolver resolver = getContext().getContentResolver();
        Uri uri = MediaStore.Files.getContentUri("external");
        String[] projection = {
            MediaStore.Files.FileColumns.DATA,
            MediaStore.Files.FileColumns.DISPLAY_NAME,
            MediaStore.Files.FileColumns.MIME_TYPE,
            MediaStore.Files.FileColumns.SIZE,
        };

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
                boolean underLibrary = path.toLowerCase(Locale.US).contains("/lantapilates/");
                boolean mimeLooksVideo =
                    mime != null && (mime.startsWith("video/") || "video/mp2t".equals(mime));
                if (!isVideoFileName(name) && !mimeLooksVideo) {
                    if (!(acceptLargeUnknownInLibrary
                        && underLibrary
                        && size >= MIN_FALLBACK_FILE_BYTES)) {
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

        // Normalize weird dots / trailing junk TV file managers sometimes add.
        String lower = name.toLowerCase(Locale.US)
            .replace('\uFF0E', '.')
            .replace('\u3002', '.')
            .replace('\u2024', '.')
            .trim()
            .replaceAll("[\\s\\u00A0]+$", "");

        String extension = extensionOf(lower);
        // Strip trailing punctuation from extension: "ts)", "ts_", "ts-"
        extension = extension.replaceAll("[^a-z0-9].*$", "");
        if (VIDEO_EXTENSIONS.contains(extension)) {
            return true;
        }

        return lower.endsWith(".ts")
            || lower.endsWith(".mts")
            || lower.endsWith(".m2ts")
            || lower.endsWith(".m2t")
            || lower.contains(".ts.")
            || lower.matches(".*\\.ts[^a-z0-9]?$")
            || lower.matches(".*\\.ts\\d*$")
            || lower.endsWith(".mpegts")
            || lower.endsWith(".mpg")
            || lower.endsWith(".mpeg")
            || lower.endsWith(".mp4")
            || lower.endsWith(".mkv")
            || lower.endsWith(".webm");
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
