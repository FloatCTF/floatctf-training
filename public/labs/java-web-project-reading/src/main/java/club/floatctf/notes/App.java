package club.floatctf.notes;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;

public class App {
    public static void main(String[] args) throws Exception {
        NoteStore store = new NoteStore();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 8080), 0);
        // 路由：请求路径以这个前缀开头，就交给后面这个对象处理
        server.createContext("/hello", new HelloHandler());
        server.createContext("/notes", new NotesHandler(store));
        server.start();
        System.out.println("listening on http://127.0.0.1:8080");
    }
}
