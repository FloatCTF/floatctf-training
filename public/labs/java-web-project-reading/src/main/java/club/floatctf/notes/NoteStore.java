package club.floatctf.notes;

import java.util.ArrayList;

// 笔记只存在内存里，程序一退出就没了；真正的项目会存进数据库
public class NoteStore {
    private final ArrayList<String> notes = new ArrayList<>();

    public synchronized int add(String text) {
        notes.add(text);
        return notes.size();
    }

    public synchronized String listAsText() {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < notes.size(); i++) {
            out.append(i + 1).append(". ").append(notes.get(i)).append("\n");
        }
        return out.isEmpty() ? "(no notes yet)\n" : out.toString();
    }
}
