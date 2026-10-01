CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  city TEXT
);

CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL
);

INSERT INTO users (id, name, role, city) VALUES
  (1, 'alice', 'admin', 'Chengdu'),
  (2, 'bob', 'member', 'Wuhan'),
  (3, 'carol', 'member', 'Chengdu'),
  (4, 'dave', 'member', NULL);

INSERT INTO items (id, name, category, price) VALUES
  (1, 'keyboard', 'hardware', 120),
  (2, 'mouse', 'hardware', 60),
  (3, 'usb-drive', 'hardware', 45),
  (4, 'sticker', 'merch', 5),
  (5, 't-shirt', 'merch', 80),
  (6, 'handbook', 'book', 35);

INSERT INTO orders (id, user_id, item_id, quantity) VALUES
  (1, 1, 1, 1),
  (2, 2, 4, 10),
  (3, 2, 2, 1),
  (4, 3, 6, 2),
  (5, 3, 4, 3);
