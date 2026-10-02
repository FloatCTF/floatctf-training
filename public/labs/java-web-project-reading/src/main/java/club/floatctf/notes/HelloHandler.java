package club.floatctf.notes;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;

public class HelloHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange exchange) throws IOException {
        // 查询字符串，例如 name=kali；没有时是 null
        String query = exchange.getRequestURI().getQuery();
        String name = "stranger";
        if (query != null && query.startsWith("name=")) {
            name = query.substring(5);
        }
        Responses.send(exchange, 200, "Hello, " + name + "!\n");
    }
}
