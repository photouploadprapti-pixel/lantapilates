package com.lantapilates.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * D-pad friendly folder browser for Android TV boxes that lack DocumentsUI.
 * Uses ListView selection (not per-row focus) so remotes can move reliably.
 */
public class FolderBrowserActivity extends AppCompatActivity {
    public static final String EXTRA_FOLDER_PATH = "folder_path";

    private static final int REQUEST_STORAGE = 4401;

    private TextView pathLabel;
    private TextView emptyLabel;
    private ListView listView;
    private Button useFolderButton;
    private Button upButton;

    private File currentDir;
    private final List<File> entries = new ArrayList<>();
    private ArrayAdapter<String> adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_folder_browser);

        pathLabel = findViewById(R.id.folder_path_label);
        emptyLabel = findViewById(R.id.folder_empty_label);
        listView = findViewById(R.id.folder_list);
        useFolderButton = findViewById(R.id.btn_use_folder);
        upButton = findViewById(R.id.btn_up);

        // Standard Android TV pattern: list keeps focus, selection moves with D-pad.
        adapter = new ArrayAdapter<>(this, R.layout.item_folder_row, R.id.folder_row_text);
        listView.setAdapter(adapter);
        listView.setItemsCanFocus(false);
        listView.setChoiceMode(ListView.CHOICE_MODE_SINGLE);
        listView.setFocusable(true);
        listView.setFocusableInTouchMode(true);
        listView.setDescendantFocusability(ListView.FOCUS_BLOCK_DESCENDANTS);

        listView.setOnItemClickListener((parent, view, position, id) -> openEntry(position));
        useFolderButton.setOnClickListener(v -> selectCurrentFolder());
        upButton.setOnClickListener(v -> navigateUp());

        // From buttons, Up always returns to the list.
        upButton.setOnKeyListener((v, keyCode, event) -> {
            if (event.getAction() != KeyEvent.ACTION_DOWN) {
                return false;
            }
            if (keyCode == KeyEvent.KEYCODE_DPAD_UP) {
                focusList();
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) {
                useFolderButton.requestFocus();
                return true;
            }
            return false;
        });
        useFolderButton.setOnKeyListener((v, keyCode, event) -> {
            if (event.getAction() != KeyEvent.ACTION_DOWN) {
                return false;
            }
            if (keyCode == KeyEvent.KEYCODE_DPAD_UP) {
                focusList();
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT) {
                if (upButton.isEnabled()) {
                    upButton.requestFocus();
                }
                return true;
            }
            return false;
        });

        listView.setOnKeyListener((v, keyCode, event) -> handleListKey(keyCode, event));

        if (hasStoragePermission()) {
            openRoots();
        } else {
            requestStoragePermission();
        }
    }

    /**
     * Handles D-pad inside the list: move selection, open folder, jump to buttons.
     */
    private boolean handleListKey(int keyCode, KeyEvent event) {
        if (event.getAction() != KeyEvent.ACTION_DOWN) {
            return false;
        }

        int count = adapter.getCount();
        int selected = listView.getSelectedItemPosition();
        if (selected < 0 && count > 0) {
            selected = 0;
            listView.setSelection(0);
        }

        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_DOWN:
                if (count == 0) {
                    focusBottomButtons();
                    return true;
                }
                if (selected >= count - 1) {
                    focusBottomButtons();
                    return true;
                }
                listView.setSelection(selected + 1);
                return true;
            case KeyEvent.KEYCODE_DPAD_UP:
                if (count == 0) {
                    return true;
                }
                if (selected <= 0) {
                    listView.setSelection(0);
                    return true;
                }
                listView.setSelection(selected - 1);
                return true;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
                if (selected >= 0 && selected < count) {
                    openEntry(selected);
                } else if (currentDir != null) {
                    selectCurrentFolder();
                }
                return true;
            default:
                return false;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        // Catch D-pad even when focus is weird on some TV firmwares.
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            View focused = getCurrentFocus();
            int keyCode = event.getKeyCode();

            if (focused == listView || focused == null) {
                if (handleListKey(keyCode, event)) {
                    if (focused == null) {
                        focusList();
                    }
                    return true;
                }
            }

            if (
                (focused == upButton || focused == useFolderButton)
                    && keyCode == KeyEvent.KEYCODE_DPAD_UP
            ) {
                focusList();
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private void focusList() {
        listView.requestFocus();
        if (adapter.getCount() > 0) {
            int selected = listView.getSelectedItemPosition();
            if (selected < 0) {
                selected = 0;
            }
            listView.setSelection(selected);
        }
    }

    private void focusBottomButtons() {
        if (useFolderButton.isEnabled()) {
            useFolderButton.requestFocus();
        } else if (upButton.isEnabled()) {
            upButton.requestFocus();
        }
    }

    private boolean hasStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return Environment.isExternalStorageManager() || canReadPrimaryStorage();
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(this, android.Manifest.permission.READ_MEDIA_VIDEO)
                == PackageManager.PERMISSION_GRANTED
                || canReadPrimaryStorage();
        }
        return ContextCompat.checkSelfPermission(this, android.Manifest.permission.READ_EXTERNAL_STORAGE)
            == PackageManager.PERMISSION_GRANTED;
    }

    private boolean canReadPrimaryStorage() {
        File root = Environment.getExternalStorageDirectory();
        return root != null && root.exists() && root.canRead();
    }

    private void requestStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) {
            try {
                Intent intent = new Intent(
                    android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION
                );
                intent.setData(android.net.Uri.parse("package:" + getPackageName()));
                startActivity(intent);
                Toast.makeText(
                    this,
                    "Allow all files access, then press Back and open folder picker again.",
                    Toast.LENGTH_LONG
                ).show();
            } catch (Exception exception) {
                Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                startActivity(intent);
            }
            openRoots();
            return;
        }

        List<String> permissions = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(android.Manifest.permission.READ_MEDIA_VIDEO);
        } else {
            permissions.add(android.Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        ActivityCompat.requestPermissions(
            this,
            permissions.toArray(new String[0]),
            REQUEST_STORAGE
        );
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        String[] permissions,
        int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_STORAGE) {
            return;
        }
        openRoots();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (currentDir == null) {
            openRoots();
        } else {
            loadDirectory(currentDir);
        }
    }

    private void openRoots() {
        entries.clear();
        List<String> labels = new ArrayList<>();

        File primary = Environment.getExternalStorageDirectory();
        if (primary != null && primary.exists()) {
            entries.add(primary);
            labels.add("Internal storage");

            File movies = new File(primary, "Movies");
            if (movies.isDirectory() && movies.canRead()) {
                entries.add(movies);
                labels.add("Movies");
            }

            File download = new File(primary, "Download");
            if (download.isDirectory() && download.canRead()) {
                entries.add(download);
                labels.add("Download");
            }
        }

        File storageRoot = new File("/storage");
        File[] volumes = storageRoot.listFiles();
        if (volumes != null) {
            Arrays.sort(volumes, Comparator.comparing(File::getName));
            for (File volume : volumes) {
                if (!volume.isDirectory()) {
                    continue;
                }
                String name = volume.getName();
                if ("emulated".equalsIgnoreCase(name) || "self".equalsIgnoreCase(name)) {
                    continue;
                }
                if (!volume.canRead()) {
                    continue;
                }
                entries.add(volume);
                labels.add("Storage · " + name);
            }
        }

        currentDir = null;
        pathLabel.setText("Select a storage location");
        upButton.setEnabled(false);
        adapter.clear();
        adapter.addAll(labels);
        adapter.notifyDataSetChanged();
        emptyLabel.setVisibility(labels.isEmpty() ? View.VISIBLE : View.GONE);
        emptyLabel.setText(labels.isEmpty()
            ? "No folders found. Grant files access if prompted."
            : "");
        useFolderButton.setEnabled(false);

        focusList();
    }

    private void loadDirectory(File directory) {
        currentDir = directory;
        pathLabel.setText(directory.getAbsolutePath());
        upButton.setEnabled(true);
        useFolderButton.setEnabled(true);

        entries.clear();
        List<String> labels = new ArrayList<>();

        File[] children = directory.listFiles();
        if (children != null) {
            List<File> folders = new ArrayList<>();
            for (File child : children) {
                if (child.isDirectory() && !child.isHidden() && child.canRead()) {
                    folders.add(child);
                }
            }
            Collections.sort(folders, (left, right) ->
                left.getName().compareToIgnoreCase(right.getName())
            );

            int videoCount = countVideosInFolder(directory);
            for (File folder : folders) {
                entries.add(folder);
                int nestedVideos = countVideosInFolder(folder);
                String suffix = nestedVideos > 0
                    ? "  (" + nestedVideos + " videos)"
                    : "";
                labels.add(folder.getName() + suffix);
            }

            if (videoCount > 0) {
                emptyLabel.setText(videoCount + " video file(s) in this folder — press Use this folder");
                emptyLabel.setVisibility(View.VISIBLE);
            } else if (folders.isEmpty()) {
                emptyLabel.setText("No subfolders. Press Use this folder if videos are here.");
                emptyLabel.setVisibility(View.VISIBLE);
            } else {
                emptyLabel.setVisibility(View.GONE);
            }
        } else {
            emptyLabel.setText("Cannot read this folder. Try Internal storage or grant files access.");
            emptyLabel.setVisibility(View.VISIBLE);
        }

        adapter.clear();
        adapter.addAll(labels);
        adapter.notifyDataSetChanged();

        if (!labels.isEmpty()) {
            focusList();
        } else {
            useFolderButton.requestFocus();
        }
    }

    private int countVideosInFolder(File directory) {
        File[] files = directory.listFiles();
        if (files == null) {
            return 0;
        }
        int count = 0;
        for (File file : files) {
            if (file.isFile() && isVideoName(file.getName())) {
                count += 1;
            }
        }
        return count;
    }

    private boolean isVideoName(String name) {
        if (name == null) {
            return false;
        }
        String lower = name.toLowerCase(Locale.US);
        return lower.endsWith(".mp4")
            || lower.endsWith(".m4v")
            || lower.endsWith(".webm")
            || lower.endsWith(".mkv")
            || lower.endsWith(".mov")
            || lower.endsWith(".avi")
            || lower.endsWith(".3gp")
            || lower.endsWith(".ts")
            || lower.endsWith(".mts")
            || lower.endsWith(".m2ts");
    }

    private void openEntry(int position) {
        if (position < 0 || position >= entries.size()) {
            return;
        }
        File next = entries.get(position);
        if (next.isDirectory()) {
            loadDirectory(next);
        }
    }

    private void navigateUp() {
        if (currentDir == null) {
            openRoots();
            return;
        }
        File parent = currentDir.getParentFile();
        if (parent == null || !parent.canRead()) {
            openRoots();
            return;
        }
        if ("/storage".equals(parent.getAbsolutePath()) || "/".equals(parent.getAbsolutePath())) {
            openRoots();
            return;
        }
        loadDirectory(parent);
    }

    private void selectCurrentFolder() {
        if (currentDir == null) {
            Toast.makeText(this, "Open a folder first, then press Use this folder.", Toast.LENGTH_SHORT)
                .show();
            return;
        }
        Intent data = new Intent();
        data.putExtra(EXTRA_FOLDER_PATH, currentDir.getAbsolutePath());
        setResult(RESULT_OK, data);
        finish();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (currentDir != null) {
                navigateUp();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }
}
