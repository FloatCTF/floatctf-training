package club.floatctf.notes;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class NotesHandler implements HttpHandler {
    private final NoteStore store;

    public NotesHandler(NoteStore store) {
        this.store = store;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        if (method.equals("GET")) {
            Responses.send(exchange, 200, store.listAsText());
        } else if (method.equals("POST")) {
            String text = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            int id = store.add(text.strip());
            Responses.send(exchange, 201, "created #" + id + "\n");
        } else {
            Responses.send(exchange, 405, "method not allowed\n");
        }
    }
}
